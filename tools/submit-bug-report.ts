import type { ToolDefinition } from "./types";

const submitBugReportTool: ToolDefinition = {
  schema: {
    name: "submit_bug_report",
    description:
      "Otwórz formularz zgłoszenia błędu lub sugestii do zespołu CashDirector." +
      " Użyj gdy użytkownik zgłasza problem z aplikacją, chce coś zaraportować lub zaproponować ulepszenie." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o zgłoszenie problemu." +
      " Użyj actionType='suggested' (z label) gdy użytkownik opisuje problem z działaniem aplikacji.",
    input_schema: {
      type: "object",
      properties: {
        actionType: { type: "string", enum: ["direct", "suggested"], description: "'direct' — otwiera formularz od razu; 'suggested' — pokazuje przycisk z propozycją" },
        label:      { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Zgłoś błąd'" },
      },
      required: ["actionType"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label } = input as { actionType: string; label?: string };
    ctx.emit({ type: "SUBMIT_BUG_REPORT", actionType, label });
    return { success: true };
  },
};

export default submitBugReportTool;
