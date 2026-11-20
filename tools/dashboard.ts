import { apiUrl, type ToolDefinition } from "./types";

interface FinancialSummary {
  income: number;
  outcome: number;
  balance: number;
}

export interface DashboardResponse {
  monthly: FinancialSummary;
  yearly: FinancialSummary;
  taxes: { vat: number; pit: number; zus: number };
  dues: { code: string; amount: number; date: string }[];
}

const dashboardTool: ToolDefinition = {
  schema: {
    name: "get_dashboard",
    description: "Pobierz dane dashboardu: podsumowanie miesięczne i roczne przychodów/kosztów, podatki (VAT, PIT, ZUS) oraz nadchodzące zobowiązania.",
    input_schema: {
      type: "object",
      properties: {
        dateTo: { type: "string", description: "Data końcowa (YYYY-MM-DD)" },
      },
      required: [],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams();
    if (input.dateTo) qs.set("dateTo", input.dateTo as string);
    const query = qs.toString();
    const res = await fetch(`${apiUrl(ctx, "/dashboard")}${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<DashboardResponse>;
  },
};

export default dashboardTool;
