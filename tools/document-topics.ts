import { apiUrl, type ToolDefinition } from "./types";

export interface TopicComment {
  id: number;
  comment: string;
  author: { name: string };
  created: string;
}

export interface Topic {
  id: number;
  topicName: string;
  status: string;
  comments: TopicComment[];
  created: string;
  expectedResponseDate: string;
  received: { name: string };
}

export interface DocumentTopicsResponse {
  topics: Topic[];
}

const documentTopicsTool: ToolDefinition = {
  schema: {
    name: "get_document_topics",
    description: "Pobierz rozmowy z księgową prowadzącą dotyczące danej faktury. Dostępne tylko gdy użytkownik ma księgową prowadzącą (hasLeadingAccountant z get_user_info).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID faktury, której dotyczą rozmowy" },
      },
      required: ["id"],
    },
  },
  async execute(input, ctx) {
    const qs = new URLSearchParams({ id: String(input.id) });
    const res = await fetch(`${apiUrl(ctx, "/documents/topics")}?${qs}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    return res.json() as Promise<DocumentTopicsResponse>;
  },
};

export default documentTopicsTool;
