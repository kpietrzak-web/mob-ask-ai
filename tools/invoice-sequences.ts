import { apiUrl, type ToolDefinition } from "./types";

export interface SequenceElements {
  symbol: string;
  year: number;
  number_type: string;
  number_length: number;
  month: number;
  customSegment1: string;
  customSegment2: string;
}

export interface InvoiceSequence {
  id: number;
  type: "sale" | "correction";
  name: string;
  example: string;
  isDefault: boolean;
  isActive: boolean;
  isUsed: boolean;
  isSystemSequence: boolean;
  elements: SequenceElements;
  description: string;
  separationSymbol: string;
  schema: string;
}

export interface InvoiceSequencesResponse {
  sequences: InvoiceSequence[];
}

const invoiceSequencesTool: ToolDefinition = {
  schema: {
    name: "get_invoice_sequences",
    description: "Pobierz sekwencje numeracji faktur. Zwraca tylko sekwencje typu 'sale' (sprzedaż) i 'correction' (korekta) — pozostałe typy są ignorowane.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  async execute(_input, ctx) {
    const res = await fetch(apiUrl(ctx, "/invoice/sequences"), {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    const data = await res.json() as InvoiceSequencesResponse;
    return {
      sequences: data.sequences.filter((s) => s.type === "sale" || s.type === "correction"),
    };
  },
};

export default invoiceSequencesTool;
