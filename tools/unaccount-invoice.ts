import { apiUrl, type ToolDefinition } from "./types";

const unaccountInvoiceTool: ToolDefinition = {
  schema: {
    name: "unaccount_invoice",
    description:
      "Cofnij akceptację faktury — przywróć ją do statusu roboczej." +
      " Użyj gdy użytkownik prosi o cofnięcie akceptacji, odksięgowanie lub przywrócenie faktury do wersji roboczej." +
      " Parametr force=true należy przekazać gdy użytkownik chce wymusić operację mimo ostrzeżeń.",
    input_schema: {
      type: "object",
      properties: {
        documentIds: { type: "array", items: { type: "number" }, description: "Lista ID faktur do odksięgowania" },
        force:       { type: "boolean", description: "Wymuś operację nawet jeśli faktura ma powiązania (domyślnie false)" },
      },
      required: ["documentIds"],
    },
  },
  async execute(input, ctx) {
    const { documentIds, force = false } = input as { documentIds: number[]; force?: boolean };
    const res = await fetch(apiUrl(ctx, "/invoices/unaccount"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentIds, force }),
    });
    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };
    if (res.ok) documentIds.forEach((id) => ctx.emit({ type: "refresh", entity: "income", id }));
    return result;
  },
};

export default unaccountInvoiceTool;
