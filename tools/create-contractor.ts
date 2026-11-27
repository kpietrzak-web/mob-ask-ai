import { apiUrl, type ToolDefinition } from "./types";

/**
 * Creates a contractor via the accounting API `/contractors` endpoint —
 * the same endpoint the mobile contractor form posts to.
 *
 * The model gathers the data (optionally prefilled from GUS via
 * get_company_by_nip) and MUST show the user a summary and get explicit
 * confirmation before calling this tool. The tool performs the write.
 */

/** Payment methods that keep a payment term (maturity); others clear it (mirrors the app). */
const PAYMENT_METHODS_WITH_MATURITY = ["transfer", "compensation"];

const ALREADY_ADDED_PATTERN = /^Contractor with nip .* and post code .* already exists!$/;
const WRONG_NIP_MESSAGES = [
  "Wprowadzony numer NIP jest niepoprawny",
  "Wprowadzony numer jest niepoprawny",
];

function extractMessages(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const b = body as { message?: unknown; messages?: unknown; errors?: unknown };
  const out: string[] = [];
  if (typeof b.message === "string") out.push(b.message);
  if (Array.isArray(b.messages)) out.push(...b.messages.filter((m): m is string => typeof m === "string"));
  if (Array.isArray(b.errors)) {
    for (const e of b.errors) {
      if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") {
        out.push((e as { message: string }).message);
      }
    }
  }
  return out;
}

const createContractorTool: ToolDefinition = {
  schema: {
    name: "create_contractor",
    description:
      "Utwórz (zapisz) nowego kontrahenta przez backend. To jest operacja ZAPISUJĄCA." +
      " WOLNO ją wywołać WYŁĄCZNIE po tym, jak pokażesz użytkownikowi pełne podsumowanie danych kontrahenta" +
      " i otrzymasz jednoznaczne potwierdzenie zapisu. Nigdy nie zapisuj bez wyraźnej zgody." +
      " Pola obowiązkowe: name, shortName, address.country, address.city, address.house, address.postCode," +
      " oraz address.street LUB address.postOffice (co najmniej jedno), paymentMethod, maturity, splitPayment." +
      " NIP jest wymagany dla polskich firm które nie są osobą fizyczną (privateIndividual=false)." +
      " Gdy dane pochodzą z GUS (get_company_by_nip) przekaż je tutaj 1:1." +
      " Jeśli operacja się powiedzie, zwróci contractorId — użyj go do akcji show_contractor." +
      " Przy błędzie (error) jasno poinformuj użytkownika i zaproponuj otwarcie formularza (open_contractor_form).",
    input_schema: {
      type: "object",
      properties: {
        name:              { type: "string", description: "Pełna nazwa kontrahenta (wymagane)" },
        shortName:         { type: "string", description: "Skrócona nazwa kontrahenta (wymagane)" },
        nip:               { type: "string", description: "NIP (wymagany dla polskich firm nie będących osobą fizyczną)" },
        regon:             { type: "string", description: "REGON" },
        taxIdVat:          { type: "string", description: "Zagraniczny numer VAT" },
        privateIndividual: { type: "boolean", description: "Czy kontrahent jest osobą fizyczną (domyślnie false)" },
        email:             { type: "string", description: "Adres e-mail" },
        phoneNumber:       { type: "string", description: "Numer telefonu" },
        officialEmail:     { type: "string", description: "Oficjalny adres e-mail do faktur" },
        province:          { type: "string", description: "Województwo" },
        recipientCode:     { type: "string", description: "Kod odbiorcy" },
        paymentMethod:     { type: "string", enum: ["cash", "transfer", "compensation"], description: "Metoda płatności (wymagane). Domyślnie cash." },
        maturity:          { type: "number", description: "Termin płatności w dniach (wymagane; domyślnie 14). Dla metody innej niż transfer/compensation zostanie wyzerowany." },
        splitPayment:      { type: "boolean", description: "Czy stosować split payment (wymagane). Dla metody cash wymuszane na false." },
        address: {
          type: "object",
          description: "Adres kontrahenta",
          properties: {
            country:    { type: "string", description: "Kod kraju, np. PL (wymagane)" },
            city:       { type: "string", description: "Miejscowość (wymagane)" },
            house:      { type: "string", description: "Numer domu (wymagane)" },
            postCode:   { type: "string", description: "Kod pocztowy (wymagane; dla PL format 00-000)" },
            street:     { type: "string", description: "Ulica (wymagane jeśli brak postOffice)" },
            local:      { type: "string", description: "Numer lokalu" },
            postOffice: { type: "string", description: "Poczta (wymagane jeśli brak ulicy)" },
          },
          required: ["country", "city", "house", "postCode"],
        },
      },
      required: ["name", "shortName", "paymentMethod", "maturity", "splitPayment", "address"],
    },
  },
  async execute(input, ctx) {
    const data = input as Record<string, unknown>;
    const paymentMethod = (data.paymentMethod as string) ?? "cash";
    const nip = data.nip ? String(data.nip).replace(/[\s-]/g, "") : "";

    // Mirror the app's normalization (ContractorPaymentAndReceiverScreen.handleFormSubmit):
    const maturity = PAYMENT_METHODS_WITH_MATURITY.includes(paymentMethod)
      ? Number(data.maturity ?? 14)
      : null;
    const splitPayment = paymentMethod === "cash" ? false : Boolean(data.splitPayment);

    const payload: Record<string, unknown> = {
      ...data,
      nip: nip || null,
      paymentMethod,
      maturity,
      splitPayment,
      // The app sends force=true when there is no NIP (skips duplicate check).
      force: !nip,
    };

    let res: Response;
    try {
      res = await fetch(apiUrl(ctx, "/contractors"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { success: false, error: "network", message: "Nie udało się połączyć z serwerem. Spróbuj ponownie." };
    }

    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }

    if (!res.ok) {
      const messages = extractMessages(body);
      if (messages.some((m) => ALREADY_ADDED_PATTERN.test(m))) {
        return { success: false, error: "already_exists", message: "Kontrahent o tym NIP i kodzie pocztowym już istnieje." };
      }
      if (messages.some((m) => WRONG_NIP_MESSAGES.includes(m))) {
        return { success: false, error: "invalid_nip", message: "Wprowadzony numer NIP jest niepoprawny." };
      }
      return { success: false, error: "api_error", message: messages[0] ?? "Nie udało się dodać kontrahenta." };
    }

    const contractorId = (body as { contractorId?: number } | null)?.contractorId;
    return {
      success: true,
      contractorId,
      name: data.name,
      shortName: data.shortName,
      nip: nip || undefined,
    };
  },
};

export default createContractorTool;
