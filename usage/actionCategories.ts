/**
 * Maps tool names to business action categories for "cost per action" reports.
 * Keep this in sync with the tool registry in `tools/index.ts`.
 */

const TOOL_TO_CATEGORY: Record<string, string> = {
  // invoices
  open_income_form: "invoice_create",
  edit_income: "invoice_edit",
  send_invoice: "invoice_send",
  send_invoice_duplicate: "invoice_send",
  send_invoice_reminder: "invoice_reminder",
  download_income_pdf: "invoice_pdf",
  mark_invoice_as_accounted: "invoice_accounting",
  unaccount_invoice: "invoice_accounting",
  open_invoice: "navigation",
  open_income: "navigation",
  // contractors
  open_contractor_form: "contractor_create",
  edit_contractor: "contractor_edit",
  // month / filters / navigation
  approve_month: "month_approve",
  set_filters: "filters_set",
  show_statistics: "navigation",
  show_tasks: "navigation",
  show_task: "navigation",
  show_contractors: "navigation",
  show_contractor: "navigation",
  show_sequences: "navigation",
  show_ksef: "navigation",
  // misc
  submit_bug_report: "support",
  refresh: "navigation",
  close_voice_chat: "navigation",
};

/** Data-read tools (`get_*`) are classified as `data_read` and usually
 *  excluded from "per action" reports — they are context for the model. */
export function categorizeTool(name: string): string {
  if (name.startsWith("get_")) return "data_read";
  return TOOL_TO_CATEGORY[name] ?? "other";
}

/** Distinct, non-`data_read` categories for a set of tool calls. */
export function actionCategories(toolNames: string[]): string[] {
  const set = new Set<string>();
  for (const name of toolNames) {
    const cat = categorizeTool(name);
    if (cat !== "data_read") set.add(cat);
  }

  return [...set];
}
