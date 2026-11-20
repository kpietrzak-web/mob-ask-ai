import { apiUrl, type ToolDefinition } from "./types";

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
    const res = await fetch(`${apiUrl(ctx, "/mark-invoice-as-accounted")}?id=${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };
    if (res.ok) ctx.emit({ type: "refresh", entity: "income", id });
    return result;
  },
};

export default markInvoiceAsAccountedTool;
