/**
 * Action versioning — controls which tools are exposed to the model
 * based on the app version reported by the client.
 *
 * When no version is provided by the client we fall back to
 * FALLBACK_VERSION, which enables only the most basic set of actions
 * (data-read tools that have always been present).
 */

/** Minimum semver required to unlock each action tool. */
export const CHAT_ACTIONS_MIN_VERSION: Record<string, string> = {
  // --- data-read tools (available since the beginning) ---
  get_user_info:                "1.0.0",
  get_contractors:              "1.0.0",
  get_bank_accounts:            "1.0.0",
  get_invoices:                 "1.0.0",
  get_invoice_templates:        "1.0.0",
  get_invoice_sending_history:  "1.0.0",
  get_expenses:                 "1.0.0",
  get_invoices_summary:         "1.0.0",
  get_statistics:               "1.0.0",
  get_document_topics:          "1.0.0",
  get_invoice_sequences:        "1.0.0",
  get_ksef_statistics:          "1.0.0",
  get_settings:                 "1.0.0",
  get_dashboard:                "1.0.0",
  get_close_month_status:       "1.0.0",
  get_referral:                 "1.0.0",
  get_referral_invitations:     "1.0.0",
  refresh:                      "1.0.0",

  // --- navigation / UI-opening actions ---
  open_income:                  "1.0.0",   // open_invoice tool
  open_income_form:             "1.0.0",
  open_contractor_form:         "1.0.0",
  show_statistics:              "1.0.0",
  show_tasks:                   "1.0.0",
  show_task:                    "1.0.0",
  show_contractors:             "1.0.0",
  show_contractor:              "1.0.0",
  show_sequences:               "1.0.0",
  show_ksef:                    "1.0.0",
  submit_bug_report:            "1.0.0",

  // --- filter actions (SET_FILTERS — requires app >= 1.51.0 to handle the action) ---
  // UWAGA: wersja minimalna jest powiązana z obsługą IntentType.SET_FILTERS w aplikacji.
  // Przy zmianie minVersion zaktualizuj też: scanner/ios/src/intents/types.ts
  set_filters:                  "1.51.0",

  // --- mutating actions (require a minimum version for safety) ---
  // TODO: set accurate minimum versions once known from release history
  download_income_pdf:          "1.0.0",
  mark_invoice_as_accounted:    "1.0.0",
  unaccount_invoice:            "1.0.0",
  send_invoice:                 "1.0.0",
  send_invoice_duplicate:       "1.0.0",
  send_invoice_reminder:        "1.0.0",
  edit_income:                  "1.0.0",
  edit_contractor:              "1.0.0",
  approve_month:                "1.0.0",
};

/**
 * Version used when the client sends no X-App-Version header.
 * Chosen as a conservative baseline — enables only the most
 * fundamental read-only tools.
 */
export const FALLBACK_VERSION = "1.0.0";

/**
 * Parse a semver string into [major, minor, patch].
 * Returns null for invalid or missing input.
 */
export function parseSemver(version: string | undefined | null): [number, number, number] | null {
  if (!version) return null;
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Returns true when `candidate` is a valid semver string.
 */
export function isValidSemver(version: string | undefined | null): boolean {
  return parseSemver(version) !== null;
}

/**
 * Compare two semver strings.
 * Returns:
 *  -1 when a < b
 *   0 when a === b
 *   1 when a > b
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);

  // Treat unparseable as 0.0.0
  const [aMaj, aMin, aPat] = pa ?? [0, 0, 0];
  const [bMaj, bMin, bPat] = pb ?? [0, 0, 0];

  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPat !== bPat) return aPat > bPat ? 1 : -1;

  return 0;
}

/**
 * Returns true when `appVersion` satisfies the minimum required version
 * for a given action (i.e. appVersion >= minVersion).
 */
function actionAvailable(appVersion: string, minVersion: string): boolean {
  return compareSemver(appVersion, minVersion) >= 0;
}

/**
 * Returns the set of tool names available for the given app version.
 * If `rawVersion` is missing or not a valid semver, FALLBACK_VERSION is used.
 */
export function getAvailableActions(rawVersion: string | undefined | null): Set<string> {
  const effectiveVersion = isValidSemver(rawVersion)
    ? rawVersion!
    : FALLBACK_VERSION;

  const available = new Set<string>();

  for (const [toolName, minVersion] of Object.entries(CHAT_ACTIONS_MIN_VERSION)) {
    if (actionAvailable(effectiveVersion, minVersion)) {
      available.add(toolName);
    }
  }

  return available;
}
