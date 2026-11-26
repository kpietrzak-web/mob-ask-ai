import type { ToolDefinition } from "./types";

const closeVoiceChatTool: ToolDefinition = {
  schema: {
    name: "close_voice_chat",
    description:
      "Zakończ sesję rozmowy głosowej i zamknij tryb nasłuchiwania w aplikacji mobilnej." +
      " Wywołaj to narzędzie WYŁĄCZNIE gdy użytkownik jednoznacznie prosi o zakończenie rozmowy głosowej" +
      " (np. 'koniec', 'zamknij chat', 'zamknij mikrofon', 'do widzenia', 'dziękuję, to tyle')." +
      " Jeśli nie masz 100% pewności — np. słowo 'koniec' pada w innym kontekście — poczekaj na powtórzenie." +
      " Gdy intencja jest jasna i bez wątpliwości, wywołaj od razu bez pytania o potwierdzenie.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  async execute(_input, ctx) {
    ctx.emit({ type: "CLOSE_VOICE_CHAT", actionType: "direct", payload: {} });
    return { ok: true };
  },
};

export default closeVoiceChatTool;
