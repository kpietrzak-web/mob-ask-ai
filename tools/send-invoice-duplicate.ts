import { apiUrl, type ToolDefinition } from "./types";

const sendInvoiceDuplicateTool: ToolDefinition = {
  schema: {
    name: "send_invoice_duplicate",
    description:
      "Wyślij duplikat (kopię) faktury na adres e-mail." +
      " Użyj TYLKO gdy użytkownik jawnie prosi o wysłanie duplikatu faktury (np. 'wyślij duplikat faktury', 'wyślij kopię faktury')." +
      " Do zwykłej wysyłki faktury używaj send_invoice." +
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
    const res = await fetch(apiUrl(ctx, "/send-duplicate"), {
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

export default sendInvoiceDuplicateTool;
