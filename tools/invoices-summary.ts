import { apiUrl, type ToolDefinition } from "./types";

export interface InvoicesSummaryResponse {
  saleCount: number;
  costCount: number;
  scansInProcessing: number;
}

const invoicesSummaryTool: ToolDefinition = {
  schema: {
    name: "get_invoices_summary",
    description: "Pobierz podsumowanie faktur: liczba sprzedaży, kosztów i skanów w przetwarzaniu dla danego roku.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Rok, np. 2024" },
      },
      required: ["year"],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams({ year: String(input.year) });
    const res = await fetch(`${apiUrl(ctx, "/invoices-summary")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<InvoicesSummaryResponse>;
  },
};

export default invoicesSummaryTool;
