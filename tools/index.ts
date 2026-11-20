import type Anthropic from "@anthropic-ai/sdk";
import type { ApiContext, ToolDefinition } from "./types";
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
import openInvoiceFormTool from "./open-income-form";
import openInvoiceTool from "./open-invoice";
import downloadInvoicePdfTool from "./download-invoice-pdf";
import refreshTool from "./refresh";
import markInvoiceAsAccountedTool from "./mark-invoice-as-accounted";
import unaccountInvoiceTool from "./unaccount-invoice";
import sendInvoiceTool from "./send-invoice";
import sendInvoiceDuplicateTool from "./send-invoice-duplicate";
import sendInvoiceReminderTool from "./send-invoice-reminder";

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
  [openInvoiceFormTool.schema.name]: openInvoiceFormTool,
  [openInvoiceTool.schema.name]: openInvoiceTool,
  [downloadInvoicePdfTool.schema.name]: downloadInvoicePdfTool,
  [refreshTool.schema.name]: refreshTool,
  [markInvoiceAsAccountedTool.schema.name]: markInvoiceAsAccountedTool,
  [unaccountInvoiceTool.schema.name]: unaccountInvoiceTool,
  [sendInvoiceTool.schema.name]: sendInvoiceTool,
  [sendInvoiceDuplicateTool.schema.name]: sendInvoiceDuplicateTool,
  [sendInvoiceReminderTool.schema.name]: sendInvoiceReminderTool,
};

export const toolSchemas: Anthropic.Tool[] = Object.values(registry).map((t) => t.schema);

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ApiContext
): Promise<unknown> {
  const tool = registry[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.execute(input, ctx);
}

export type { ApiContext };
