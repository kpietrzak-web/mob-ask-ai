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
        actionType:      { type: "string", enum: ["direct", "suggested"], description: "'direct' — natychmiast otwiera formularz; 'suggested' — pokazuje przycisk z propozycją" },
        label:           { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Wystaw fakturę'" },
        icon:            { type: "string", description: "Opcjonalna nazwa ikony z Font Awesome 5 Free, np. 'file-invoice', 'file-alt'" },
        contractorId:    { type: "number", description: "Pole 'id' z wyników get_contractors — zawsze szukaj kontrahenta i używaj jego id zamiast nazwy" },
        contractorName:  { type: "string", description: "Nazwa kontrahenta — TYLKO gdy nie udało się znaleźć contractorId" },
        contractorNip:   { type: "string", description: "NIP kontrahenta — TYLKO gdy nie udało się znaleźć contractorId" },
        issueDate:       { type: "string", description: "Data wystawienia (YYYY-MM-DD)" },
        saleDate:        { type: "string", description: "Data sprzedaży (YYYY-MM-DD)" },
        currency:        { type: "string", description: "Waluta, np. PLN, EUR" },
        paymentMethod:   { type: "string", description: "Metoda płatności: transfer, cash, compensation, credit_card, cash_register" },
        paymentDeadline: { type: "string", description: "Termin płatności (YYYY-MM-DD)" },
        templateId:      { type: "number", description: "ID szablonu faktury" },
        bankAccountId:   { type: "number", description: "ID konta bankowego" },
        comments:        { type: "string", description: "Uwagi do faktury" },
        items: {
          type: "array",
          description: "Pozycje na fakturze",
          items: {
            type: "object",
            properties: {
              name:     { type: "string", description: "Nazwa usługi/towaru" },
              quantity: { type: "number", description: "Ilość" },
              unit:     { type: "string", description: "Jednostka miary, np. szt., godz." },
              unitNet:  { type: "number", description: "Cena jednostkowa netto" },
              taxRate:  { type: "number", description: "Stawka VAT w % (np. 23, 8, 0)" },
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
