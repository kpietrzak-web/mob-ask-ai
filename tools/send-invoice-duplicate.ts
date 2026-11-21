import type { ToolDefinition } from "./types";

const sendInvoiceDuplicateTool: ToolDefinition = {
  schema: {
    name: "send_invoice_duplicate",
    description:
      "Zduplikuj fakturę — otwiera flow duplikowania faktury w aplikacji mobilnej." +
      " Użyj gdy użytkownik prosi o duplikat lub kopię faktury.",
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
    ctx.emit({ type: "DUPLICATE_INCOME", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default sendInvoiceDuplicateTool;
