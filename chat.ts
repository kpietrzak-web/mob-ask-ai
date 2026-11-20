import type { Request, Response } from "express";
import type { ChatCompletionMessageParam, ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";
import { config, openai } from "./config";
import { buildSystemPrompt, parseScreenContext } from "./prompt";
import { chatTools, runToolForModel } from "./tools";
import type { ApiContext } from "./tools/types";

/** Accepts plain strings as well as content-block arrays (`[{ type: "text", text }]`). */
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

export function toChatHistory(raw: unknown): ChatCompletionMessageParam[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as "user" | "assistant", content: contentToText(m.content) }));
}

export async function chatHandler(req: Request, res: Response) {
  // tu: sprawdź token użytkownika i limit wiadomości
  const token = (req.headers.authorization ?? "").replace("Bearer ", "");
  const apiUrl = (req.headers["x-api-url"] as string) ?? "";
  const screenContext = parseScreenContext(req.headers["x-screen-context"] as string | undefined);
  const sse = {
    text:   (chunk: string) => res.write(`event: text\ndata: ${JSON.stringify(chunk)}\n\n`),
    action: (event: object) => res.write(`event: action\ndata: ${JSON.stringify(event)}\n\n`),
    done:   ()              => res.write(`event: done\ndata: [DONE]\n\n`),
  };
  const ctx: ApiContext = { token, apiUrl, emit: sse.action };

  const messages = toChatHistory(req.body?.messages);
  const latestUserMessage = messages.at(-1);
  const screenLog = screenContext.screen
    ? `| screen: ${JSON.stringify(screenContext)}`
    : "";
  console.log("[user]", latestUserMessage?.content, "| token:", token, "| api:", apiUrl, screenLog);

  res.setHeader("Content-Type", "text/event-stream");

  // Stop calling the model if the app disconnects mid-stream.
  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });

  const system = buildSystemPrompt(screenContext);
  let fullReply = "";
  let iteration = 0;

  try {
    while (true) {
      if (iteration++ > 0 && fullReply.length > 0) sse.text("\n\n");

      const stream = await openai.chat.completions.create(
        {
          model: config.chatModel,
          max_completion_tokens: config.chatMaxCompletionTokens,
          ...(config.chatReasoningEffort
            ? { reasoning_effort: config.chatReasoningEffort as ReasoningEffort }
            : {}),
          messages: [{ role: "system", content: system }, ...messages],
          tools: chatTools,
          stream: true,
        },
        { signal: abort.signal }
      );

      let turnText = "";
      const toolCalls: ChatCompletionMessageFunctionToolCall[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          turnText += delta.content;
          fullReply += delta.content;
          sse.text(delta.content);
        }

        // Tool call arguments arrive in fragments, keyed by index.
        for (const tc of delta.tool_calls ?? []) {
          const call = (toolCalls[tc.index] ??= {
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          });
          if (tc.id) call.id = tc.id;
          if (tc.function?.name) call.function.name += tc.function.name;
          if (tc.function?.arguments) call.function.arguments += tc.function.arguments;
        }
      }

      const calls = toolCalls.filter(Boolean);
      if (calls.length === 0) {
        console.log("[agent]", fullReply);
        sse.done();
        res.end();
        break;
      }

      messages.push({ role: "assistant", content: turnText || null, tool_calls: calls });

      const toolResults = await Promise.all(
        calls.map(async (c) => ({
          role: "tool" as const,
          tool_call_id: c.id,
          content: await runToolForModel(c.function.name, c.function.arguments, ctx),
        }))
      );

      messages.push(...toolResults);
    }
  } catch (err) {
    if (!abort.signal.aborted) console.error("[error]", err);
    res.end();
  }
}
