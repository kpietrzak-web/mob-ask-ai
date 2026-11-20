import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { toolSchemas, executeTool } from "./tools";
import type { ApiContext } from "./tools/types";

const app = express();
app.use(express.json());

const client = new Anthropic();


function buildScreenContext(ctx: Record<string, unknown>): string {
  if (!ctx.screen) return "";
  const lines: string[] = [];
  switch (ctx.screen) {
    case "income_list":
      lines.push("Użytkownik aktualnie przegląda listę przychodów (faktur sprzedażowych).");
      break;
    case "income_detail":
      lines.push(`Użytkownik aktualnie przegląda przychód (fakturę) o ID ${ctx.incomeId}${ctx.incomeNumber ? ` (numer: ${ctx.incomeNumber})` : ""}.`);
      lines.push("Gdy użytkownik mówi 'ta faktura', 'tę fakturę', 'tej faktury', 'ten przychód' itp. — chodzi właśnie o ten dokument.");
      break;
    case "expense_list":
      lines.push("Użytkownik aktualnie przegląda listę kosztów.");
      break;
    case "expense_detail":
      lines.push(`Użytkownik aktualnie przegląda koszt o ID ${ctx.expenseId}${ctx.expenseNumber ? ` (numer: ${ctx.expenseNumber})` : ""}.`);
      lines.push("Gdy użytkownik mówi 'ten koszt', 'tego kosztu', 'ten dokument' itp. — chodzi właśnie o ten dokument.");
      break;
    case "dashboard":
      lines.push("Użytkownik aktualnie przegląda dashboard.");
      break;
    case "ksef":
      lines.push("Użytkownik aktualnie przegląda zakładkę KSeF.");
      break;
    case "inbox":
      lines.push("Użytkownik aktualnie przegląda zakładkę inbox.");
      break;
    case "contractor_detail":
      lines.push(`Użytkownik aktualnie przegląda kontrahenta o ID ${ctx.contractorId}${ctx.contractorName ? ` (nazwa: ${ctx.contractorName})` : ""}.`);
      lines.push("Gdy użytkownik mówi 'ten kontrahent', 'temu kontrahentowi' itp. — chodzi właśnie o tego kontrahenta.");
      break;
    default:
      lines.push(`Użytkownik aktualnie jest na ekranie: ${ctx.screen}.`);
  }
  return `[KONTEKST EKRANU: ${lines.join(" ")}]\n\n`;
}

app.post("/chat", async (req, res) => {
  // tu: sprawdź token użytkownika i limit wiadomości
  const token = (req.headers.authorization ?? "").replace("Bearer ", "");
  const apiUrl = (req.headers["x-api-url"] as string) ?? "";
  const screenContext = (() => {
    try { return JSON.parse((req.headers["x-screen-context"] as string) ?? "{}"); }
    catch { return {}; }
  })();
  const sse = {
    text:   (chunk: string) => res.write(`event: text\ndata: ${JSON.stringify(chunk)}\n\n`),
    action: (event: object) => res.write(`event: action\ndata: ${JSON.stringify(event)}\n\n`),
    done:   ()              => res.write(`event: done\ndata: [DONE]\n\n`),
  };
  const ctx: ApiContext = { token, apiUrl, emit: sse.action };

  const incoming: Anthropic.MessageParam[] = (req.body.messages as Anthropic.MessageParam[])
    .map(({ role, content }) => ({ role, content }));
  const latestUserMessage = incoming.at(-1)!;
  const screenLog = screenContext.screen
    ? `| screen: ${JSON.stringify(screenContext)}`
    : "";
  console.log("[user]", latestUserMessage?.content, "| token:", token, "| api:", apiUrl, screenLog);

  const messages: Anthropic.MessageParam[] = [...incoming];

  res.setHeader("Content-Type", "text/event-stream");

  let fullReply = "";
  let iteration = 0;

  try {
    while (true) {
      if (iteration++ > 0 && fullReply.length > 0) sse.text("\n\n");
      const stream = client.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          buildScreenContext(screenContext) +
          `Jesteś asystentem księgowym dla JDG w Polsce. Odpowiadaj zwięźle. Nigdy nie używaj tabel — zamiast nich` +
          ` stosuj listy. Listy kontrahentów, faktur i innych elementów zawsze numeruj, żeby użytkownik mógł się do nich` +
          ` odwoływać numerem lub nazwą (np. "wystaw fakturę dla kontrahenta 3" albo "dla Gabrieli"). Przyciski akcji w aplikacji są wyświetlane PONIŻEJ wiadomości — jeśli o nich wspominasz, pisz "poniżej", nigdy "powyżej". Aplikacja używa rozpoznawania mowy, więc` +
          ` traktuj fonetycznie podobne słowa jako księgowe terminy (np. "kontenerów"→"kontrahentów", "faktury"≈"fakturę" itp.).` +
          ` Jeśli nie znasz imienia użytkownika, użyj narzędzia` +
          ` get_user_info i możesz się do niego zwracać po imieniu(ale nie nadużywaj tego, raczej na początku rozmowy).` +
          ` Dzisiejsza data: ${new Date().toISOString().slice(0, 10)}.` +
          ` Nigdy nie pokazuj użytkownikowi wewnętrznych ID dokumentów (invoiceId, incomeId, expenseId itp.) — operuj wyłącznie na numerach dokumentów (np. A26/11/2026).` +
          ` Jeśli kontekst ekranu wskazuje na konkretny dokument (np. income_detail), a w historii rozmowy użytkownik operował` +
          ` na innym dokumencie o innym numerze — zapytaj o który chodzi, podając oba numery. Jeśli kontekst jest jednoznaczny` +
          ` (np. screen wskazuje dokument i user mówi "ten" / "tę" / "cofnij" bez wskazania innego) — działaj od razu, nie pytaj.` +
          ` Gdy użytkownik pyta o faktury walutowe lub w obcej walucie: pobierz wszystkie faktury bez filtra walutowego,` +
          ` następnie pobierz walutę firmy z get_user_info (pole company.currency) i odfiltruj faktury w tej walucie —` +
          ` pozostałe to faktury walutowe. Nie zgaduj walut ani nie wysyłaj osobnych zapytań per waluta.` +
          ` Gdy użytkownik zadaje szerokie pytanie o faktury bez określonego zakresu dat (np. "pokaż wszystkie faktury",` +
          ` "faktury walutowe" itp.) — zanim pobierzesz dane, ostrzeż go że może mieć dużo faktur i zapytaj` +
          ` o przedział czasowy (np. bieżący miesiąc, poprzedni miesiąc, bieżący rok). Nie ustawiaj losowego offsetu —` +
          ` zawsze zaczynaj od offset=0.` +
          ` Gdy użytkownik chce wystawić fakturę dla konkretnego kontrahenta: najpierw wywołaj get_contractors i sprawdź` +
          ` czy ten kontrahent istnieje (po nazwie lub NIP). Jeśli kontrahent NIE ISTNIEJE — nie otwieraj formularza` +
          ` faktury bezpośrednio, lecz wyślij DWIE akcje suggested: najpierw open_contractor_form (suggested) z danymi` +
          ` kontrahenta, a następnie open_income_form (suggested) z danymi faktury jakie znasz (bez contractorId).` +
          ` Wyjaśnij użytkownikowi że kontrahent nie został znaleziony i zaproponuj obie akcje.`,
        tools: toolSchemas,
        messages,
      });

      stream.on("text", (t) => {
        fullReply += t;
        sse.text(t);
      });

      const finalMsg = await stream.finalMessage();

      if (finalMsg.stop_reason !== "tool_use") {
        console.log("[agent]", fullReply);
        sse.done();
        res.end();
        break;
      }

      messages.push({ role: "assistant", content: finalMsg.content });

      const toolResults = await Promise.all(
        finalMsg.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map(async (b) => {
            console.log(`[tool] ${b.name}`, Object.keys(b.input).length ? b.input : "");
            const result = await executeTool(b.name, b.input as Record<string, unknown>, ctx);
            console.log(`[tool] ${b.name} → done`);
            return {
              type: "tool_result" as const,
              tool_use_id: b.id,
              content: JSON.stringify(result),
            };
          })
      );

      messages.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    console.error("[error]", err);
    res.end();
  }
});

app.delete("/chat", (_req, res) => res.sendStatus(204));

app.listen(3000);
