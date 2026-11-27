-- LLM token-usage raw events. One row = one model invocation.
-- No message content / tool arguments / PII is stored here.
-- Reporting levels (per message / conversation / action) are derived with SQL.

CREATE TABLE IF NOT EXISTS llm_usage_events (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  channel             TEXT         NOT NULL,            -- chat | voice | voice_transcribe
  model               TEXT         NOT NULL,
  conversation_id     TEXT         NOT NULL,
  message_id          TEXT         NOT NULL,
  iteration           INT          NOT NULL DEFAULT 0,
  user_ref            TEXT,
  tenant_ref          TEXT,
  screen              TEXT,
  app_build           INT,
  input_tokens        INT          NOT NULL DEFAULT 0,
  cached_input_tokens INT          NOT NULL DEFAULT 0,
  output_tokens       INT          NOT NULL DEFAULT 0,
  reasoning_tokens    INT          NOT NULL DEFAULT 0,
  audio_input_tokens  INT          NOT NULL DEFAULT 0,
  audio_output_tokens INT          NOT NULL DEFAULT 0,
  total_tokens        INT          NOT NULL DEFAULT 0,
  tool_calls          TEXT[]       NOT NULL DEFAULT '{}',
  action_types        TEXT[]       NOT NULL DEFAULT '{}',
  action_direct       BOOLEAN      NOT NULL DEFAULT false,
  cost_usd            NUMERIC(12,6) NOT NULL DEFAULT 0,
  price_version       TEXT,
  latency_ms          INT,
  incomplete          BOOLEAN      NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS llm_usage_events_ts_idx           ON llm_usage_events (ts);
CREATE INDEX IF NOT EXISTS llm_usage_events_conversation_idx ON llm_usage_events (conversation_id);
CREATE INDEX IF NOT EXISTS llm_usage_events_user_idx         ON llm_usage_events (user_ref);
