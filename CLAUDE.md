# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Express.js + TypeScript AI assistant server for a Polish accounting mobile app (JDG/sole proprietorship). The server acts as a middleware between a React Native app and the Anthropic Claude API, with tool use to fetch data from an external accounting API.

## Commands

```bash
npm start        # runs the server (uses npx tsx index.ts)
```

## Architecture

### Request flow

1. React Native app sends `POST /chat` with `Authorization: Bearer <token>` and `X-Api-Url: <api>` headers
2. Server runs an agentic loop — calls Claude with tools, executes tool calls against the external API, loops until `stop_reason !== "tool_use"`
3. Responses stream back over SSE with named events

### SSE event types

| Event | Data | Purpose |
|---|---|---|
| `text` | JSON string chunk | Streaming text token |
| `action` | JSON object | UI action for the mobile app |
| `done` | `[DONE]` | Stream complete |

### Action types (`event: action`)

Actions have two subtypes controlled by `actionType`:
- `"direct"` — mobile app navigates immediately (user explicitly asked, e.g. "add contractor XXX")
- `"suggested"` — mobile app shows a button attached to the message (user asked a question and the answer implies an action, e.g. "do I have contractor XXX?" → no → suggest adding)

```json
{ "type": "open_contractor_form", "actionType": "direct" | "suggested", "label": "...", "payload": { ... } }
```

### Session history

Server stores full conversation history (including `tool_use`/`tool_result` blocks) in a `Map<token, MessageParam[]>`. On each request only the latest user message is taken from the request body and appended to stored history. Reset via `DELETE /chat`.

### Tools (`tools/`)

Each tool is a file exporting a default `ToolDefinition` with a `schema` (Anthropic tool definition) and an `execute` function.

**`tools/types.ts`** — shared interfaces: `ApiContext` (token, apiUrl, emit), `ToolDefinition`, `apiUrl()` helper (strips trailing slash).

**`tools/index.ts`** — registry. To add a new tool: create a file, export a `ToolDefinition`, add two lines here (import + registry entry).

**API tools** (fetch from external accounting API):

| File | Tool name | Endpoint |
|---|---|---|
| `user-info.ts` | `get_user_info` | `/user-info` |
| `contractors.ts` | `get_contractors` | `/contractors` |
| `bank-accounts.ts` | `get_bank_accounts` | `/bank-accounts` |
| `invoices.ts` | `get_invoices` | `/invoices` (always sorts DESC by issueDate, creationDate) |
| `invoice-templates.ts` | `get_invoice_templates` | `/invoices/templates` |
| `invoice-sending-history.ts` | `get_invoice_sending_history` | `/invoices/sending-history` |
| `invoice-sequences.ts` | `get_invoice_sequences` | `/invoice/sequences` (filters to `sale`/`correction` only) |
| `invoices-summary.ts` | `get_invoices_summary` | `/invoices-summary` |
| `expenses.ts` | `get_expenses` | `/expenses` |
| `statistics.ts` | `get_statistics` | `/statistics` |
| `ksef-statistics.ts` | `get_ksef_statistics` | `/ksef/stats` |
| `dashboard.ts` | `get_dashboard` | `/dashboard` |
| `close-month-status.ts` | `get_close_month_status` | `/close-month/status` |
| `settings.ts` | `get_settings` | `/settings` |
| `document-topics.ts` | `get_document_topics` | `/documents/topics` (requires `hasLeadingAccountant`) |
| `referral.ts` | `get_referral` | `/referral` |
| `referral-invitations.ts` | `get_referral_invitations` | `/referral/invitations` |

**Action tools** (emit SSE events to the mobile app, no API call):

| File | Tool name | Opens |
|---|---|---|
| `open-contractor-form.ts` | `open_contractor_form` | Contractor add form |
