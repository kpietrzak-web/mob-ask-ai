import type { ToolDefinition } from "./types";

const downloadInvoicePdfTool: ToolDefinition = {
  schema: {
    name: "download_income_pdf",
    description:
      "Pobierz fakturę jako PDF w aplikacji mobilnej." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o pobranie faktury (np. 'pobierz fakturę XX/XX/XX', 'ściągnij PDF faktury XX')." +
      " Użyj actionType='suggested' gdy użytkownik pyta 'pokaż mi fakturę XX' — wtedy wyślij tę akcję razem z open_income (obie suggested)," +
      " żeby użytkownik mógł wybrać czy chce przejść do faktury czy pobrać PDF." +
      " W label podaj np. 'Pobierz PDF faktury XX/XX/XX'.",
    input_schema: {
      type: "object",
      properties: {
        actionType:     { type: "string", enum: ["direct", "suggested"], description: "'direct' — natychmiast pobiera; 'suggested' — pokazuje przycisk z propozycją" },
        label:          { type: "string", description: "Tekst przycisku, np. 'Pobierz PDF faktury 1/2024'" },
        icon:           { type: "string", description: "Opcjonalna nazwa ikony z Font Awesome 5 Free, np. 'file-pdf'" },
        incomeId:      { type: "number", description: "ID faktury" },
        incomeNumber:  { type: "string", description: "Numer faktury (do wyświetlenia w przycisku)" },
      },
      required: ["actionType", "incomeId"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, icon, ...payload } = input as Record<string, unknown>;
    ctx.emit({ type: "download_income_pdf", actionType, label, icon, payload });
    return { success: true };
  },
};

export default downloadInvoicePdfTool;
