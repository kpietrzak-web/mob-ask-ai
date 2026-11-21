import type { ToolDefinition } from "./types";

const showContractorTool: ToolDefinition = {
  schema: {
    name: "show_contractor",
    description:
      "Otwórz kartę konkretnego kontrahenta w aplikacji mobilnej." +
      " Użyj po get_contractors gdy użytkownik pyta o kontrahenta i chce go zobaczyć." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o wyświetlenie kontrahenta." +
      " Użyj actionType='suggested' (z label) po wyświetleniu danych kontrahenta jako propozycja przejścia do karty.",
    input_schema: {
      type: "object",
      properties: {
        actionType: { type: "string", enum: ["direct", "suggested"], description: "'direct' — przechodzi od razu; 'suggested' — pokazuje przycisk z propozycją" },
        label:      { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Otwórz kartę Jan Kowalski'" },
        id:         { type: "number", description: "ID kontrahenta" },
      },
      required: ["actionType", "id"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, id } = input as { actionType: string; label?: string; id: number };
    ctx.emit({ type: "SHOW_CONTRACTOR", actionType, label, payload: { id } });
    return { success: true };
  },
};

export default showContractorTool;
