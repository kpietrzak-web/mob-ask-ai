import { apiUrl, type ToolDefinition } from "./types";

export type InvoiceStatus = "entered" | "accounted" | "contra_entry" | "corrected";
export type KsefStatus =
  | "ready_to_send" | "new" | "processing" | "accepted" | "error"
  | "error_api" | "processing_error_api" | "error_system" | "processing_error_system"
  | "in_control" | "upo" | "downloaded";
export type PaymentMethod = "transfer" | "cash" | "compensation" | "credit_card" | "cash_register";

export interface InvoiceParty {
  id: number;
  nip: string;
  shortName: string;
  name: string;
  address: {
    street: string;
    house: string;
    local: string;
    city: string;
    postCode: string;
    postOffice: string;
    country: string;
  };
  phoneNumber: string;
  cellNumber: string;
  email: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitNet: number;
  net: number;
  taxRate: number;
  gross: number;
  notTaxable: boolean;
  additionalData: string;
  tax: number;
  vatDismissalType: string;
  asset: { id: number; name: string };
  contractor: { id: number; name: string };
  partner: { id: number; name: string };
  vehicle: { id: number; name: string };
  pkwiu: string;
  nkup: boolean;
  categoryId: number;
  categoryName: string;
  unit: string;
  gtu: string;
  transactionType: string;
}

export interface Invoice {
  id: number;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  saleDate: string;
  creationDate: string;
  lastUpdateDate: string;
  paymentMethod: PaymentMethod;
  paymentDeadline: string;
  bankAccountId: number;
  splitPayment: boolean;
  amountPaid: number;
  amountToPay: number;
  comments: string;
  items: InvoiceItem[];
  currency: string;
  exchangeRate: { factor: number; rate: number; date: string };
  net: number;
  tax: number;
  gross: number;
  contractor: InvoiceParty;
  receiver: InvoiceParty;
  template: { id: number; name: string; description: string; code: string; type: string };
  calculationType: string;
  transactionDescription: string;
  ksefStatus: KsefStatus;
  ksefErrorInfo: string;
  templateId: number;
  correctionVatDate: string;
  correctionReason: string;
  sourceDocumentId: number;
  correctionPitDate: string;
  availableActions: { canUnaccount: boolean };
  taxStamp: number;
  externalDocumentType: string;
  paymentVatType: string;
  summaryCalculator: string;
  additionalData: string;
  sdiStatus: string;
  eInvoice: boolean;
  commentStatus: string;
  type: string;
  sequenceId: number;
  correction: boolean;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  links: { current: string; next: string; prev: string; last: string };
}

export interface InvoicesParams {
  limit?: number;
  offset?: number;
  search?: string;
  id?: number;
  currency?: string;
  status?: InvoiceStatus[];
  contractorId?: number;
  issueDateFrom?: string;
  issueDateTo?: string;
  grossMin?: number;
  grossMax?: number;
  isPaid?: boolean;
  isKsef?: boolean;
  ksefStatus?: KsefStatus[];
  paymentMethod?: PaymentMethod[];
}

const invoicesTool: ToolDefinition = {
  schema: {
    name: "get_invoices",
    description: "Pobierz listę faktur sprzedażowych użytkownika. Obsługuje filtrowanie po dacie, statusie, kwocie, kontrahencie i innych parametrach.",
    input_schema: {
      type: "object",
      properties: {
        limit:          { type: "number", description: "Liczba wyników na stronę" },
        offset:         { type: "number", description: "Pominięcie pierwszych N wyników" },
        search:         { type: "string", description: "Wyszukiwanie po numerze faktury lub nazwie kontrahenta" },
        id:             { type: "number", description: "ID faktury" },
        currency:       { type: "string", description: "Waluta, np. PLN, EUR" },
        status:         { type: "array", items: { type: "string", enum: ["entered", "accounted", "contra_entry", "corrected"] }, description: "Filtruj po statusie faktury" },
        contractorId:   { type: "number", description: "ID kontrahenta" },
        issueDateFrom:  { type: "string", description: "Data wystawienia od (YYYY-MM-DD)" },
        issueDateTo:    { type: "string", description: "Data wystawienia do (YYYY-MM-DD)" },
        grossMin:       { type: "number", description: "Minimalna kwota brutto" },
        grossMax:       { type: "number", description: "Maksymalna kwota brutto" },
        isPaid:         { type: "boolean", description: "Czy faktura jest opłacona" },
        isKsef:         { type: "boolean", description: "Czy faktura jest w KSeF" },
        ksefStatus:     { type: "array", items: { type: "string", enum: ["ready_to_send", "new", "processing", "accepted", "error", "error_api", "processing_error_api", "error_system", "processing_error_system", "in_control", "upo", "downloaded"] }, description: "Filtruj po statusie KSeF" },
        paymentMethod:  { type: "array", items: { type: "string", enum: ["transfer", "cash", "compensation", "credit_card", "cash_register"] }, description: "Filtruj po metodzie płatności" },
      },
      required: [],
    },
  },
  async execute(input, ctx) {
    const params = input as InvoicesParams;
    const qs = new URLSearchParams();

    qs.set("sort[issueDate]", "DESC");
    qs.set("sort[creationDate]", "DESC");

    if (params.limit !== undefined)       qs.set("limit", String(params.limit));
    if (params.offset !== undefined)      qs.set("offset", String(params.offset));
    if (params.search)                    qs.set("search", params.search);
    if (params.id !== undefined)          qs.set("id", String(params.id));
    if (params.currency)                  qs.set("currency", params.currency);
    if (params.contractorId !== undefined) qs.set("contractorId", String(params.contractorId));
    if (params.issueDateFrom)             qs.set("issueDateFrom", params.issueDateFrom);
    if (params.issueDateTo)               qs.set("issueDateTo", params.issueDateTo);
    if (params.grossMin !== undefined)    qs.set("grossMin", String(params.grossMin));
    if (params.grossMax !== undefined)    qs.set("grossMax", String(params.grossMax));
    if (params.isPaid !== undefined)      qs.set("isPaid", String(params.isPaid));
    if (params.isKsef !== undefined)      qs.set("isKsef", String(params.isKsef));

    params.status?.forEach((s) => qs.append("status[]", s));
    params.ksefStatus?.forEach((s) => qs.append("ksefStatus[]", s));
    params.paymentMethod?.forEach((s) => qs.append("paymentMethod[]", s));

    const url = `${apiUrl(ctx, "/invoices")}?${qs.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<InvoicesResponse>;
  },
};

export default invoicesTool;
