import { apiUrl, type ToolDefinition } from "./types";
import type { InvoiceItem, InvoiceParty, KsefStatus, PaymentMethod } from "./invoices";

export type ScanStatus =
  | "inbox" | "ocr_commissioned" | "waiting_for_ocr" | "ocr_done"
  | "waiting_for_idv_unread" | "waiting_for_idv_read" | "idv_done"
  | "waiting_for_ibv_unread" | "to_be_entered" | "accounted"
  | "error" | "error_duplicated" | "unrecognized" | "other";

export type ExpenseStatus = "entered" | "accounted" | "contra_entry" | "corrected";

export interface Expense {
  statusKsef: KsefStatus;
  ksefErrors: string;
  documentId: number;
  number: string;
  status: ExpenseStatus;
  scanStatus: ScanStatus;
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
  description: string;
  items: InvoiceItem[];
  currency: string;
  exchangeRate: { factor: number; rate: number; date: string };
  net: number;
  tax: number;
  gross: number;
  contractor: InvoiceParty;
  images: string[];
  thumbnail: string;
  scanSource: { source: string; email: string; file: string; ipAddress: string };
  movedToTrashAt: string;
  availableActions: { name: string; value: string }[];
  type: string;
}

export interface ExpensesResponse {
  expenses: Expense[];
  total: number;
  links: { current: string; next: string; prev: string; last: string };
}

export interface ExpensesParams {
  offset?: number;
  limit?: number;
  sortIssueDate?: "asc" | "desc";
  documentId?: number;
  phrase?: string;
  number?: string;
  currency?: string;
  status?: ExpenseStatus;
  contractorId?: number;
  issueDateFrom?: string;
  issueDateTo?: string;
  creationDateFrom?: string;
  creationDateTo?: string;
  scanStatus?: ScanStatus;
  isMovedToTrash?: boolean;
  grossMin?: number;
  grossMax?: number;
  netMin?: number;
  netMax?: number;
  taxMin?: number;
  taxMax?: number;
  isKsef?: boolean;
  ksefStatus?: KsefStatus[];
}

const expensesTool: ToolDefinition = {
  schema: {
    name: "get_expenses",
    description: "Pobierz listę kosztów (faktur zakupowych) użytkownika. Obsługuje filtrowanie po dacie, statusie, skanowaniu, kwocie i KSeF.",
    input_schema: {
      type: "object",
      properties: {
        offset:          { type: "number", description: "Pominięcie pierwszych N wyników" },
        limit:           { type: "number", description: "Liczba wyników na stronę" },
        sortIssueDate:   { type: "string", enum: ["asc", "desc"], description: "Sortowanie po dacie wystawienia" },
        documentId:      { type: "number", description: "ID dokumentu" },
        phrase:          { type: "string", description: "Wyszukiwanie po frazie" },
        number:          { type: "string", description: "Numer dokumentu" },
        currency:        { type: "string", description: "Waluta, np. PLN, EUR" },
        status:          { type: "string", enum: ["entered", "accounted", "contra_entry", "corrected"], description: "Status dokumentu" },
        contractorId:    { type: "number", description: "ID kontrahenta" },
        issueDateFrom:   { type: "string", description: "Data wystawienia od (YYYY-MM-DD)" },
        issueDateTo:     { type: "string", description: "Data wystawienia do (YYYY-MM-DD)" },
        creationDateFrom:{ type: "string", description: "Data utworzenia od (YYYY-MM-DD)" },
        creationDateTo:  { type: "string", description: "Data utworzenia do (YYYY-MM-DD)" },
        scanStatus:      { type: "string", enum: ["inbox", "ocr_commissioned", "waiting_for_ocr", "ocr_done", "waiting_for_idv_unread", "waiting_for_idv_read", "idv_done", "waiting_for_ibv_unread", "to_be_entered", "accounted", "error", "error_duplicated", "unrecognized", "other"], description: "Status skanu" },
        isMovedToTrash:  { type: "boolean", description: "Czy przeniesiony do kosza" },
        grossMin:        { type: "number", description: "Minimalna kwota brutto" },
        grossMax:        { type: "number", description: "Maksymalna kwota brutto" },
        netMin:          { type: "number", description: "Minimalna kwota netto" },
        netMax:          { type: "number", description: "Maksymalna kwota netto" },
        taxMin:          { type: "number", description: "Minimalny podatek VAT" },
        taxMax:          { type: "number", description: "Maksymalny podatek VAT" },
        isKsef:          { type: "boolean", description: "Czy dokument jest w KSeF" },
        ksefStatus:      { type: "array", items: { type: "string", enum: ["ready_to_send", "new", "processing", "accepted", "error", "error_api", "processing_error_api", "error_system", "processing_error_system", "in_control", "upo", "downloaded"] }, description: "Filtruj po statusie KSeF" },
      },
      required: [],
    },
  },
  async execute(input, ctx) {
    const p = input as ExpensesParams;
    const qs = new URLSearchParams();

    if (p.offset !== undefined)         qs.set("offset", String(p.offset));
    if (p.limit !== undefined)          qs.set("limit", String(p.limit));
    if (p.sortIssueDate)                qs.set("sort[issueDate]", p.sortIssueDate);
    if (p.documentId !== undefined)     qs.set("documentId", String(p.documentId));
    if (p.phrase)                       qs.set("phrase", p.phrase);
    if (p.number)                       qs.set("number", p.number);
    if (p.currency)                     qs.set("currency", p.currency);
    if (p.status)                       qs.set("status", p.status);
    if (p.contractorId !== undefined)   qs.set("contractorId", String(p.contractorId));
    if (p.issueDateFrom)                qs.set("issueDateFrom", p.issueDateFrom);
    if (p.issueDateTo)                  qs.set("issueDateTo", p.issueDateTo);
    if (p.creationDateFrom)             qs.set("creationDateFrom", p.creationDateFrom);
    if (p.creationDateTo)               qs.set("creationDateTo", p.creationDateTo);
    if (p.scanStatus)                   qs.set("scanStatus", p.scanStatus);
    if (p.isMovedToTrash !== undefined) qs.set("isMovedToTrash", String(p.isMovedToTrash));
    if (p.grossMin !== undefined)       qs.set("grossMin", String(p.grossMin));
    if (p.grossMax !== undefined)       qs.set("grossMax", String(p.grossMax));
    if (p.netMin !== undefined)         qs.set("netMin", String(p.netMin));
    if (p.netMax !== undefined)         qs.set("netMax", String(p.netMax));
    if (p.taxMin !== undefined)         qs.set("taxMin", String(p.taxMin));
    if (p.taxMax !== undefined)         qs.set("taxMax", String(p.taxMax));
    if (p.isKsef !== undefined)         qs.set("isKsef", String(p.isKsef));
    p.ksefStatus?.forEach((s) => qs.append("ksefStatus[]", s));

    const url = `${apiUrl(ctx, "/expenses")}?${qs.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<ExpensesResponse>;
  },
};

export default expensesTool;
