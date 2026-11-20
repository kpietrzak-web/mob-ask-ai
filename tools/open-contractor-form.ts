import type { ToolDefinition } from "./types";

const openContractorFormTool: ToolDefinition = {
  schema: {
    name: "open_contractor_form",
    description: "Otwórz formularz dodawania kontrahenta w aplikacji mobilnej z wypełnionymi danymi." +
      " Użyj actionType='direct' gdy użytkownik jawnie prosi o dodanie kontrahenta (np. 'dodaj kontrahenta XXX', 'utwórz nowego kontrahenta')." +
      " Użyj actionType='suggested' gdy użytkownik pyta czy coś istnieje i okazuje się że nie (np. 'czy mam kontrahenta XXX?' → brak → zaproponuj dodanie)." +
      " W label podaj krótki opis akcji widoczny na przycisku, np. 'Dodaj Jana Kowalskiego'.",
    input_schema: {
      type: "object",
      properties: {
        actionType:      { type: "string", enum: ["direct", "suggested"], description: "'direct' — natychmiast otwiera formularz; 'suggested' — pokazuje przycisk z propozycją" },
        label:           { type: "string", description: "Tekst przycisku dla akcji suggested, np. 'Dodaj kontrahenta Jan Kowalski'" },
        icon:            { type: "string", description: "Opcjonalna nazwa ikony z Font Awesome 5 Free, np. 'user-plus', 'building', 'address-card'" },
        nip:             { type: "string",  description: "NIP kontrahenta" },
        regon:           { type: "string",  description: "REGON kontrahenta" },
        taxIdVat:        { type: "string",  description: "Zagraniczny numer VAT" },
        shortName:       { type: "string",  description: "Skrócona nazwa kontrahenta" },
        name:            { type: "string",  description: "Pełna nazwa kontrahenta" },
        phoneNumber:     { type: "string",  description: "Numer telefonu" },
        email:           { type: "string",  description: "Adres e-mail" },
        officialEmail:   { type: "string",  description: "Oficjalny adres e-mail do faktur" },
        privateIndividual: { type: "boolean", description: "Czy kontrahent jest osobą fizyczną" },
        paymentMethod:   { type: "string",  description: "Domyślna metoda płatności" },
        splitPayment:    { type: "boolean", description: "Czy stosować split payment" },
        maturity:        { type: "string",  description: "Termin płatności (np. '14', '30')" },
        province:        { type: "string",  description: "Województwo" },
        recipientCode:   { type: "string",  description: "Kod odbiorcy" },
        address: {
          type: "object",
          description: "Adres kontrahenta",
          properties: {
            street:     { type: "string" },
            house:      { type: "string" },
            local:      { type: "string" },
            city:       { type: "string" },
            postCode:   { type: "string" },
            postOffice: { type: "string" },
            country:    { type: "string", description: "Kod kraju, np. PL, DE" },
          },
        },
      },
      required: ["actionType"],
    },
  },
  async execute(input, ctx) {
    const { actionType, label, icon, ...payload } = input as Record<string, unknown>;
    ctx.emit({ type: "open_contractor_form", actionType, label, icon, payload });
    return { success: true };
  },
};

export default openContractorFormTool;
