import type { Request, Response } from "express";
import type { Response as OpenAIResponse, ResponseFunctionToolCall, ResponseInputItem, ResponseOutputItem } from "openai/resources/responses/responses";
import type { ReasoningEffort } from "openai/resources/shared";
import { config, openai, Sentry } from "./config";
import { buildSystemPrompt, parseScreenContext } from "./prompt";
import { chatTools, runToolForModel } from "./tools";
import type { ApiContext } from "./tools/types";
import { getAvailableActions, isValidBuildCode, isOutdated, getMissingFeatures, parseBuildCode, FALLBACK_BUILD, LATEST_BUILD } from "./actionVersioning";
import { devLog, devWarn } from "./logger";
import { recordUsage, computeChatCost, actionCategories, hashRef, newId } from "./usage";

/** True if any tool call was invoked with `actionType: "direct"`. Reads only the flag, never stores args. */
function hasDirectAction(calls: ResponseFunctionToolCall[]): boolean {
  return calls.some((c) => {
    try {
      return (JSON.parse(c.arguments) as { actionType?: string })?.actionType === "direct";
    } catch {
      return false;
    }
  });
}

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

  // Usage-logging context (no PII). conversation/message ids come from the app
  // if it sends them, otherwise each request is treated as its own turn.
  const conversationId = (req.headers["x-conversation-id"] as string) || newId();
  const messageId = (req.headers["x-message-id"] as string) || newId();
  const userRef = hashRef(token);
  const tenantRef = hashRef(apiUrl);
  const appBuild = parseBuildCode(rawAppVersion);
  const screenKey = typeof screenContext.screen === "string" ? screenContext.screen : null;
  const sse = {
    text:   (chunk: string) => res.write(`event: text\ndata: ${JSON.stringify(chunk)}\n\n`),
    action: (event: object) => res.write(`event: action\ndata: ${JSON.stringify(event)}\n\n`),
    done:   ()              => res.write(`event: done\ndata: [DONE]\n\n`),
  };
  const ctx: ApiContext = { token, apiUrl, emit: (event) => {
    const e = event as { type?: string; name?: string };
    if (e.type !== "refresh" && e.name && !availableActions.has(e.name)) {
      devWarn(`[version] blocking action '${e.name}' for build=${userBuild}`);
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
  devLog("[user]", latestUserMessage?.content, "| api:", apiUrl, screenLog, buildLog);

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
      let usage: OpenAIResponse["usage"] | undefined;
      let model = config.chatModel;
      let incomplete = false;
      const iterationStart = Date.now();

      for await (const event of stream) {
        switch (event.type) {
          case "response.output_text.delta":
            fullReply += event.delta;
            sse.text(event.delta);
            break;
          case "response.completed":
          case "response.incomplete":
            output = event.response.output;
            usage = event.response.usage;
            model = event.response.model ?? model;
            if (event.type === "response.incomplete") {
              incomplete = true;
              devWarn("[warn] response incomplete:", event.response.incomplete_details);
            }
            break;
          case "response.failed":
            throw new Error(`Response failed: ${JSON.stringify(event.response.error)}`);
          case "error":
            throw new Error(`Stream error: ${event.message}`);
        }
      }

      const calls = output.filter((i): i is ResponseFunctionToolCall => i.type === "function_call");

      if (usage) {
        const toolNames = calls.map((c) => c.name);
        const { costUsd, priceVersion } = computeChatCost(model, usage);
        recordUsage({
          channel: "chat",
          model,
          conversationId,
          messageId,
          iteration: iteration - 1,
          userRef,
          tenantRef,
          screen: screenKey,
          appBuild,
          inputTokens: usage.input_tokens ?? 0,
          cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
          audioInputTokens: 0,
          audioOutputTokens: 0,
          totalTokens: usage.total_tokens ?? 0,
          toolCalls: toolNames,
          actionTypes: actionCategories(toolNames),
          actionDirect: hasDirectAction(calls),
          costUsd,
          priceVersion,
          latencyMs: Date.now() - iterationStart,
          incomplete,
        });
      }

      if (calls.length === 0) {
        devLog("[agent]", fullReply);
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
