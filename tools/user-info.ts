import { apiUrl, type ToolDefinition } from "./types";

export interface UserInfo {
  isCompanyOwner: boolean;
  noRequiredPackage: boolean;
  type: string;
  permissions: boolean[];
  company: { name: string; currency: string; companyId: number };
  email: string;
  accountingOffice: { name: string; vatId: string; type: string };
  leader: { email: string; firstName: string; lastName: string; phone: string };
  settings: {
    withholdTaxPercentage: number;
    withholdTaxPercentageBase: number;
    withholdTaxNationalInsurancePercentage: number;
    withholdTaxNationalInsuranceMax: number;
    nationalInsurancePercentage: number;
    socialSecurityFundPercentage: number;
    sdiEnabled: boolean;
    accountingType: string;
    vatPayer: boolean;
    defaultVatDismissalType: string;
  };
  version: string;
  vatPayerInfo: { isPayer: boolean; dateFrom: string; dateTo: string }[];
  hasDocuments: boolean;
  hasLeadingAccountant: boolean;
  smartKsefPromoJoinDate: string;
}

const userInfoTool: ToolDefinition = {
  schema: {
    name: "get_user_info",
    description: "Pobierz informacje o zalogowanym użytkowniku, jego firmie i ustawieniach konta. Używaj gdy nie znasz imienia użytkownika lub potrzebujesz danych firmy.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  async execute(_input, ctx) {
    const res = await fetch(apiUrl(ctx, "/user-info"), {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<UserInfo>;
  },
};

export default userInfoTool;
