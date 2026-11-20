import type { ToolDefinition } from "./types";

const openInvoiceTool: ToolDefinition = {
  schema: {
    name: "open_income",
    description:
      "Przejdź do widoku faktury w aplikacji mobilnej." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o przejście do faktury (np. 'przejdź do faktury XX/XX/XX', 'otwórz fakturę XX')." +
      " Użyj actionType='suggested' gdy użytkownik pyta 'pokaż mi fakturę XX' — wtedy wyślij tę akcję razem z download_invoice_pdf (obie suggested)," +
      " żeby użytkownik mógł wybrać czy chce przejść do faktury czy pobrać PDF." +
      " W label podaj np. 'Przejdź do faktury XX/XX/XX'.",
    input_schema: {
      type: "object",
      properties: {
        actionType:     { type: "string", enum: ["direct", "suggested"], description: "'direct' — natychmiast nawiguje; 'suggested' — pokazuje przycisk z propozycją" },
        label:          { type: "string", description: "Tekst przycisku, np. 'Przejdź do faktury 1/2024'" },
        icon:           { type: "string", description: "Opcjonalna nazwa ikony z Font Awesome 5 Free, np. 'file-invoice'" },
        invoiceId:      { type: "number", description: "ID faktury" },
        invoiceNumber:  { type: "string", description: "Numer faktury (do wyświetlenia w przycisku)" },
      },
      required: ["actionType", "invoiceId"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, icon, ...payload } = input as Record<string, unknown>;
    ctx.emit({ type: "open_income", actionType, label, icon, payload });
    return { success: true };
  },
};

export default openInvoiceTool;
