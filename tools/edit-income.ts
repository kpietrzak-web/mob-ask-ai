import type { ToolDefinition } from "./types";

const editIncomeTool: ToolDefinition = {
  schema: {
    name: "edit_income",
    description:
      "Otwórz formularz edycji istniejącej faktury sprzedażowej w aplikacji mobilnej." +
      " Użyj gdy użytkownik prosi o edycję lub zmianę danych konkretnej faktury.",
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
    ctx.emit({ type: "EDIT_INCOME", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default editIncomeTool;
