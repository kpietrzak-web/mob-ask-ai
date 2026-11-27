import { apiUrl, type ToolDefinition, type ApiContext } from "./types";
import { computeItem, computeTotals, type CalculationType, type InvoiceItemInput } from "./invoiceCalc";

/**
 * Issues (or previews) a sales invoice via the accounting API `POST /invoices` —
 * the same endpoint and payload the mobile invoice form uses.
 *
 * Two-phase by design (enforces "no write without explicit confirmation"):
 *   confirmed=false → compute net/VAT/gross + totals + anticipated number, return
 *                     a summary for the user to review. NOTHING is written.
 *   confirmed=true  → same computation, then POST the invoice. Only allowed AFTER
 *                     the user explicitly confirmed the summary.
 *
 * All amounts are computed in code (invoiceCalc.ts), never by the model.
 */

const PAYMENT_METHODS_REQUIRING_BANK = ["transfer", "compensation"];

interface BankAccount { id: number; default?: boolean; deleted?: boolean; }

function extractMessages(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const b = body as { message?: unknown; messages?: unknown; errors?: unknown };
  const out: string[] = [];
  if (typeof b.message === "string") out.push(b.message);
  if (Array.isArray(b.messages)) out.push(...b.messages.filter((m): m is string => typeof m === "string"));
  if (Array.isArray(b.errors)) {
    for (const e of b.errors) {
      if (e && typeof e === "object") {
        const eo = e as { message?: unknown; code?: unknown };
        if (typeof eo.message === "string") out.push(eo.message);
        if (typeof eo.code === "string") out.push(eo.code);
      }
    }
  }
  return out;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolveBankAccountId(ctx: ApiContext, paymentMethod: string, provided?: number): Promise<number | null> {
  if (!PAYMENT_METHODS_REQUIRING_BANK.includes(paymentMethod)) return null;
  if (provided != null) return provided;
  // Auto-select like the app: the default account, or the sole non-deleted one.
  try {
    const res = await fetch(apiUrl(ctx, "/bank-accounts"), { headers: { Authorization: `Bearer ${ctx.token}` } });
    const body = (await res.json()) as { accounts?: BankAccount[] };
    const accounts = (body.accounts ?? []).filter((a) => !a.deleted);
    const def = accounts.find((a) => a.default) ?? (accounts.length === 1 ? accounts[0] : undefined);
    return def?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchNextNumber(ctx: ApiContext, date: string, sequenceId: number): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({ date, sequenceId: String(sequenceId) });
    const res = await fetch(`${apiUrl(ctx, "/invoices/next-number")}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { number?: string };
    return body.number;
  } catch {
    return undefined;
  }
}

const createInvoiceTool: ToolDefinition = {
  schema: {
    name: "create_invoice",
    description:
      "Wystaw (lub podejrzyj) fakturę sprzedażową przez backend. To ten sam endpoint co formularz w aplikacji." +
      " DZIAŁA DWUFAZOWO: najpierw wywołaj z confirmed=false — narzędzie policzy netto/VAT/brutto, sumy oraz" +
      " przewidywany numer i zwróci podsumowanie BEZ zapisu. Pokaż użytkownikowi to BARDZO dokładne podsumowanie" +
      " i poproś o wyraźne potwierdzenie. DOPIERO po jednoznacznym potwierdzeniu wywołaj ponownie z confirmed=true," +
      " co faktycznie wystawi fakturę. NIGDY nie ustawiaj confirmed=true bez wcześniejszego potwierdzenia." +
      " Kwoty liczy to narzędzie, nie Ty — podaj tylko dane wejściowe pozycji (ilość, cena jednostkowa, stawka VAT)." +
      " contractorId pochodzi z get_contractors (pole id). Dla metody transfer/compensation konto bankowe zostanie" +
      " dobrane automatycznie (domyślne lub jedyne), chyba że podasz bankAccountId." +
      " Po sukcesie zwróci invoiceId i number — użyj ich do akcji open_income (Pokaż fakturę) i download_income_pdf" +
      " (Pobierz PDF). Przy błędzie (error) poinformuj i zaproponuj open_income_form z zebranymi danymi.",
    input_schema: {
      type: "object",
      properties: {
        confirmed:       { type: "boolean", description: "false = podgląd/podsumowanie bez zapisu; true = wystaw fakturę (tylko po potwierdzeniu użytkownika)" },
        status:          { type: "string", enum: ["accounted", "entered"], description: "'accounted' = wystaw fakturę (domyślnie), 'entered' = zapisz jako szkic" },
        contractorId:    { type: "number", description: "ID kontrahenta (pole id z get_contractors) — wymagane" },
        receiverId:      { type: "number", description: "ID odbiorcy jeśli inny niż kontrahent (domyślny odbiorca kontrahenta)" },
        calculationType: { type: "string", enum: ["N", "G"], description: "'N' = ceny pozycji netto, 'G' = ceny pozycji brutto. Domyślnie N." },
        paymentMethod:   { type: "string", enum: ["transfer", "cash", "compensation"], description: "Metoda płatności (domyślnie z kontrahenta)" },
        bankAccountId:   { type: "number", description: "ID konta bankowego (pole id z get_bank_accounts). Można pominąć — dobierze się automatycznie dla transfer/compensation." },
        splitPayment:    { type: "boolean", description: "Split payment (domyślnie z kontrahenta)" },
        issueDate:       { type: "string", description: "Data wystawienia YYYY-MM-DD (domyślnie dziś)" },
        saleDate:        { type: "string", description: "Data sprzedaży YYYY-MM-DD (domyślnie = data wystawienia)" },
        paymentDeadline: { type: "string", description: "Termin płatności YYYY-MM-DD. Jeśli pominiesz, policzy się z issueDate + maturityDays." },
        maturityDays:    { type: "number", description: "Liczba dni terminu płatności z kontrahenta (np. 14), użyta gdy brak paymentDeadline" },
        sequenceId:      { type: "number", description: "ID sekwencji numeracji (get_invoice_sequences). Numer zostanie nadany automatycznie." },
        number:          { type: "string", description: "Ręczny numer faktury — tylko gdy NIE podano sequenceId" },
        currency:        { type: "string", description: "Kod waluty ISO 4217 (domyślnie waluta firmy z get_user_info)" },
        exchangeRate:    { type: "number", description: "Kurs waluty (1 dla waluty bazowej)" },
        factor:          { type: "number", description: "Przelicznik waluty (1 dla waluty bazowej)" },
        comments:        { type: "string", description: "Uwagi do faktury" },
        items: {
          type: "array",
          description: "Pozycje faktury. Kwoty policzy narzędzie.",
          items: {
            type: "object",
            properties: {
              name:      { type: "string", description: "Nazwa usługi/towaru (NIE nazwa kontrahenta)" },
              quantity:  { type: "number", description: "Ilość (domyślnie 1)" },
              unitPrice: { type: "number", description: "Cena jednostkowa — netto dla calculationType=N, brutto dla G" },
              taxRate:   { type: "number", description: "Stawka VAT: -2=NP, -1=ZW, 0, 5, 8, 23" },
              unit:      { type: "string", description: "Jednostka miary, np. szt., godz., usł." },
            },
            required: ["name", "unitPrice", "taxRate"],
          },
        },
      },
      required: ["contractorId", "items"],
    },
  },
  async execute(input, ctx) {
    const data = input as Record<string, unknown>;
    const confirmed = data.confirmed === true;
    const status = (data.status as string) === "entered" ? "entered" : "accounted";
    const calculationType = ((data.calculationType as string) === "G" ? "G" : "N") as CalculationType;
    const contractorId = Number(data.contractorId);
    const rawItems = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];

    if (!contractorId) return { error: "missing_contractor", message: "Brak kontrahenta (contractorId)." };
    if (rawItems.length === 0) return { error: "missing_items", message: "Faktura musi mieć co najmniej jedną pozycję." };

    const items = rawItems.map((it) =>
      computeItem(calculationType, {
        name: String(it.name ?? ""),
        quantity: Number(it.quantity ?? 1),
        unitPrice: Number(it.unitPrice ?? 0),
        taxRate: Number(it.taxRate ?? 0),
        unit: it.unit as string | undefined,
      } as InvoiceItemInput)
    );
    const totals = computeTotals(items, calculationType);

    const issueDate = (data.issueDate as string) || today();
    const saleDate = (data.saleDate as string) || issueDate;
    const paymentDeadline =
      (data.paymentDeadline as string) ||
      (data.maturityDays != null ? addDays(issueDate, Number(data.maturityDays)) : issueDate);
    const paymentMethod = (data.paymentMethod as string) || "transfer";
    const splitPayment = Boolean(data.splitPayment);
    const sequenceId = data.sequenceId != null ? Number(data.sequenceId) : null;
    const bankAccountId = await resolveBankAccountId(ctx, paymentMethod, data.bankAccountId != null ? Number(data.bankAccountId) : undefined);

    // Number: from the sequence (anticipated/assigned) or the manual value.
    const number = sequenceId != null
      ? await fetchNextNumber(ctx, issueDate, sequenceId)
      : (data.number as string | undefined);

    const currency = {
      code: (data.currency as string) || undefined,
      exchangeRate: Number(data.exchangeRate ?? 1),
      factor: Number(data.factor ?? 1),
      date: issueDate,
    };

    const summary = {
      status,
      contractorId,
      receiverId: data.receiverId != null ? Number(data.receiverId) : undefined,
      number,
      sequenceId,
      issueDate,
      saleDate,
      paymentDeadline,
      paymentMethod,
      bankAccountId,
      splitPayment,
      currency,
      calculationType,
      comments: data.comments as string | undefined,
      items,
      totals,
    };

    if (!confirmed) {
      return { preview: true, summary };
    }

    // --- confirmed write ---
    const payload: Record<string, unknown> = {
      additionalData: null,
      bankAccountId,
      calculationType,
      comments: data.comments,
      contractorId,
      issueDate,
      number: sequenceId == null ? number : undefined,
      paymentDeadline,
      paymentMethod,
      receiverId: summary.receiverId,
      saleDate,
      splitPayment,
      status,
      currency,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        taxRate: i.taxRate,
        unitNet: i.unitNet,
        net: i.net,
        gross: i.gross,
      })),
      sequenceId,
    };

    let res: Response;
    try {
      res = await fetch(apiUrl(ctx, "/invoices"), {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      return { success: false, error: "network", message: "Nie udało się połączyć z serwerem. Spróbuj ponownie.", summary };
    }

    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }

    if (!res.ok) {
      const messages = extractMessages(body);
      if (messages.includes("contractor_not_found")) {
        return { success: false, error: "contractor_not_found", message: "Nie znaleziono kontrahenta.", summary };
      }
      if (messages.includes("accounting_period_closed")) {
        return { success: false, error: "accounting_period_closed", message: "Okres księgowy jest zamknięty — nie można wystawić faktury z tą datą.", summary };
      }
      if (messages.some((m) => m.includes("Dokument o podanym numerze już istnieje"))) {
        return { success: false, error: "number_taken", message: "Dokument o podanym numerze już istnieje.", summary };
      }
      return { success: false, error: "api_error", message: messages[0] ?? "Nie udało się wystawić faktury.", summary };
    }

    const invoiceId = (body as { invoiceId?: number } | null)?.invoiceId;
    return { success: true, invoiceId, number, status, summary };
  },
};

export default createInvoiceTool;
