import type { FunctionTool } from "openai/resources/responses/responses";
import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";
import type { ApiContext, ToolDefinition, ToolSchema } from "./types";
import { Sentry } from "../config";
import { devLog } from "../logger";
import userInfoTool from "./user-info";
import contractorsTool from "./contractors";
import bankAccountsTool from "./bank-accounts";
import invoicesTool from "./invoices";
import invoiceTemplatesTool from "./invoice-templates";
import invoiceSendingHistoryTool from "./invoice-sending-history";
import expensesTool from "./expenses";
import invoicesSummaryTool from "./invoices-summary";
import statisticsTool from "./statistics";
import documentTopicsTool from "./document-topics";
import invoiceSequencesTool from "./invoice-sequences";
import ksefStatisticsTool from "./ksef-statistics";
import settingsTool from "./settings";
import dashboardTool from "./dashboard";
import closeMonthStatusTool from "./close-month-status";
import referralTool from "./referral";
import referralInvitationsTool from "./referral-invitations";
import openContractorFormTool from "./open-contractor-form";
import companyGusTool from "./company-gus";
import createContractorTool from "./create-contractor";
import suggestReplyTool from "./suggest-reply";
import openInvoiceFormTool from "./open-income-form";
import openInvoiceTool from "./open-invoice";
import downloadInvoicePdfTool from "./download-invoice-pdf";
import refreshTool from "./refresh";
import markInvoiceAsAccountedTool from "./mark-invoice-as-accounted";
import unaccountInvoiceTool from "./unaccount-invoice";
import sendInvoiceTool from "./send-invoice";
import sendInvoiceDuplicateTool from "./send-invoice-duplicate";
import sendInvoiceReminderTool from "./send-invoice-reminder";
import editIncomeTool from "./edit-income";
import showStatisticsTool from "./show-statistics";
import showTasksTool from "./show-tasks";
import showTaskTool from "./show-task";
import approveMonthTool from "./approve-month";
import showContractorsTool from "./show-contractors";
import showContractorTool from "./show-contractor";
import editContractorTool from "./edit-contractor";
import showSequencesTool from "./show-sequences";
import submitBugReportTool from "./submit-bug-report";
import showKsefTool from "./show-ksef";
import setFiltersTool from "./set-filters";
import closeVoiceChatTool from "./close-voice-chat";

const registry: Record<string, ToolDefinition> = {
  [userInfoTool.schema.name]: userInfoTool,
  [contractorsTool.schema.name]: contractorsTool,
  [bankAccountsTool.schema.name]: bankAccountsTool,
  [invoicesTool.schema.name]: invoicesTool,
  [invoiceTemplatesTool.schema.name]: invoiceTemplatesTool,
  [invoiceSendingHistoryTool.schema.name]: invoiceSendingHistoryTool,
  [expensesTool.schema.name]: expensesTool,
  [invoicesSummaryTool.schema.name]: invoicesSummaryTool,
  [statisticsTool.schema.name]: statisticsTool,
  [documentTopicsTool.schema.name]: documentTopicsTool,
  [invoiceSequencesTool.schema.name]: invoiceSequencesTool,
  [ksefStatisticsTool.schema.name]: ksefStatisticsTool,
  [settingsTool.schema.name]: settingsTool,
  [dashboardTool.schema.name]: dashboardTool,
  [closeMonthStatusTool.schema.name]: closeMonthStatusTool,
  [referralTool.schema.name]: referralTool,
  [referralInvitationsTool.schema.name]: referralInvitationsTool,
  [openContractorFormTool.schema.name]: openContractorFormTool,
  [companyGusTool.schema.name]: companyGusTool,
  [createContractorTool.schema.name]: createContractorTool,
  [suggestReplyTool.schema.name]: suggestReplyTool,
  [openInvoiceFormTool.schema.name]: openInvoiceFormTool,
  [openInvoiceTool.schema.name]: openInvoiceTool,
  [downloadInvoicePdfTool.schema.name]: downloadInvoicePdfTool,
  [refreshTool.schema.name]: refreshTool,
  [markInvoiceAsAccountedTool.schema.name]: markInvoiceAsAccountedTool,
  [unaccountInvoiceTool.schema.name]: unaccountInvoiceTool,
  [sendInvoiceTool.schema.name]: sendInvoiceTool,
  [sendInvoiceDuplicateTool.schema.name]: sendInvoiceDuplicateTool,
  [sendInvoiceReminderTool.schema.name]: sendInvoiceReminderTool,
  [editIncomeTool.schema.name]: editIncomeTool,
  [showStatisticsTool.schema.name]: showStatisticsTool,
  [showTasksTool.schema.name]: showTasksTool,
  [showTaskTool.schema.name]: showTaskTool,
  [approveMonthTool.schema.name]: approveMonthTool,
  [showContractorsTool.schema.name]: showContractorsTool,
  [showContractorTool.schema.name]: showContractorTool,
  [editContractorTool.schema.name]: editContractorTool,
  [showSequencesTool.schema.name]: showSequencesTool,
  [submitBugReportTool.schema.name]: submitBugReportTool,
  [showKsefTool.schema.name]: showKsefTool,
  // UWAGA: dodanie nowego narzędzia wymaga aktualizacji actionVersioning.ts (minVersion)
  // i synchronizacji z aplikacją mobilną: scanner/ios/src/intents/types.ts
  [setFiltersTool.schema.name]: setFiltersTool,
  [closeVoiceChatTool.schema.name]: closeVoiceChatTool,
};

export const toolSchemas: ToolSchema[] = Object.values(registry).map((t) => t.schema);

/** Tools in OpenAI Responses API format (`POST /chat`). */
export const chatTools: FunctionTool[] = toolSchemas.map((s) => ({
  type: "function",
  name: s.name,
  description: s.description,
  parameters: s.input_schema,
  strict: false,
}));

/** Tools in OpenAI Realtime session format (`/realtime` voice). */
export const realtimeTools: RealtimeFunctionTool[] = toolSchemas.map((s) => ({
  type: "function",
  name: s.name,
  description: s.description,
  parameters: s.input_schema,
}));

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ApiContext
): Promise<unknown> {
  const tool = registry[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.execute(input, ctx);
}

/**
 * Runs a tool and returns a JSON string for the model. Errors (bad JSON args,
 * network failures, invalid API responses) are returned to the model as
 * `{ error }` instead of breaking the conversation.
 */
export async function runToolForModel(
  name: string,
  rawArgs: string,
  ctx: ApiContext,
  logPrefix = "[tool]"
): Promise<string> {
  try {
    const input = (rawArgs ? JSON.parse(rawArgs) : {}) as Record<string, unknown>;
    devLog(`${logPrefix} ${name}`, Object.keys(input).length ? input : "");
    const result = await executeTool(name, input, ctx);
    devLog(`${logPrefix} ${name} → done`);
    return JSON.stringify(result ?? null);
  } catch (err) {
    console.error(`${logPrefix} ${name} → error`, err);
    Sentry.captureException(err, { extra: { tool: name, args: rawArgs } });
    return JSON.stringify({ error: "Operacja nie powiodła się. Spróbuj ponownie lub skontaktuj się z supportem." });
  }
}

export type { ApiContext };
