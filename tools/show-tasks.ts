import type { ToolDefinition } from "./types";

const showTasksTool: ToolDefinition = {
  schema: {
    name: "show_tasks",
    description: "Przejdź do listy zadań w aplikacji mobilnej.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  async execute(_input, ctx) {
    ctx.emit({ type: "SHOW_TASKS", actionType: "direct" });
    return { success: true };
  },
};

export default showTasksTool;
