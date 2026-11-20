import { apiUrl, type ToolDefinition } from "./types";

const sendInvoiceReminderTool: ToolDefinition = {
  schema: {
    name: "send_invoice_reminder",
    description:
      "Wyślij przypomnienie o płatności za fakturę na adres e-mail." +
      " Użyj gdy użytkownik prosi o wysłanie przypomnienia odnośnie faktury (np. 'wyślij przypomnienie dla faktury XX/XX/XX')." +
      " Jeśli użytkownik nie podał adresu e-mail, pobierz fakturę przez get_invoices (po numerze lub ID)," +
      " odczytaj e-mail kontrahenta z pola contractor.email i zapytaj użytkownika czy wysłać właśnie na ten adres.",
    input_schema: {
      type: "object",
      properties: {
        invoiceId: { type: "number", description: "ID faktury" },
        email:     { type: "string", description: "Adres e-mail odbiorcy" },
      },
      required: ["invoiceId", "email"],
    },
  },
  async execute(input, ctx) {
    const { invoiceId, email } = input as { invoiceId: number; email: string };
    const res = await fetch(apiUrl(ctx, "/send-prompt"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoiceId, email }),
    });
    const text = await res.text();
    return text ? JSON.parse(text) : { success: res.ok };
  },
};

export default sendInvoiceReminderTool;
