import type { ToolDefinition } from "./types";

const refreshTool: ToolDefinition = {
  schema: {
    name: "refresh",
    description:
      "Wyślij do aplikacji żądanie odświeżenia danych. Wywołaj po każdej operacji modyfikującej dane" +
      " (akceptacja faktury, cofnięcie akceptacji, wysyłka, itp.) żeby aplikacja zaktualizowała widok.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          enum: ["income", "expense", "contractor", "dashboard", "ksef", "inbox"],
          description: "Typ encji do odświeżenia",
        },
        id: { type: "number", description: "ID konkretnego dokumentu/rekordu (opcjonalne — jeśli brak, odświeża listę)" },
      },
      required: ["entity"],
    },
  },
  async execute(input, ctx) {
    const { entity, id } = input as { entity: string; id?: number };
    ctx.emit({ type: "refresh", entity, ...(id !== undefined && { id }) });
    return { success: true };
  },
};

export default refreshTool;
