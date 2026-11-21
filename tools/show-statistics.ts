import type { ToolDefinition } from "./types";

const showStatisticsTool: ToolDefinition = {
  schema: {
    name: "show_statistics",
    description:
      "Otwórz ekran statystyk finansowych w aplikacji mobilnej. Opcjonalnie można wskazać rok i miesiąc." +
      " Użyj po odpowiedzi na pytanie o statystyki, gdy użytkownik może chcieć zobaczyć więcej." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o przejście do statystyk." +
      " Użyj actionType='suggested' (z label) gdy odpowiadasz na pytanie o dane finansowe i chcesz zaproponować przejście do statystyk.",
    input_schema: {
      type: "object",
      properties: {
        actionType: { type: "string", enum: ["direct", "suggested"], description: "'direct' — przechodzi od razu; 'suggested' — pokazuje przycisk z propozycją" },
        label:      { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Zobacz statystyki za styczeń'" },
        year:       { type: "number", description: "Rok (np. 2024)" },
        month:      { type: "number", description: "Miesiąc (1-12)" },
      },
      required: ["actionType"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, year, month } = input as { actionType: string; label?: string; year?: number; month?: number };
    const payload: Record<string, unknown> = {};
    if (year !== undefined) payload.year = year;
    if (month !== undefined) payload.month = month;
    ctx.emit({ type: "SHOW_STATISTICS", actionType, label, payload: Object.keys(payload).length ? payload : undefined });
    return { success: true };
  },
};

export default showStatisticsTool;
