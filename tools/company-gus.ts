import { apiUrl, type ToolDefinition } from "./types";

/**
 * Raw shape returned by the accounting API `/contractors/data` endpoint
 * (the same endpoint the mobile contractor form uses to prefill from GUS).
 */
interface GusRawResponse {
  shortName?: string;
  name?: string;
  phone?: string;
  email?: string;
  regon?: string;
  privateIndividual?: boolean;
  addressStreet?: string;
  addressHouse?: string;
  addressLocal?: string;
  postCode?: string;
  city?: string;
  postOffice?: string;
  addressCountry?: string;
}

/** Error messages the API returns for an incorrect NIP (mirrors the app). */
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

const companyGusTool: ToolDefinition = {
  schema: {
    name: "get_company_by_nip",
    description:
      "Pobierz dane firmy z rejestru GUS na podstawie numeru NIP (ten sam endpoint, którego używa formularz" +
      " dodawania kontrahenta w aplikacji). Użyj gdy użytkownik poda NIP kontrahenta, którego chce dodać." +
      " Zwraca nazwę, adres, REGON i inne dane do uzupełnienia kontrahenta." +
      " Obsługuje błędy: nieprawidłowy NIP (found=false, error='invalid_nip')," +
      " brak firmy w rejestrze (found=false, error='not_found')," +
      " niedostępność usługi GUS (found=false, error='gus_unavailable')." +
      " Gdy found=false, poinformuj użytkownika o konkretnej przyczynie i poproś o poprawny NIP" +
      " lub zaproponuj ręczne podanie danych.",
    input_schema: {
      type: "object",
      properties: {
        nip: { type: "string", description: "NIP kontrahenta (10 cyfr, można podać ze spacjami/myślnikami — zostaną usunięte)" },
        country: { type: "string", description: "Kod kraju, domyślnie PL" },
      },
      required: ["nip"],
    },
  },
  async execute(input, ctx) {
    const { nip, country } = input as { nip?: string; country?: string };
    const taxId = String(nip ?? "").replace(/[\s-]/g, "");
    if (!taxId) {
      return { found: false, error: "invalid_nip", message: "Nie podano numeru NIP." };
    }

    const params = new URLSearchParams({ taxId });
    if (country) params.set("country", country);

    let res: Response;
    try {
      res = await fetch(`${apiUrl(ctx, "/contractors/data")}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${ctx.token}` },
      });
    } catch {
      return { found: false, error: "gus_unavailable", message: "Usługa GUS jest chwilowo niedostępna. Spróbuj ponownie później." };
    }

    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }

    if (!res.ok) {
      const messages = extractMessages(body);
      if (messages.some((m) => WRONG_NIP_MESSAGES.includes(m))) {
        return { found: false, error: "invalid_nip", message: "Wprowadzony numer NIP jest niepoprawny." };
      }
      if (res.status === 404) {
        return { found: false, error: "not_found", message: "Nie znaleziono firmy o podanym NIP w rejestrze." };
      }
      return { found: false, error: "gus_unavailable", message: "Nie udało się pobrać danych z GUS. Spróbuj ponownie później." };
    }

    const data = (body ?? {}) as GusRawResponse;
    if (!data.name && !data.shortName) {
      return { found: false, error: "not_found", message: "Nie znaleziono firmy o podanym NIP w rejestrze." };
    }

    return {
      found: true,
      company: {
        nip: taxId,
        shortName: data.shortName,
        name: data.name,
        phoneNumber: data.phone,
        email: data.email,
        regon: data.regon,
        privateIndividual: data.privateIndividual ?? false,
        address: {
          street: data.addressStreet,
          house: data.addressHouse,
          local: data.addressLocal,
          postCode: data.postCode,
          city: data.city,
          postOffice: data.postOffice,
          country: data.addressCountry ?? country ?? "PL",
        },
      },
    };
  },
};

export default companyGusTool;
