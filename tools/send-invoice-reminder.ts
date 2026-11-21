import type { ToolDefinition } from "./types";

const sendInvoiceReminderTool: ToolDefinition = {
  schema: {
    name: "send_invoice_reminder",
    description:
      "Wyślij przypomnienie o płatności za fakturę — otwiera flow wysyłania przypomnienia w aplikacji mobilnej." +
      " Użyj gdy użytkownik prosi o wysłanie przypomnienia odnośnie faktury.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID faktury" },
      },
      required: ["id"],
    },
  },
  async execute(input, ctx) {
    const { id } = input as { id: number };
    ctx.emit({ type: "SEND_INVOICE_REMINDER", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default sendInvoiceReminderTool;
