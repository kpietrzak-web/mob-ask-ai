import { apiUrl, type ToolDefinition } from "./types";

export interface CloseMonthStatusResponse {
  ready: boolean;
  closed: boolean;
}

const closeMonthStatusTool: ToolDefinition = {
  schema: {
    name: "get_close_month_status",
    description: "Sprawdź status zamknięcia miesiąca — czy miesiąc jest gotowy do zamknięcia i czy został już zamknięty.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Miesiąc w formacie YYYY-MM, np. 2024-03" },
      },
      required: ["month"],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams({ month: input.month as string });
    const res = await fetch(`${apiUrl(ctx, "/close-month/status")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<CloseMonthStatusResponse>;
  },
};

export default closeMonthStatusTool;
