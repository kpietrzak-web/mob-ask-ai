import type { ToolDefinition } from "./types";

const showKsefTool: ToolDefinition = {
  schema: {
    name: "show_ksef",
    description:
      "Otwórz zakładkę KSeF (Krajowy System e-Faktur) w aplikacji mobilnej." +
      " Użyj gdy użytkownik pyta o status KSeF lub chce zobaczyć faktury w KSeF.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  async execute(_input, ctx) {
    ctx.emit({ type: "SHOW_KSEF", actionType: "direct" });
    return { success: true };
  },
};

export default showKsefTool;
