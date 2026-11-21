import type { ToolDefinition } from "./types";

const approveMonthTool: ToolDefinition = {
  schema: {
    name: "approve_month",
    description:
      "Otwórz ekran zgłoszenia miesiąca do zamknięcia przez księgowego." +
      " Użyj gdy użytkownik pyta o zamknięcie miesiąca lub gdy get_close_month_status wskazuje na możliwość zamknięcia." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o zamknięcie miesiąca." +
      " Użyj actionType='suggested' (z label) po sprawdzeniu statusu, gdy miesiąc można już zamknąć.",
    input_schema: {
      type: "object",
      properties: {
        actionType: { type: "string", enum: ["direct", "suggested"], description: "'direct' — przechodzi od razu; 'suggested' — pokazuje przycisk z propozycją" },
        label:      { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Zamknij styczeń 2024'" },
        month:      { type: "string", description: "Miesiąc w formacie YYYY-M, np. '2024-1'" },
      },
      required: ["actionType"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, month } = input as { actionType: string; label?: string; month?: string };
    ctx.emit({ type: "APPROVE_MONTH", actionType, label, payload: month ? { month } : undefined });
    return { success: true };
  },
};

export default approveMonthTool;
