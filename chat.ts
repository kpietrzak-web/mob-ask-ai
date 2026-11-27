import type { Request, Response } from "express";
import type { ResponseFunctionToolCall, ResponseInputItem, ResponseOutputItem } from "openai/resources/responses/responses";
import type { ReasoningEffort } from "openai/resources/shared";
import { config, openai, Sentry } from "./config";
import { buildSystemPrompt, parseScreenContext } from "./prompt";
import { chatTools, runToolForModel } from "./tools";
import type { ApiContext } from "./tools/types";
import { getAvailableActions, isValidBuildCode, isOutdated, getMissingFeatures, parseBuildCode, FALLBACK_BUILD, LATEST_BUILD } from "./actionVersioning";

/** Accepts plain strings as well as content-block arrays. */
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && typeof b === "object" && (b as { type?: unknown }).type === "text")
      .map((b) => String((b as { text?: unknown }).text ?? ""))
      .join("\n");
  }
  return "";
}

export function toChatHistory(raw: unknown): ResponseInputItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: contentToText(m.content) }));
}

export async function chatHandler(req: Request, res: Response) {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "");
  const apiUrl = (req.headers["x-api-url"] as string) ?? "";
  const screenContext = parseScreenContext(req.headers["x-screen-context"] as string | undefined);
  const rawAppVersion = req.headers["x-app-version"] as string | undefined;
  const userBuild = parseBuildCode(rawAppVersion) ?? FALLBACK_BUILD;
  const availableActions = getAvailableActions(rawAppVersion);
  const sse = {
    text:   (chunk: string) => res.write(`event: text\ndata: ${JSON.stringify(chunk)}\n\n`),
    action: (event: object) => res.write(`event: action\ndata: ${JSON.stringify(event)}\n\n`),
    done:   ()              => res.write(`event: done\ndata: [DONE]\n\n`),
  };
  const ctx: ApiContext = { token, apiUrl, emit: (event) => {
    const e = event as { type?: string; name?: string };
    if (e.type !== "refresh" && e.name && !availableActions.has(e.name)) {
      console.warn(`[version] blocking action '${e.name}' for build=${userBuild}`);
      return;
    }
    sse.action(event);
  }};

  const input = toChatHistory(req.body?.messages);
  const latestUserMessage = input.at(-1) as { content?: unknown } | undefined;
  const screenLog = screenContext.screen ? `| screen: ${JSON.stringify(screenContext)}` : "";
  const buildLog = rawAppVersion
    ? `| build: ${rawAppVersion}${!isValidBuildCode(rawAppVersion) ? " (invalid, fallback)" : ""}`
    : `| build: missing (fallback ${FALLBACK_BUILD})`;
  console.log("[user]", latestUserMessage?.content, "| api:", apiUrl, screenLog, buildLog);

  const versionedChatTools = chatTools.filter((t) => availableActions.has(t.name));
  const missingFeatures = getMissingFeatures(userBuild);
  const outdated = isOutdated(userBuild);

  res.setHeader("Content-Type", "text/event-stream");
  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });

  const instructions = buildSystemPrompt(screenContext, {
    userBuild,
    latestBuild: LATEST_BUILD,
    outdated,
    missingFeatures,
  });
  let fullReply = "";
  let iteration = 0;

  try {
    while (true) {
      if (iteration++ > 0 && fullReply.length > 0) sse.text("\n\n");

      const stream = await openai.responses.create(
        {
          model: config.chatModel,
          instructions,
          input,
          tools: versionedChatTools,
          max_output_tokens: config.chatMaxOutputTokens,
          ...(config.chatReasoningEffort
            ? {
                reasoning: { effort: config.chatReasoningEffort as ReasoningEffort },
                include: ["reasoning.encrypted_content" as const],
              }
            : {}),
          store: false,
          stream: true,
        },
        { signal: abort.signal }
      );

      let output: ResponseOutputItem[] = [];

      for await (const event of stream) {
        switch (event.type) {
          case "response.output_text.delta":
            fullReply += event.delta;
            sse.text(event.delta);
            break;
          case "response.completed":
          case "response.incomplete":
            output = event.response.output;
            if (event.type === "response.incomplete") {
              console.warn("[warn] response incomplete:", event.response.incomplete_details);
            }
            break;
          case "response.failed":
            throw new Error(`Response failed: ${JSON.stringify(event.response.error)}`);
          case "error":
            throw new Error(`Stream error: ${event.message}`);
        }
      }

      const calls = output.filter((i): i is ResponseFunctionToolCall => i.type === "function_call");
      if (calls.length === 0) {
        console.log("[agent]", fullReply);
        sse.done();
        res.end();
        break;
      }

      input.push(...(output as ResponseInputItem[]));

      const toolResults = await Promise.all(
        calls.map(async (c) => ({
          type: "function_call_output" as const,
          call_id: c.call_id,
          output: await runToolForModel(c.name, c.arguments, ctx),
        }))
      );

      input.push(...toolResults);
    }
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error("[error]", err);
      Sentry.captureException(err, {
        extra: { apiUrl, screenContext: req.headers["x-screen-context"] },
      });
      if (!res.writableEnded) {
        res.write('event: text\ndata: "Wystąpił błąd podczas przetwarzania. Spróbuj ponownie."\n\n');
      }
    }
    res.end();
  }
}
