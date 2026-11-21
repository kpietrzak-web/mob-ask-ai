import type { ToolDefinition } from "./types";

const showSequencesTool: ToolDefinition = {
  schema: {
    name: "show_sequences",
    description:
      "Otwórz listę sekwencji numeracji faktur (serii) w aplikacji mobilnej." +
      " Użyj gdy użytkownik pyta o numerację lub serie faktur i chce je zobaczyć lub zmienić domyślną.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  async execute(_input, ctx) {
    ctx.emit({ type: "SHOW_SEQUENCES", actionType: "direct" });
    return { success: true };
  },
};

export default showSequencesTool;
