import type { ToolDefinition } from "./types";

const markInvoiceAsAccountedTool: ToolDefinition = {
  schema: {
    name: "mark_invoice_as_accounted",
    description:
      "Zaakceptuj fakturę — zmień jej status z roboczej na zaakceptowaną (zaksięgowaną)." +
      " Użyj gdy użytkownik prosi o zaakceptowanie, zaksięgowanie lub zatwierdzenie faktury.",
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
    ctx.emit({ type: "ACCEPT_INVOICE", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default markInvoiceAsAccountedTool;
