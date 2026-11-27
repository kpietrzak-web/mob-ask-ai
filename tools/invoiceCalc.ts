/**
 * Invoice amount calculation — mirrors the mobile app's logic
 * (scanner/src/screens/Invoice/Summary/helpers/incomeGrossCalculation.ts and
 * IncomeFormSummaryScreen.prepareItem) so the chat shows and posts exactly the
 * same net / VAT / gross values as the form. The model never does the math.
 *
 * The app uses bignumber.js with the default ROUND_HALF_UP at 2 decimals;
 * round2() reproduces that (the small epsilon offsets binary-float error so
 * e.g. 2.675 → 2.68, matching decimal rounding).
 */

export type CalculationType = "N" | "G";

/** Round to 2 decimals, half-up, compensating for float representation error. */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + 1e-9) * 100)) / 100;
}

export interface InvoiceItemInput {
  name: string;
  quantity: number;
  /** Net unit price for calculationType 'N', gross unit price for 'G'. */
  unitPrice: number;
  /** VAT rate: -2 = NP, -1 = ZW, 0, 5, 8, 23 (negative codes calculated as 0%). */
  taxRate: number;
  unit?: string;
}

export interface ComputedInvoiceItem {
  name: string;
  quantity: number;
  unit?: string;
  taxRate: number;
  unitNet: number;
  net: number;
  gross: number;
  vat: number;
}

/** Compute net / gross / VAT for one line, matching prepareItem in the app. */
export function computeItem(calculationType: CalculationType, item: InvoiceItemInput): ComputedInvoiceItem {
  const { name, quantity, unitPrice, taxRate, unit } = item;
  const effectiveTax = Math.max(taxRate, 0);
  const multiplier = effectiveTax / 100 + 1;

  let unitNet: number;
  let net: number;
  let gross: number;

  if (calculationType === "G") {
    // unitPrice is the GROSS unit price (the app keeps it as unitNet in G mode).
    unitNet = unitPrice;
    gross = round2(quantity * unitPrice);
    net = round2((quantity * unitPrice) / multiplier);
  } else {
    // 'N' — unitPrice is the NET unit price.
    unitNet = round2(unitPrice);
    net = round2(quantity * unitPrice);
    gross = round2(net * multiplier);
  }

  return { name, quantity, unit, taxRate, unitNet, net, gross, vat: round2(gross - net) };
}

export interface InvoiceTotals {
  net: number;
  vat: number;
  gross: number;
}

export function computeTotals(items: ComputedInvoiceItem[], calculationType: CalculationType): InvoiceTotals {
  const gross = round2(items.reduce((a, i) => a + i.gross, 0));

  if (calculationType === "N") {
    const net = round2(items.reduce((a, i) => a + i.net, 0));
    return { net, vat: round2(gross - net), gross };
  }

  // Gross mode: group gross by tax rate, derive net per rate, then sum — mirrors
  // the app's calculateTotalNet (so the displayed total net matches the form).
  const grossByRate = new Map<number, number>();
  for (const i of items) {
    grossByRate.set(i.taxRate, round2((grossByRate.get(i.taxRate) ?? 0) + i.gross));
  }
  let net = 0;
  for (const [rate, grossSum] of grossByRate) {
    net += rate <= 0 ? grossSum : round2(grossSum / (rate / 100 + 1));
  }
  net = round2(net);
  return { net, vat: round2(gross - net), gross };
}
