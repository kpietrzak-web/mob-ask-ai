import type { ToolDefinition } from "./types";

const editContractorTool: ToolDefinition = {
  schema: {
    name: "edit_contractor",
    description:
      "Otwórz formularz edycji danych istniejącego kontrahenta w aplikacji mobilnej." +
      " Użyj gdy użytkownik prosi o zmianę danych kontrahenta.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID kontrahenta" },
      },
      required: ["id"],
    },
  },
  async execute(input, ctx) {
    const { id } = input as { id: number };
    ctx.emit({ type: "EDIT_CONTRACTOR", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default editContractorTool;
