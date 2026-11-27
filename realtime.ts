import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { config } from "./config";
import { buildVoiceInstructions, parseScreenContext, type ScreenContext } from "./prompt";
import { realtimeTools, runToolForModel } from "./tools";
import type { ApiContext } from "./tools/types";
import { parseBuildCode } from "./actionVersioning";
import { devLog } from "./logger";
import { recordUsage, computeRealtimeCost, actionCategories, hashRef, newId } from "./usage";
import type { RealtimeTokenUsage } from "./usage/pricing";

/**
 * Voice-to-voice over the OpenAI Realtime API.
 *
 * The mobile app opens a WebSocket to `/realtime` and talks the OpenAI Realtime
 * protocol (input_audio_buffer.append, response.output_audio.delta, …); the
 * server relays it to OpenAI and back. The server:
 *  - holds the OpenAI API key (the app never sees it),
 *  - sets instructions + tools itself (the app cannot override them),
 *  - executes tool calls with the user's token/apiUrl and sends the results back,
 *  - sends UI actions to the app as `{ type: "mob.action", action }`.
 *
 * Extra messages (app → server):
 *  - `{ type: "mob.context", screenContext }` — the user moved to another screen
 *  - `{ type: "mob.history", messages: [{ role, content }] }` — seed the voice
 *    session with the text chat so far (send before the user starts talking)
 *  - binary frame — raw PCM16 24 kHz mono audio, shortcut for input_audio_buffer.append
 *
 * Extra messages (server → app):
 *  - `{ type: "mob.action", action }` — same object as the SSE `action` event
 *  - `{ type: "mob.tool", name, status: "started" | "done" }` — e.g. to show "checking invoices…"
 *  - `{ type: "mob.error", message }`
 */

export const REALTIME_PATH = "/realtime";

/** Session fields only the server may set. */
const LOCKED_SESSION_FIELDS = ["instructions", "tools", "tool_choice", "model", "type"];

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    devLog(`[realtime] upgrade request: ${url.pathname} from ${req.socket.remoteAddress}`);
    if (url.pathname !== REALTIME_PATH) {
      devLog(`[realtime] rejected upgrade — unknown path: ${url.pathname}`);
      socket.destroy();
      return;
    }

    // Validate APP_KEY (timing-safe).
    const appKey = process.env.APP_KEY ?? "";
    const receivedKey = header(req, "x-app-key") ?? "";
    const keyValid =
      appKey.length > 0 &&
      receivedKey.length === appKey.length &&
      timingSafeEqual(Buffer.from(receivedKey), Buffer.from(appKey));
    if (!keyValid) {
      devLog(`[realtime] rejected upgrade — invalid x-app-key`);
      socket.write("HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }

    // Validate that an auth token is present.
    const authHeader = header(req, "authorization") ?? "";
    const tokenFromQuery = url.searchParams.get("token") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : tokenFromQuery.trim();
    if (!token) {
      devLog(`[realtime] rejected upgrade — missing authorization token`);
      socket.write("HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }

    devLog(`[realtime] accepting WebSocket upgrade`);
    wss.handleUpgrade(req, socket, head, (ws) => handleSession(ws, req, url));
  });
}

function handleSession(client: WebSocket, req: IncomingMessage, url: URL) {
  // Headers are preferred (React Native: new WebSocket(url, undefined, { headers })).
  // Query params are a fallback for clients that cannot set headers.
  // tu: sprawdź token użytkownika i limit
  const token =
    (header(req, "authorization") ?? "").replace("Bearer ", "") || url.searchParams.get("token") || "";
  const apiUrl = header(req, "x-api-url") ?? url.searchParams.get("apiUrl") ?? "";
  const userEmail = header(req, "x-user-email") ?? "";
  let screenContext: ScreenContext = parseScreenContext(
    header(req, "x-screen-context") ?? url.searchParams.get("screenContext")
  );

  // X-Voice-Mode: search — transcription-only mode for search bar voice input.
  // No AI response is generated; transcription text is forwarded via mob.transcript.
  const isSearchMode = header(req, "x-voice-mode") === "search";

  // Usage-logging context: one WebSocket session = one conversation. No PII stored.
  const conversationId = newId();
  const voiceUserRef = hashRef(userEmail || token);
  const voiceTenantRef = hashRef(apiUrl);
  const voiceAppBuild = parseBuildCode(header(req, "x-app-version"));

  const tag = `[voice ${token.slice(-6) || "anon"}]`;
  devLog(`${tag} connected | email: ${userEmail || "unknown"} | api: ${apiUrl}`, screenContext.screen ? `| screen: ${JSON.stringify(screenContext)}` : "");

  const sendClient = (event: object) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
  };

  const ctx: ApiContext = {
    token,
    apiUrl,
    emit: (action) => sendClient({ type: "mob.action", action }),
  };

  const upstream = new WebSocket(
    `${config.realtimeUrl}?model=${encodeURIComponent(config.realtimeModel)}`,
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` } }
  );

  // Messages from the app that arrive before OpenAI is connected.
  const pending: string[] = [];
  const sendUpstream = (event: object | string) => {
    const data = typeof event === "string" ? event : JSON.stringify(event);
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
    else if (upstream.readyState === WebSocket.CONNECTING) pending.push(data);
  };

  const closeBoth = (code = 1000, reason = "") => {
    for (const ws of [client, upstream]) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try { ws.close(code, reason); } catch { ws.terminate(); }
      }
    }
  };

  /** Record token usage for one voice model response (audio is the big cost). */
  function recordVoiceResponseUsage(response: { id?: string; status?: string; output?: any[]; usage?: RealtimeTokenUsage } | undefined): void {
    const usage = response?.usage;
    if (!usage) return;
    const calls = (response?.output ?? []).filter((i) => i?.type === "function_call");
    const toolNames = calls.map((c) => c.name as string);
    const { costUsd, priceVersion } = computeRealtimeCost(config.realtimeModel, usage);
    recordUsage({
      channel: "voice",
      model: config.realtimeModel,
      conversationId,
      messageId: response?.id ?? newId(),
      iteration: 0,
      userRef: voiceUserRef,
      tenantRef: voiceTenantRef,
      screen: typeof screenContext.screen === "string" ? screenContext.screen : null,
      appBuild: voiceAppBuild,
      inputTokens: usage.input_tokens ?? 0,
      cachedInputTokens: usage.input_token_details?.cached_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      reasoningTokens: 0,
      audioInputTokens: usage.input_token_details?.audio_tokens ?? 0,
      audioOutputTokens: usage.output_token_details?.audio_tokens ?? 0,
      totalTokens: usage.input_tokens != null && usage.output_tokens != null ? usage.input_tokens + usage.output_tokens : 0,
      toolCalls: toolNames,
      actionTypes: actionCategories(toolNames),
      actionDirect: true,
      costUsd,
      priceVersion,
      latencyMs: null,
      incomplete: response?.status !== "completed",
    });
  }

  /** Record transcription (STT) usage. Only token-billed models are priced here. */
  function recordTranscribeUsage(usage: { type?: string; input_tokens?: number; output_tokens?: number; total_tokens?: number; input_token_details?: { audio_tokens?: number; text_tokens?: number } } | undefined): void {
    if (!usage || usage.type !== "tokens") return;
    const inAudio = usage.input_token_details?.audio_tokens ?? 0;
    const inText = usage.input_token_details?.text_tokens ?? 0;
    const outText = usage.output_tokens ?? 0;
    const { costUsd, priceVersion } = computeRealtimeCost(config.realtimeTranscriptionModel, {
      input_token_details: { audio_tokens: inAudio, text_tokens: inText },
      output_token_details: { text_tokens: outText, audio_tokens: 0 },
    });
    recordUsage({
      channel: "voice_transcribe",
      model: config.realtimeTranscriptionModel,
      conversationId,
      messageId: newId(),
      iteration: 0,
      userRef: voiceUserRef,
      tenantRef: voiceTenantRef,
      screen: typeof screenContext.screen === "string" ? screenContext.screen : null,
      appBuild: voiceAppBuild,
      inputTokens: usage.input_tokens ?? inAudio + inText,
      cachedInputTokens: 0,
      outputTokens: outText,
      reasoningTokens: 0,
      audioInputTokens: inAudio,
      audioOutputTokens: 0,
      totalTokens: usage.total_tokens ?? 0,
      toolCalls: [],
      actionTypes: [],
      actionDirect: false,
      costUsd,
      priceVersion,
      latencyMs: null,
      incomplete: false,
    });
  }

  // ---------- OpenAI → app ----------

  upstream.on("open", () => {
    devLog(`${tag} upstream (OpenAI) connected — sending session.update (mode: ${isSearchMode ? "search/transcribe" : "voice"})`);

    if (isSearchMode) {
      // Transcription-only mode: no AI response, no tools — just speech-to-text.
      upstream.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: [],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              noise_reduction: { type: "near_field" },
              transcription: { model: config.realtimeTranscriptionModel, language: "pl" },
              turn_detection: { type: "server_vad", create_response: false },
            },
          },
          tools: [],
          tool_choice: "none",
        },
      }));
    } else {
      upstream.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: buildVoiceInstructions(screenContext),
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              noise_reduction: { type: "near_field" },
              transcription: { model: config.realtimeTranscriptionModel, language: "pl" },
              turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: true, eagerness: "low" },
            },
            output: {
              format: { type: "audio/pcm", rate: 24000 },
              voice: config.realtimeVoice,
            },
          },
          tools: realtimeTools,
          tool_choice: "auto",
        },
      }));
    }

    for (const data of pending.splice(0)) upstream.send(data);
  });

  upstream.on("message", (data: RawData) => {
    const text = data.toString();
    let event: { type?: string; [k: string]: any };
    try { event = JSON.parse(text); } catch { return; }

    // Forward everything as-is (audio, transcripts, VAD events, errors…).
    if (client.readyState === WebSocket.OPEN) client.send(text);

    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed":
        devLog(`${tag} [user]`, event.transcript);
        recordTranscribeUsage(event.usage);
        // In search mode, forward the transcript to the app as mob.transcript.
        if (isSearchMode && event.transcript) {
          sendClient({ type: "mob.transcript", text: event.transcript });
        }
        break;
      case "response.output_audio_transcript.done":
        devLog(`${tag} [agent]`, event.transcript);
        break;
      case "response.done":
        recordVoiceResponseUsage(event.response);
        if (!isSearchMode) void handleResponseDone(event.response);
        break;
      case "error":
        console.error(`${tag} [openai error]`, event.error);
        break;
    }
  });

  /** When a response finishes with function calls: run them, send outputs, ask for the next response. */
  async function handleResponseDone(response: { status?: string; output?: any[] } | undefined) {
    const calls = (response?.output ?? []).filter((i) => i?.type === "function_call");
    if (calls.length === 0) return;
    // Interrupted by the user (barge-in): do not run the tools (e.g. do not send an invoice).
    if (response?.status !== "completed") {
      devLog(`${tag} response ${response?.status}, skipping ${calls.length} tool call(s)`);
      return;
    }

    await Promise.all(calls.map(async (call) => {
      sendClient({ type: "mob.tool", name: call.name, status: "started" });
      const output = await runToolForModel(call.name, call.arguments ?? "", ctx, `${tag} [tool]`);
      devLog(`${tag} [tool] ${call.name} result:`, JSON.stringify(output).slice(0, 400));
      sendClient({ type: "mob.tool", name: call.name, status: "done" });
      sendUpstream({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output },
      });
    }));
    sendUpstream({ type: "response.create" });
  }

  upstream.on("close", (code, reason) => {
    devLog(`${tag} openai closed ${code} ${reason.toString()}`);
    closeBoth(code === 1000 ? 1000 : 1011, "upstream closed");
  });

  upstream.on("error", (err) => {
    console.error(`${tag} openai error`, err);
    sendClient({ type: "mob.error", message: "Voice service unavailable" });
    closeBoth(1011, "upstream error");
  });

  // ---------- app → OpenAI ----------

  client.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary) {
      const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
      devLog(`${tag} audio frame received — ${buf.byteLength} bytes`);
      sendUpstream({ type: "input_audio_buffer.append", audio: buf.toString("base64") });
      return;
    }

    let event: { type?: string; [k: string]: any };
    try { event = JSON.parse(data.toString()); }
    catch { sendClient({ type: "mob.error", message: "Invalid JSON" }); return; }

    switch (event.type) {
      case "mob.context":
        screenContext = (event.screenContext ?? {}) as ScreenContext;
        devLog(`${tag} screen: ${JSON.stringify(screenContext)}`);
        sendUpstream({
          type: "session.update",
          session: { type: "realtime", instructions: buildVoiceInstructions(screenContext) },
        });
        return;

      case "mob.history":
        for (const m of Array.isArray(event.messages) ? event.messages : []) {
          const text = typeof m?.content === "string" ? m.content : "";
          if (!text || (m.role !== "user" && m.role !== "assistant")) continue;
          sendUpstream({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: m.role,
              content: [{ type: m.role === "user" ? "input_text" : "output_text", text }],
            },
          });
        }
        return;

      case "session.update": {
        // The app may tune audio (formats, VAD, voice…) but not the instructions or tools.
        const session = { ...(event.session ?? {}) };
        for (const f of LOCKED_SESSION_FIELDS) delete session[f];
        sendUpstream({ ...event, session: { ...session, type: "realtime" } });
        return;
      }

      case "response.create": {
        // Same rule for per-response overrides.
        if (event.response) {
          const response = { ...event.response };
          for (const f of LOCKED_SESSION_FIELDS) delete response[f];
          event = { ...event, response };
        }
        sendUpstream(event);
        return;
      }

      default:
        if (typeof event.type === "string" && event.type.startsWith("mob.")) {
          sendClient({ type: "mob.error", message: `Unknown event ${event.type}` });
          return;
        }
        sendUpstream(event);
    }
  });

  client.on("close", () => {
    devLog(`${tag} disconnected`);
    closeBoth();
  });

  client.on("error", (err) => {
    console.error(`${tag} client error`, err);
    closeBoth();
  });
}
