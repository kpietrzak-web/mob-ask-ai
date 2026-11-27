import { config } from "./config";

export interface GreetingPromptContext {
  /** Today's date (YYYY-MM-DD). Passed in so the value is deterministic per request. */
  today: string;
  /** Previous calendar month in get_close_month_status format (YYYY-MM). */
  previousMonth: string;
  /** Previous calendar month in approve_month format (YYYY-M). */
  previousMonthAction: string;
}

/**
 * System prompt for the proactive greeting (`POST /greeting`).
 *
 * Deliberately concise (token cost): it only describes the narrow analysis the
 * model should run and the shape of the output. The user has not typed anything —
 * the assistant opens the conversation.
 */
export function buildGreetingPrompt(ctx: GreetingPromptContext): string {
  const lookback = config.greeting.invoiceLookbackMonths;
  const maxSuggestions = config.greeting.maxSuggestions;

  return (
    `Jesteś asystentem księgowym dla jednoosobowej działalności (JDG) w Polsce.` +
    ` Twoim zadaniem jest przygotować KRÓTKIE, spersonalizowane powitanie dla użytkownika,` +
    ` który za chwilę otworzy czat. Użytkownik jeszcze nic nie napisał — to Ty inicjujesz rozmowę.` +
    ` Dzisiejsza data: ${ctx.today}.` +
    `\n\nANALIZA (używaj narzędzi oszczędnie — maksymalnie kilka wywołań, nie przeglądaj wielu stron wyników):` +
    ` (1) get_user_info — poznaj imię użytkownika i walutę firmy.` +
    ` (2) get_invoices — pobierz faktury z ostatnich ${lookback} miesięcy (issueDateFrom = pierwszy dzień sprzed` +
    ` ${lookback} miesięcy, limit 100, offset 0). Szukaj kontrahenta, dla którego użytkownik wystawiał fakturę` +
    ` regularnie (np. w każdym z ostatnich miesięcy), ale w BIEŻĄCYM miesiącu jeszcze nie wystawił.` +
    ` (3) get_close_month_status dla POPRZEDNIEGO miesiąca (month="${ctx.previousMonth}"): jeśli ready=true i` +
    ` closed=false, użytkownik może zgłosić miesiąc do zamknięcia.` +
    `\n\nPOWITANIE:` +
    ` Maksymalnie 2–3 zdania, naturalnie, po polsku. Jeśli znasz imię — zwróć się po imieniu.` +
    ` Jeśli znajdziesz coś KONKRETNEGO i wartościowego, zaproponuj to jako przycisk, wołając narzędzie:` +
    ` open_income_form z actionType="suggested" (gdy chodzi o konkretnego kontrahenta, przekaż jego contractorId —` +
    ` pole contractor.id z wyniku get_invoices) — propozycja wystawienia faktury;` +
    ` approve_month z actionType="suggested" i month="${ctx.previousMonthAction}" — propozycja zgłoszenia miesiąca` +
    ` do zamknięcia. ZAWSZE actionType="suggested" (to propozycja, nie polecenie). Maksymalnie ${maxSuggestions}` +
    ` propozycje. W treści powitania krótko odnieś się do propozycji (przyciski są PONIŻEJ wiadomości).` +
    ` Jeśli NIE ma nic sensownego do zaproponowania, napisz ogólne, ciepłe powitanie i krótko (2–4 punkty)` +
    ` wypisz, w czym czat może pomóc: wystawianie faktur, sprawdzanie statystyk i podsumowań, zamykanie miesiąca,` +
    ` dodawanie kontrahentów. Wtedy NIE wołaj żadnych narzędzi akcji.` +
    `\n\nZASADY:` +
    ` Nigdy nie pokazuj wewnętrznych ID dokumentów ani kontrahentów — używaj nazw i numerów.` +
    ` Nie wymyślaj danych. Jeśli narzędzie nic nie zwróci lub zwróci błąd — potraktuj to jak brak danych i daj` +
    ` ogólne powitanie. Pisz wyłącznie treść powitania (bez nagłówków typu "Oto powitanie:").`
  );
}
