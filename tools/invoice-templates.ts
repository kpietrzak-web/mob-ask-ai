import { apiUrl, type ToolDefinition } from "./types";
import type { Invoice } from "./invoices";

export interface InvoiceTemplate {
  id: number;
  name: string;
  type: string;
  description: string;
  isFavorite: boolean;
  content: Invoice;
}

export interface InvoiceTemplatesResponse {
  templates: InvoiceTemplate[];
}

const invoiceTemplatesTool: ToolDefinition = {
  schema: {
    name: "get_invoice_templates",
    description: "Pobierz szablony z których użytkownik może wystawić fakture",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  async execute(_input, ctx) {
    const res = await fetch(apiUrl(ctx, "/invoices/templates"), {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<InvoiceTemplatesResponse>;
  },
};

export default invoiceTemplatesTool;
