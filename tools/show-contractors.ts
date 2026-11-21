import type { ToolDefinition } from "./types";

const showContractorsTool: ToolDefinition = {
  schema: {
    name: "show_contractors",
    description: "Przejdź do listy kontrahentów w aplikacji mobilnej.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  async execute(_input, ctx) {
    ctx.emit({ type: "SHOW_CONTRACTORS", actionType: "direct" });
    return { success: true };
  },
};

export default showContractorsTool;
