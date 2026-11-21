import type { ToolDefinition } from "./types";

const showTaskTool: ToolDefinition = {
  schema: {
    name: "show_task",
    description: "Otwórz konkretne zadanie na liście zadań w aplikacji mobilnej.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID zadania" },
      },
      required: ["id"],
    },
  },
  async execute(input, ctx) {
    const { id } = input as { id: number };
    ctx.emit({ type: "SHOW_TASK", actionType: "direct", payload: { id } });
    return { success: true };
  },
};

export default showTaskTool;
