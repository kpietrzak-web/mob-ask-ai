import { apiUrl, type ToolDefinition } from "./types";

export interface ReferralResponse {
  joinedDate: string;
  referralLink: string;
  status: string;
  stats: {
    invitation: { sent: number; active: number; accounted: number };
    reward: { pending: number; available: number; withdrawn: number };
  };
  settings: {
    iban: string;
    invitationMessage: string;
    invitationMessageMaxLen: number;
  };
}

const referralTool: ToolDefinition = {
  schema: {
    name: "get_referral",
    description: "Pobierz dane programu poleceń użytkownika: link, status, statystyki zaproszeń i nagród.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  async execute(_input, ctx) {
    const res = await fetch(apiUrl(ctx, "/referral"), {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<ReferralResponse>;
  },
};

export default referralTool;
