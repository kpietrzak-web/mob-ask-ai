# Voice-to-voice (`/realtime`): protocol for the mobile app

The app opens one WebSocket per voice conversation. The server relays the
[OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) protocol
both ways, adds the system prompt and tools, and runs the tools itself.

## Connecting

```ts
const ws = new WebSocket(`${SERVER}/realtime`, undefined, {
  headers: {
    Authorization: `Bearer ${token}`,
    "X-Api-Url": apiUrl,
    "X-Screen-Context": JSON.stringify(screenContext), // optional, same as /chat
  },
});
```

If the client cannot set headers, use query params instead:
`/realtime?token=…&apiUrl=…&screenContext=<urlencoded json>` (headers are preferred,
because URLs end up in logs).

Wait for `session.updated` before sending audio.

## Audio

- Format, both ways: **PCM16, 24 kHz, mono, little-endian**.
- Send microphone audio either as
  - binary WebSocket frames with raw PCM bytes (simplest), or
  - `{ "type": "input_audio_buffer.append", "audio": "<base64 pcm>" }`.
- Chunks of 20–100 ms work well.
- Turn detection runs on the server (`semantic_vad`): no need to commit or ask for a response.
  The model answers when the user stops talking and stops when the user interrupts.
- Play `response.output_audio.delta` (`delta` = base64 PCM16).
- When `input_audio_buffer.speech_started` arrives, stop playback right away (barge-in).

## Useful OpenAI events (server → app)

| Event | Use |
|---|---|
| `session.updated` | session ready |
| `input_audio_buffer.speech_started` / `speech_stopped` | user started/stopped speaking |
| `conversation.item.input_audio_transcription.completed` | `transcript` — what the user said (show as user bubble) |
| `response.output_audio.delta` | `delta` — audio to play |
| `response.output_audio_transcript.delta` / `.done` | text of the assistant's answer (show as assistant bubble) |
| `response.done` | end of an answer |
| `error` | OpenAI error |

## Extra events

App → server:

| Event | Purpose |
|---|---|
| `{ "type": "mob.context", "screenContext": { "screen": "income_detail", "incomeId": 1, "incomeNumber": "A1/11/2026" } }` | user changed screen |
| `{ "type": "mob.history", "messages": [{ "role": "user" \| "assistant", "content": "…" }] }` | continue the text chat in voice; send right after connecting |
| `{ "type": "conversation.item.create", "item": { "type": "message", "role": "user", "content": [{ "type": "input_text", "text": "…" }] } }` then `{ "type": "response.create" }` | typed message inside a voice session |
| `{ "type": "session.update", "session": { "audio": { … } } }` | tune audio / VAD / voice; `instructions`, `tools`, `tool_choice` and `model` are ignored |

Server → app:

| Event | Purpose |
|---|---|
| `{ "type": "mob.action", "action": { … } }` | UI action — the same object as the SSE `action` event in `/chat` (`direct` / `suggested`, `refresh`, …) |
| `{ "type": "mob.tool", "name": "get_invoices", "status": "started" \| "done" }` | optional "checking…" indicator |
| `{ "type": "mob.error", "message": "…" }` | relay error |

## Notes

- Tools are run only when an answer finishes normally. If the user interrupts the
  answer while the model is calling a tool (e.g. `send_invoice`), the tool is not run.
- The voice conversation history lives as long as the WebSocket is open. To move back to text,
  build the history from the transcripts and send it to `/chat` as usual.
