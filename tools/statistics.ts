import { apiUrl, type ToolDefinition } from "./types";

interface FinancialPeriod {
  income: number;
  outcome: number;
  balance: number;
}

export interface StatisticsResponse {
  summary: FinancialPeriod;
  months: FinancialPeriod[];
}

const statisticsTool: ToolDefinition = {
  schema: {
    name: "get_statistics",
    description: "Pobierz statystyki finansowe (przychody, koszty, bilans) z podziałem na miesiące dla podanego zakresu dat.",
    input_schema: {
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Data początkowa (YYYY-MM-DD)" },
        dateTo:   { type: "string", description: "Data końcowa (YYYY-MM-DD)" },
      },
      required: ["dateFrom", "dateTo"],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams({
      dateFrom: input.dateFrom as string,
      dateTo:   input.dateTo as string,
    });
    const res = await fetch(`${apiUrl(ctx, "/statistics")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<StatisticsResponse>;
  },
};

export default statisticsTool;
