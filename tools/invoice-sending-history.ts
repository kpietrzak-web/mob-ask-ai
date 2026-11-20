import { apiUrl, type ToolDefinition } from "./types";

export type SendingHistoryStatus = "W trakcie" | "Wysłano" | "Nie wysłano" | "Błąd wysyłki" | "Odczytano";

export interface SendingHistoryEntry {
  readDate: string;
  recipient: string;
  sendDate: string;
  sender: string;
  status: SendingHistoryStatus;
  topic: string;
  type: string;
}

export interface SendingHistoryResponse {
  data: SendingHistoryEntry[];
}

const invoiceSendingHistoryTool: ToolDefinition = {
  schema: {
    name: "get_invoice_sending_history",
    description: "Pobierz historię wysyłek faktury (np. do KSeF lub e-mail).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID faktury" },
      },
      required: ["id"],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams({ id: String(input.id) });
    const res = await fetch(`${apiUrl(ctx, "/invoices/sending-history")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<SendingHistoryResponse>;
  },
};

export default invoiceSendingHistoryTool;
