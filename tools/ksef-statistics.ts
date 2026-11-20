import { apiUrl, type ToolDefinition } from "./types";

interface KsefDocumentStats {
  count: number;
  value: number;
}

export interface KsefStatisticsResponse {
  received: {
    sale: KsefDocumentStats;
    cost: KsefDocumentStats;
  };
  sent: {
    sale: KsefDocumentStats;
  };
  status: {
    success: number;
    error: number;
    processing: number;
  };
  history: {
    months: {
      sale: KsefDocumentStats;
      cost: KsefDocumentStats;
    }[];
  };
}

const ksefStatisticsTool: ToolDefinition = {
  schema: {
    name: "get_ksef_statistics",
    description: "Pobierz statystyki KSeF: liczba i wartość faktur wysłanych/odebranych, statusy oraz historia miesięczna.",
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
    const res = await fetch(`${apiUrl(ctx, "/ksef/stats")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<KsefStatisticsResponse>;
  },
};

export default ksefStatisticsTool;
