# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Express.js + TypeScript AI assistant server for a Polish accounting mobile app (JDG/sole proprietorship). The server acts as a middleware between a React Native app and the OpenAI API, with tool use to fetch data from an external accounting API. It offers a text chat (Responses API, SSE) and voice-to-voice (Realtime API, WebSocket).

## Commands

```bash
npm start          # runs the server (uses npx tsx index.ts), needs OPENAI_API_KEY
npm run typecheck  # tsc --noEmit
```

Configuration is via env vars or a gitignored `.env` file, see `.env.example` (models, voice, port). In the Claude Code cloud sandbox run with `NODE_USE_ENV_PROXY=1` so Node's fetch uses the outbound proxy.

## Files

| File | Purpose |
|---|---|
| `index.ts` | Express app, routes, attaches the realtime WebSocket |
| `config.ts` | env config + shared `OpenAI` client |
| `prompt.ts` | screen context + system prompt (text) + voice instructions (system prompt + voice rules) |
| `chat.ts` | `POST /chat` — agentic loop over Responses API streaming |
| `realtime.ts` | `/realtime` WebSocket — relay to OpenAI Realtime, server-side tool execution |
| `docs/realtime.md` | protocol for the mobile app (voice) |

## Architecture

### Text chat request flow

1. React Native app sends `POST /chat` with `Authorization: Bearer <token>`, `X-Api-Url: <api>` and optional `X-Screen-Context: <json>` headers
2. Server runs an agentic loop — calls OpenAI Responses API (streaming, `store: false`, encrypted reasoning passed back between iterations) with tools, executes tool calls (in parallel) against the external API, loops until the model returns no tool calls
3. Responses stream back over SSE with named events

### SSE event types

| Event | Data | Purpose |
|---|---|---|
| `text` | JSON string chunk | Streaming text token |
| `action` | JSON object | UI action for the mobile app |
| `done` | `[DONE]` | Stream complete |

### Action types (`event: action`, or `mob.action` in voice)

Actions have two subtypes controlled by `actionType`:
- `"direct"` — mobile app navigates immediately (user explicitly asked, e.g. "add contractor XXX")
- `"suggested"` — mobile app shows a button attached to the message (user asked a question and the answer implies an action, e.g. "do I have contractor XXX?" → no → suggest adding)

```json
{ "type": "open_contractor_form", "actionType": "direct" | "suggested", "label": "...", "payload": { ... } }
```

### Session history

The server is stateless for text chat: the app sends the whole conversation (`messages: [{ role, content }]`, content is a string or `[{ type: "text", text }]`) on each request. Tool calls/results live only inside one request. `DELETE /chat` is a no-op kept for compatibility. Voice sessions keep their history inside the OpenAI Realtime session for as long as the WebSocket is open; the app can seed it with the text chat via `mob.history`.

### Voice (`/realtime`)

WebSocket relay: app ⇄ server ⇄ OpenAI Realtime (`gpt-realtime`). The server sets instructions (`buildVoiceInstructions`) and tools on connect; the app cannot override `instructions`/`tools`/`tool_choice`/`model`. Function calls are run on the server when `response.done` arrives (skipped if the response was interrupted), then `function_call_output` + `response.create` are sent. Extra `mob.*` events are described in `docs/realtime.md`.

### Tools (`tools/`)

Each tool is a file exporting a default `ToolDefinition` with a `schema` (provider-neutral: `name`, `description`, `input_schema` JSON Schema) and an `execute` function. Schemas are converted to OpenAI formats in `tools/index.ts` (`chatTools`, `realtimeTools`).

**`tools/types.ts`** — shared interfaces: `ToolSchema`, `ApiContext` (token, apiUrl, emit), `ToolDefinition`, `apiUrl()` helper (strips trailing slash).

**`tools/index.ts`** — registry + `runToolForModel` (parses args, runs the tool, returns JSON; errors go back to the model as `{ error }`). To add a new tool: create a file, export a `ToolDefinition`, add two lines here (import + registry entry). It is then available in both text and voice.

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

## Git workflow

Single-developer project: commit and push directly to `main` (no feature branches or pull requests needed).

## Filter synchronization (AI filters feature)

The `filterDefinitions.ts` file is the single source of truth for filter schemas exposed to the AI.
It MUST stay in sync with the mobile app:

- Mobile app types: `scanner/ios/src/modules/GridFilters/types.ts`
- Mobile app filter defs: `scanner/ios/src/modules/GridFilters/filterDefinitions.ts`
- Mobile app intent types: `scanner/ios/src/intents/types.ts` (SetFiltersPayload)
- Mobile app parser: `scanner/ios/src/intents/parsers/aiChat.ts` (SET_FILTERS case)

**When adding a new filter field:**
1. Add it to `filterDefinitions.ts` for the appropriate screen.
2. Add it as a parameter to `tools/set-filters.ts` input schema.
3. Update `actionVersioning.ts` if the minimum version changes.
4. Update the corresponding `*Filters` interface in the mobile app.
5. Update the `SetFiltersPayload` type in the mobile app.

**When bumping SET_FILTERS to a new app version:**
Update `set_filters` min version in `actionVersioning.ts`.
Old app versions that don't handle `SET_FILTERS` will not receive it (version gate).
