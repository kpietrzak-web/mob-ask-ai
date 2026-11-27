import type { Request, Response } from "express";
import type { Response as OpenAIResponse, ResponseFunctionToolCall, ResponseInputItem, ResponseOutputItem } from "openai/resources/responses/responses";
import type { ReasoningEffort } from "openai/resources/shared";
import { config, openai, Sentry } from "./config";
import { buildGreetingPrompt } from "./greetingPrompt";
import { chatTools, runToolForModel } from "./tools";
import type { ApiContext } from "./tools/types";
import { getAvailableActions, parseBuildCode, FALLBACK_BUILD } from "./actionVersioning";
import { devLog, devWarn } from "./logger";
import { recordUsage, computeChatCost, actionCategories, hashRef, newId } from "./usage";
import { GREETING_TOOL_NAMES, type GreetingResult, type GreetingSuggestion, previousMonth } from "./greetingHelpers";

export async function greetingHandler(req: Request, res: Response) {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "");
  const apiUrl = (req.headers["x-api-url"] as string) ?? "";
  const rawAppVersion = req.headers["x-app-version"] as string | undefined;
  const userBuild = parseBuildCode(rawAppVersion) ?? FALLBACK_BUILD;
  const availableActions = getAvailableActions(rawAppVersion);

  // Usage-logging context (no PII).
  const conversationId = newId();
  const messageId = newId();
  const userRef = hashRef(token);
  const tenantRef = hashRef(apiUrl);
  const appBuild = parseBuildCode(rawAppVersion);

  // Suggestion tools emit here instead of streaming — we collect them and return JSON.
  // Everything is coerced to actionType "suggested": a greeting proposes, never acts.
  const suggestions: GreetingSuggestion[] = [];
  const ctx: ApiContext = {
    token,
    apiUrl,
    emit: (event) => {
      const e = event as { type?: string; label?: unknown; icon?: unknown; payload?: unknown };
      if (!e.type || e.type === "refresh") return;
      if (suggestions.length >= config.greeting.maxSuggestions) return;
      if (typeof e.label !== "string" || !e.label.trim()) return; // a button needs a label
      suggestions.push({
        type: e.type,
        actionType: "suggested",
        label: e.label,
        ...(typeof e.icon === "string" ? { icon: e.icon } : {}),
        ...(e.payload && typeof e.payload === "object" ? { payload: e.payload as Record<string, unknown> } : {}),
      });
    },
  };

  const greetingTools = chatTools.filter((t) => GREETING_TOOL_NAMES.has(t.name) && availableActions.has(t.name));

  const now = new Date();
  const prev = previousMonth(now);
  const instructions = buildGreetingPrompt({
    today: now.toISOString().slice(0, 10),
    previousMonth: prev.ym,
    previousMonthAction: prev.action,
  });

  const input: ResponseInputItem[] = [{ role: "user", content: "Przygotuj powitanie." }];
  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });

  devLog("[greeting] start | api:", apiUrl, "| build:", userBuild);

  let fullReply = "";
  let iteration = 0;

  try {
    while (iteration < config.greeting.maxIterations) {
      iteration++;

      const stream = await openai.responses.create(
        {
          model: config.chatModel,
          instructions,
          input,
          tools: greetingTools,
          max_output_tokens: config.greeting.maxOutputTokens,
          ...(config.greeting.reasoningEffort
            ? {
                reasoning: { effort: config.greeting.reasoningEffort as ReasoningEffort },
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
            break;
          case "response.completed":
          case "response.incomplete":
            output = event.response.output;
            usage = event.response.usage;
            model = event.response.model ?? model;
            if (event.type === "response.incomplete") {
              incomplete = true;
              devWarn("[greeting] response incomplete:", event.response.incomplete_details);
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
          channel: "greeting",
          model,
          conversationId,
          messageId,
          iteration: iteration - 1,
          userRef,
          tenantRef,
          screen: null,
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
          actionDirect: false,
          costUsd,
          priceVersion,
          latencyMs: Date.now() - iterationStart,
          incomplete,
        });
      }

      if (calls.length === 0) break;

      input.push(...(output as ResponseInputItem[]));

      const toolResults = await Promise.all(
        calls.map(async (c) => ({
          type: "function_call_output" as const,
          call_id: c.call_id,
          output: await runToolForModel(c.name, c.arguments, ctx, "[greeting-tool]"),
        }))
      );

      input.push(...toolResults);
    }

    const result: GreetingResult = {
      greeting: fullReply.trim(),
      suggestions: suggestions.slice(0, config.greeting.maxSuggestions),
    };
    devLog("[greeting] done |", result.greeting.length, "chars |", result.suggestions.length, "suggestions");
    res.json(result);
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error("[greeting] error", err);
      Sentry.captureException(err, { extra: { apiUrl } });
    }
    if (!res.writableEnded) res.status(500).json({ error: "greeting_failed" });
  }
}
