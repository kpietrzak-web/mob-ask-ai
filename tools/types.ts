/**
 * Provider-neutral tool schema (JSON Schema for the input).
 * Converted to OpenAI Chat Completions / Realtime formats in `tools/index.ts`.
 */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ApiContext {
  apiUrl: string;
  token: string;
  emit: (event: object) => void;
}

export interface ToolDefinition {
  schema: ToolSchema;
  execute: (input: Record<string, unknown>, ctx: ApiContext) => Promise<unknown>;
}

export function apiUrl(ctx: ApiContext, path: string): string {
  return `${ctx.apiUrl.replace(/\/$/, "")}${path}`;
}
