# Voice mode for the mobile app: implementation brief

This document is self-contained: it is written for whoever implements voice in the
React Native app (human or Claude) without access to the server code.

## What exists on the server

The AI server (`mob-ask-ai`) now has two entry points:

| Endpoint | Mode | Status |
|---|---|---|
| `POST /chat` (SSE) | text chat | **unchanged** for the app: same headers, same `messages`, same `text` / `action` / `done` events |
| `WS /realtime` | **voice-to-voice** (new) | relay to the OpenAI Realtime API |

Voice uses the same assistant as text: same rules, same 27 tools, same UI actions. The server
holds the OpenAI key and runs the tools with the user's token. The app only streams microphone
audio up and plays audio down, and handles the same actions it already handles in text chat.

Verified against the real OpenAI API: session setup, Polish speech output, tool calls
(`get_contractors` → `open_contractor_form` + `open_income_form` as `suggested`) and `mob.action` delivery.

## 1. Connecting

One WebSocket per voice conversation. Same auth data as `/chat`:

```ts
const ws = new WebSocket(`${AI_SERVER_URL.replace(/^http/, "ws")}/realtime`, undefined, {
  headers: {
    Authorization: `Bearer ${token}`,
    "X-Api-Url": apiUrl,
    "X-Screen-Context": JSON.stringify(screenContext), // same object as for /chat, optional
  },
});
```

React Native's `WebSocket` accepts headers in the 3rd argument. If that is not possible, query params
work too: `/realtime?token=…&apiUrl=…&screenContext=<urlencoded json>` (headers preferred: URLs end up in logs).

**Wait for the `session.updated` event before sending audio.** Close the socket when the user leaves voice
mode or the app goes to the background: the session is billed per minute while open.

## 2. Audio

- Format in both directions: **PCM16, 24 kHz, mono, little-endian**.
- Upload microphone audio in 20–100 ms chunks, either
  - as **binary WebSocket frames** with raw PCM bytes (simplest), or
  - as JSON `{ "type": "input_audio_buffer.append", "audio": "<base64 pcm>" }`.
- **No need to detect end of speech.** The server uses OpenAI `semantic_vad`: the model answers when the
  user stops talking. Just stream the microphone continuously while voice mode is on.
- Play `response.output_audio.delta` events: `delta` is base64 PCM16 24 kHz. Queue chunks and play them gap-free.
- **Barge-in:** when `input_audio_buffer.speech_started` arrives, stop playback immediately and clear the
  queue (OpenAI already cancels the current answer on its side).

### Echo cancellation is mandatory

On speakerphone the assistant's voice goes back into the microphone, the VAD hears "the user speaking"
and the assistant keeps interrupting itself. Record with the platform's voice-communication mode:
- iOS: `AVAudioSession` category `playAndRecord`, mode `voiceChat` (enables hardware AEC), option `defaultToSpeaker`.
- Android: audio source `VOICE_COMMUNICATION` (enables AEC), audio mode `MODE_IN_COMMUNICATION`.

If the chosen library cannot do this, add a **push-to-talk** fallback (see section 6).

### Libraries (check current versions and APIs before choosing)

The app needs streaming PCM capture and streaming PCM playback; the usual recorder/player
libraries that write files are not enough. Candidates:
- capture: `react-native-live-audio-stream` (bare RN, PCM chunks with configurable sample rate),
  `@siteed/expo-audio-studio` (Expo);
- playback: `react-native-audio-api` (Web Audio-like API, buffer queue playback).

Check whether the app is Expo or bare RN, what is already installed, and whether the library allows the
iOS/Android voice-communication settings above. If a library only captures at 16/44.1/48 kHz, resample to 24 kHz.

Permissions: iOS `NSMicrophoneUsageDescription`; Android `RECORD_AUDIO` (+ runtime request).

## 3. Events the app should handle (server → app)

All OpenAI Realtime events are forwarded as JSON. Only these matter for the UI:

| Event | What to do |
|---|---|
| `session.updated` | ready: start streaming the microphone |
| `input_audio_buffer.speech_started` | user started talking: stop playback, show "listening" |
| `input_audio_buffer.speech_stopped` | show "thinking" |
| `conversation.item.input_audio_transcription.completed` | `transcript` = what the user said → user bubble (key: `item_id`) |
| `response.output_audio.delta` | `delta` = audio to play |
| `response.output_audio_transcript.delta` | `delta` = text of what the assistant is saying → stream into assistant bubble (key: `response_id`) |
| `response.output_audio_transcript.done` | assistant bubble final (`transcript`) |
| `response.done` | one model response finished (see "turns" below) |
| `error` | OpenAI error (`error.message`); log, show a generic error if the socket closes |

Extra events added by our server:

| Event | What to do |
|---|---|
| `{ "type": "mob.action", "action": { … } }` | **UI action, exactly the same object as the SSE `action` event in `/chat`.** Reuse the existing handler: `direct` → navigate now, `suggested` → button under the assistant message, `refresh` → refresh data |
| `{ "type": "mob.tool", "name": "get_invoices", "status": "started" \| "done" }` | optional "checking…" indicator |
| `{ "type": "mob.error", "message": "…" }` | relay error (e.g. voice service unavailable) |

### Turns: how answers and actions arrive (observed on the real API)

One user question usually produces **several** `response.done` events, because each tool call is a
separate model response:

```
user speaks
→ response 1: [audio "Już sprawdzam…"] + function_call get_contractors
→ mob.tool started/done
→ response 2: function_call open_contractor_form   → mob.action (suggested)
→ response 3: function_call open_income_form       → mob.action (suggested)
→ response 4: [audio "Nie masz kontrahenta Jan Kowalski. Na ekranie poniżej…"]
```

- Some responses have no audio at all (only a function call): do not create empty bubbles.
- **Suggested actions arrive before the final spoken answer.** Collect them for the current turn
  (from the user's speech until the next user speech) and attach them to the **last assistant bubble
  of that turn**. The model's answer says they are "na ekranie poniżej".
- `direct` actions (e.g. "otwórz fakturę A1/11/2026") can be executed immediately. Decide whether voice mode
  stays open while the app navigates (recommended: keep the voice session, send `mob.context` with the new screen).
- The user transcript (`…transcription.completed`) may arrive **after** the assistant already started
  answering. Create the user bubble placeholder on `input_audio_buffer.committed` (same `item_id`) and fill
  the text later, so the order on screen is right.

## 4. Messages the app can send (app → server)

| Message | When |
|---|---|
| binary frame / `input_audio_buffer.append` | microphone audio |
| `{ "type": "mob.history", "messages": [{ "role": "user" \| "assistant", "content": "text" }] }` | right after `session.updated`, when the user switches from text chat to voice: the voice assistant continues the same conversation |
| `{ "type": "mob.context", "screenContext": { … } }` | whenever the screen changes while voice is on (same object as the `X-Screen-Context` header) |
| `{ "type": "conversation.item.create", "item": { "type": "message", "role": "user", "content": [{ "type": "input_text", "text": "…" }] } }` then `{ "type": "response.create" }` | typed message during a voice session (optional) |
| `{ "type": "session.update", "session": { "audio": { … } } }` | change audio settings (push-to-talk, VAD). `instructions`, `tools`, `tool_choice`, `model` are ignored by the server |

## 5. Text ⇄ voice continuity

- Text → voice: send the existing chat messages with `mob.history`.
- Voice → text: append the final user transcripts and assistant transcripts (`role: "user"/"assistant"`,
  plain text) to the chat history the app keeps for `/chat`. Nothing else is needed: `/chat` is stateless
  and gets the whole history from the app on every request.
- Recommended UX: one conversation list; voice turns show as normal bubbles (maybe with a mic icon).

## 6. Push-to-talk fallback (optional)

If echo cancellation is not good enough, disable server VAD after `session.updated`:

```json
{ "type": "session.update", "session": { "audio": { "input": { "turn_detection": null } } } }
```

Then: on button press start sending audio; on release send `{ "type": "input_audio_buffer.commit" }` and
`{ "type": "response.create" }`. To interrupt the assistant: stop playback and send `{ "type": "response.cancel" }`.

## 7. Suggested UI

- Mic button next to the chat input → enters voice mode (opens the socket).
- States: connecting → listening → user speaking → thinking / "sprawdzam…" (`mob.tool`) → assistant speaking.
- Live bubbles from the transcripts, suggested-action buttons under the assistant bubble, as in text chat.
- Mute and end buttons; close the socket on end, on leaving the chat, on app background.

## 8. Test checklist

1. Connect, wait for `session.updated`, say "Cześć" → Polish voice answer, both bubbles appear.
2. "Czy mam kontrahenta Jan Kowalski?" (non-existent) → "sprawdzam" indicator, then two suggested buttons
   (add contractor, issue invoice) under the final assistant bubble.
3. Interrupt the assistant mid-sentence → playback stops at once, the assistant listens.
4. On speakerphone with no headphones, let the assistant talk for 10+ s → it must not interrupt itself (AEC).
5. Text chat 2–3 messages → switch to voice → "a ten drugi?" → the assistant knows the context (`mob.history`).
6. Open an invoice screen during voice → "wyślij tę fakturę" → it refers to the invoice on screen (`mob.context`).
7. Background the app → socket closes; return → voice can be reopened.
8. Kill the network → the app shows an error and does not hang.
