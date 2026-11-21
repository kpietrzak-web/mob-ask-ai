import type { ToolDefinition } from "./types";

const unaccountInvoiceTool: ToolDefinition = {
  schema: {
    name: "unaccount_invoice",
    description:
      "Cofnij akceptację faktury — przywróć ją do statusu roboczej." +
      " Użyj gdy użytkownik prosi o cofnięcie akceptacji, odksięgowanie lub przywrócenie faktury do wersji roboczej.",
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
    ctx.emit({ type: "MARK_INVOICE_AS_DRAFT", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default unaccountInvoiceTool;
