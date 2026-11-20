import { apiUrl, type ToolDefinition } from "./types";

export type SettingsTarget = "company" | "missing_for_sale";

export interface Setting {
  code: string;
  value: string;
  required: boolean;
  editable: boolean;
  allowedValues: (string | null)[];
}

export interface SettingsResponse {
  settings: Setting[];
}

const settingsTool: ToolDefinition = {
  schema: {
    name: "get_settings",
    description: "Pobierz ustawienia firmy. Użyj target='company' aby pobrać wszystkie dane firmy, lub target='missing_for_sale' aby sprawdzić brakujące dane potrzebne do wystawienia faktury.",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["company", "missing_for_sale"],
          description: "'company' — dane firmy, 'missing_for_sale' — brakujące dane do wystawienia faktury",
        },
        year: { type: "number", description: "Rok, np. 2024" },
      },
      required: ["target"],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams({ target: input.target as string });
    if (input.year !== undefined) qs.set("year", String(input.year));
    const res = await fetch(`${apiUrl(ctx, "/settings")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<SettingsResponse>;
  },
};

export default settingsTool;
