import type { ToolDefinition } from "./types";

const openInvoiceFormTool: ToolDefinition = {
  schema: {
    name: "open_income_form",
    description:
      "Otwórz formularz wystawiania faktury w aplikacji mobilnej z wypełnionymi danymi." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o wystawienie faktury (np. 'wystaw fakturę dla XXX')." +
      " Użyj actionType='suggested' gdy kontrahent nie istnieje w bazie — wtedy ta akcja powinna być wysłana razem z" +
      " open_contractor_form (suggested), żeby użytkownik mógł najpierw dodać kontrahenta, a potem fakturę." +
      " W label podaj krótki opis, np. 'Wystaw fakturę'. Podaj tyle danych faktury ile znasz z wypowiedzi użytkownika.",
    input_schema: {
      type: "object",
      properties: {
        actionType:      { type: "string", enum: ["direct", "suggested"], description: "'direct' — natychmiast otwiera formularz (tylko gdy user wydał wyraźne polecenie); 'suggested' — pokazuje przycisk z propozycją" },
        label:           { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Wystaw fakturę'" },
        icon:            { type: "string", description: "Opcjonalna nazwa ikony Font Awesome 5 Free, np. 'file-invoice'" },

        // === POLA WYMAGAJĄCE ID Z API — NIE wysyłaj tekstu/nazwy zamiast ID ===
        contractorId:    { type: "number", description: "ID kontrahenta — pole 'id' z wyników get_contractors. Wywołaj get_contractors i użyj id pasującego rekordu. Bez tego pola kontrahent pozostanie pusty." },
        receiverId:      { type: "number", description: "ID odbiorcy (jeśli inny niż kontrahent) — pole 'id' z wyników get_contractors." },
        bankAccountId:   { type: "number", description: "ID konta bankowego — pole 'id' z wyników get_bank_accounts. Pomijaj jeśli user nie wskazał konkretnego konta." },
        sequenceId:      { type: "number", description: "ID sekwencji numeracji — pole 'id' z wyników get_invoice_sequences. Pomijaj jeśli user nie wskazał konkretnej sekwencji." },

        // === ENUMERACJE — tylko te wartości są akceptowane ===
        paymentMethod:   { type: "string", enum: ["transfer", "cash", "cash_register"], description: "Metoda płatności. Dozwolone wartości: transfer, cash, cash_register." },
        calculationType: { type: "string", enum: ["N", "G"], description: "Tryb obliczania: 'N' = od kwoty netto, 'G' = od kwoty brutto." },

        // === POLA TEKSTOWE / DATY ===
        issueDate:       { type: "string", description: "Data wystawienia (YYYY-MM-DD). Domyślnie: dzisiaj." },
        saleDate:        { type: "string", description: "Data sprzedaży (YYYY-MM-DD). Domyślnie: dzisiaj." },
        paymentDeadline: { type: "string", description: "Termin płatności (YYYY-MM-DD)." },
        currency:        { type: "string", description: "Kod waluty ISO 4217, np. PLN, EUR, USD." },
        description:     { type: "string", description: "Opis/tytuł faktury (tekst)." },
        comments:        { type: "string", description: "Uwagi do faktury (tekst)." },

        items: {
          type: "array",
          description: "Pozycje na fakturze. Każda pozycja to osobna linia.",
          items: {
            type: "object",
            properties: {
              name:     { type: "string", description: "Nazwa usługi/towaru. NIE wpisuj tu nazwy firmy/kontrahenta." },
              quantity: { type: "number", description: "Ilość. Domyślnie: 1." },
              unit:     { type: "string", description: "Jednostka miary (wolny tekst), np. szt., godz., usł., kg." },
              unitNet:  { type: "number", description: "Cena jednostkowa netto." },
              taxRate:  { type: "number", description: "Stawka VAT: -2 = NP, -1 = ZW, 0 = 0%, 5 = 5%, 8 = 8%, 23 = 23%." },
            },
          },
        },
      },
      required: ["actionType"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, icon, ...payload } = input as Record<string, unknown>;
    ctx.emit({ type: "open_income_form", actionType, label, icon, payload });
    return { success: true };
  },
};

export default openInvoiceFormTool;
