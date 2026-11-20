import type Anthropic from "@anthropic-ai/sdk";

export interface ApiContext {
  apiUrl: string;
  token: string;
  emit: (event: object) => void;
}

export interface ToolDefinition {
  schema: Anthropic.Tool;
  execute: (input: Record<string, unknown>, ctx: ApiContext) => Promise<unknown>;
}

export function apiUrl(ctx: ApiContext, path: string): string {
  return `${ctx.apiUrl.replace(/\/$/, "")}${path}`;
}
