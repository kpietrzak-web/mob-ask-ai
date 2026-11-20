import { apiUrl, type ToolDefinition } from "./types";

export interface ContractorAddress {
  street: string;
  house: string;
  local: string;
  city: string;
  postCode: string;
  postOffice: string;
  country: string;
}

export interface Contractor {
  id: number;
  headerId: number;
  nip: string;
  paymentMethod: string;
  maturity: string;
  shortName: string;
  name: string;
  address: ContractorAddress;
  phoneNumber: string;
  cellNumber: string;
  email: string;
  officialEmail: string;
  splitPayment: boolean;
  recipientCode: string;
  province: string;
  connected: boolean;
  privateIndividual: boolean;
  defaultRecipientId: number;
  regon: string;
  localGovernmentUnit: boolean;
}

const contractorsTool: ToolDefinition = {
  schema: {
    name: "get_contractors",
    description: "Pobierz listę kontrahentów użytkownika. Przy prezentowaniu wyników skup się na nazwie, NIP i kraju — pomijaj szczegóły płatności, chyba że użytkownik o nie pyta.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  async execute(_input, ctx) {
    const res = await fetch(apiUrl(ctx, "/contractors"), {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<Contractor[]>;
  },
};

export default contractorsTool;
