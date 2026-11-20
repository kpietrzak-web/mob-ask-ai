import { apiUrl, type ToolDefinition } from "./types";

export type InvitationStatus = "invitation_sent" | "registered" | "prize_awarded" | "prize_paid";

export interface Invitation {
  id: number;
  email: string;
  name: string;
  sentDate: string;
  status: InvitationStatus;
}

export interface ReferralInvitationsResponse {
  invitations: Invitation[];
  count: number;
  links: { current: string; next: string; prev: string; last: string };
}

const referralInvitationsTool: ToolDefinition = {
  schema: {
    name: "get_referral_invitations",
    description: "Pobierz listę zaproszeń wysłanych w ramach programu poleceń.",
    input_schema: {
      type: "object",
      properties: {
        phrase: { type: "string",  description: "Wyszukiwanie po imieniu lub emailu" },
        offset: { type: "number",  description: "Pominięcie pierwszych N wyników" },
        limit:  { type: "number",  description: "Liczba wyników na stronę" },
        status: { type: "array", items: { type: "string", enum: ["invitation_sent", "registered", "prize_awarded", "prize_paid"] }, description: "Filtruj po statusie zaproszenia" },
      },
      required: [],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams();
    if (input.phrase)             qs.set("phrase", input.phrase as string);
    if (input.offset !== undefined) qs.set("offset", String(input.offset));
    if (input.limit !== undefined)  qs.set("limit", String(input.limit));
    (input.status as InvitationStatus[] | undefined)?.forEach((s) => qs.append("status[]", s));

    const query = qs.toString();
    const res = await fetch(`${apiUrl(ctx, "/referral/invitations")}${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<ReferralInvitationsResponse>;
  },
};

export default referralInvitationsTool;
