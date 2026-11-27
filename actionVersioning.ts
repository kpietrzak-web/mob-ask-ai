/**
 * Action versioning — controls which tools are exposed to the model
 * based on the app build code reported by the client via X-App-Version.
 *
 * Build codes are integers (e.g. 150063). When no build code is provided
 * the client falls back to FALLBACK_BUILD, enabling only the most basic tools.
 */

/** Latest known production build code — used to detect outdated clients. */
export const LATEST_BUILD = 150067;

/** Minimum build code required to unlock each action tool (0 = always available). */
export const CHAT_ACTIONS_MIN_BUILD: Record<string, number> = {
  // --- data-read tools (available from the beginning) ---
  get_user_info:                0,
  get_contractors:              0,
  get_bank_accounts:            0,
  get_invoices:                 0,
  get_invoice_templates:        0,
  get_invoice_sending_history:  0,
  get_expenses:                 0,
  get_invoices_summary:         0,
  get_statistics:               0,
  get_document_topics:          0,
  get_invoice_sequences:        0,
  get_ksef_statistics:          0,
  get_settings:                 0,
  get_dashboard:                0,
  get_close_month_status:       0,
  get_referral:                 0,
  get_referral_invitations:     0,
  refresh:                      0,

  // --- navigation / UI-opening actions ---
  open_income:                  0,
  open_income_form:             0,
  open_contractor_form:         0,
  show_statistics:              0,
  show_tasks:                   0,
  show_task:                    0,
  show_contractors:             0,
  show_contractor:              0,
  show_sequences:               0,
  show_ksef:                    0,
  submit_bug_report:            0,

  // --- filter actions (requires app to handle SET_FILTERS intent) ---
  set_filters:                  151000,

  // --- "zrób to za mnie" reply button (requires app to handle `send_message` suggested action) ---
  suggest_reply:                151000,

  // --- mutating actions ---
  download_income_pdf:          0,
  mark_invoice_as_accounted:    0,
  unaccount_invoice:            0,
  send_invoice:                 0,
  send_invoice_duplicate:       0,
  send_invoice_reminder:        0,
  edit_income:                  0,
  edit_contractor:              0,
  approve_month:                0,
  // Backend-side writes — emit only existing actions, so available to all builds.
  get_company_by_nip:           0,
  create_contractor:            0,
};

/**
 * User-facing features registry.
 * Each entry describes a feature introduced in a given build.
 * Used to inform the model when a user asks about a feature their app lacks.
 */
export const FEATURES_BY_BUILD: Array<{ minBuild: number; name: string; description: string }> = [
  {
    minBuild: 151000,
    name: 'filtrowanie AI',
    description: 'Asystent AI może automatycznie ustawiać filtry na liście faktur i kosztów na podstawie opisu słownego.',
  },
];

/** Build used when client sends no or invalid X-App-Version header. */
export const FALLBACK_BUILD = 0;

/**
 * Parse a build code string to an integer.
 * Returns null for invalid or missing input.
 */
export function parseBuildCode(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
}

export function isValidBuildCode(raw: string | undefined | null): boolean {
  return parseBuildCode(raw) !== null;
}

/**
 * Returns the set of tool names available for the given build code.
 */
export function getAvailableActions(rawBuild: string | undefined | null): Set<string> {
  const build = parseBuildCode(rawBuild) ?? FALLBACK_BUILD;
  const available = new Set<string>();
  for (const [tool, minBuild] of Object.entries(CHAT_ACTIONS_MIN_BUILD)) {
    if (build >= minBuild) available.add(tool);
  }
  return available;
}

/**
 * Returns list of features the user does not have (their build is too old).
 */
export function getMissingFeatures(userBuild: number): Array<{ name: string; description: string }> {
  return FEATURES_BY_BUILD.filter(f => f.minBuild > userBuild);
}

/**
 * Returns true if the user's build is behind LATEST_BUILD.
 */
export function isOutdated(userBuild: number): boolean {
  return userBuild < LATEST_BUILD;
}
