import type { ToolDefinition } from "./types";

/**
 * Emits a "suggested" action button that, when tapped, sends a canned reply
 * back into the chat as if the user wrote it — reusing the app's existing
 * suggestion-button mechanism. Used to offer the "zrób to za mnie" choice
 * (e.g. "Dodaj kontrahenta za mnie", "Wystaw fakturę za mnie") next to a
 * navigation suggestion like open_contractor_form / open_income_form.
 *
 * App-dependent: version-gated so only app builds that understand the
 * `send_message` action receive the button.
 */
const suggestReplyTool: ToolDefinition = {
  schema: {
    name: "suggest_reply",
    description:
      "Pokaż użytkownikowi przycisk, którego kliknięcie wyśle do czatu gotową odpowiedź (tak jakby user ją napisał)." +
      " Używaj, gdy chcesz dać użytkownikowi wybór kontynuowania rozmowy jednym kliknięciem — np. przycisk" +
      " 'Dodaj kontrahenta za mnie' (obok przycisku 'Otwórz formularz kontrahenta' z open_contractor_form)." +
      " W 'label' podaj tekst na przycisku, w 'message' dokładną treść, która ma trafić do czatu po kliknięciu" +
      " (zwykle taka sama jak label). Zawsze w języku rozmowy.",
    input_schema: {
      type: "object",
      properties: {
        label:   { type: "string", description: "Tekst na przycisku, np. 'Dodaj kontrahenta za mnie'" },
        message: { type: "string", description: "Treść wysyłana do czatu po kliknięciu, np. 'Dodaj kontrahenta za mnie'" },
        icon:    { type: "string", description: "Opcjonalna nazwa ikony Font Awesome 5 Free, np. 'robot', 'magic'" },
      },
      required: ["label", "message"],
    },
  },
  async execute(input, ctx) {
    const { label, message, icon } = input as { label: string; message: string; icon?: string };
    ctx.emit({ type: "send_message", actionType: "suggested", label, icon, payload: { message } });
    return { success: true };
  },
};

export default suggestReplyTool;
