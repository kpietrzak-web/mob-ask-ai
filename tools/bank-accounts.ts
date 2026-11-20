import { apiUrl, type ToolDefinition } from "./types";

export interface BankAccount {
  id: number;
  name: string;
  iban: string;
  currency: string;
  default: boolean;
  availableActions: string[];
  deleted: boolean;
}

export interface BankAccountsResponse {
  accounts: BankAccount[];
  count: number;
}

const bankAccountsTool: ToolDefinition = {
  schema: {
    name: "get_bank_accounts",
    description: "Pobierz listę kont bankowych użytkownika.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  async execute(_input, ctx) {
    const res = await fetch(apiUrl(ctx, "/bank-accounts"), {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<BankAccountsResponse>;
  },
};

export default bankAccountsTool;
