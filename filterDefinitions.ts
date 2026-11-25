/**
 * Filter definitions for each screen, keyed by screen name and minimum app version.
 *
 * UWAGA: Ten plik jest jedynym źródłem prawdy o filtrach po stronie backendu.
 * Każda zmiana filtrów musi być synchronizowana z aplikacją mobilną w projekcie
 * scanner/ios, plik: src/modules/GridFilters/filterDefinitions.ts
 * i src/modules/GridFilters/types.ts.
 *
 * Przy dodaniu nowego filtra:
 * 1. Dodaj definicję poniżej dla odpowiedniej wersji aplikacji.
 * 2. Zaktualizuj typy w aplikacji (IncomesFilters / ExpensesFilters / ...).
 * 3. Dopisz nowy klucz do set_filters tool w actionVersioning.ts (minVersion).
 */

export interface FilterFieldDefinition {
  key: string;
  label: string;
  type: "text" | "amount_range" | "date_range" | "enum" | "boolean";
  enumValues?: Array<{ value: string; label: string }>;
}

export interface ScreenFilterDefinition {
  screen: string;
  minVersion: string;
  fields: FilterFieldDefinition[];
}

export const FILTER_DEFINITIONS: ScreenFilterDefinition[] = [
  {
    screen: "filters_incomes_list",
    minVersion: "1.51.0",
    fields: [
      {
        key: "issueDateFrom",
        label: "Data wystawienia od",
        type: "date_range",
      },
      {
        key: "issueDateTo",
        label: "Data wystawienia do",
        type: "date_range",
      },
      {
        key: "grossMin",
        label: "Kwota brutto od (PLN)",
        type: "amount_range",
      },
      {
        key: "grossMax",
        label: "Kwota brutto do (PLN)",
        type: "amount_range",
      },
      {
        key: "isPaid",
        label: "Opłacona",
        type: "boolean",
      },
      {
        key: "status",
        label: "Status faktury",
        type: "enum",
        enumValues: [
          { value: "issued", label: "Wystawiona" },
          { value: "draft", label: "Szkic" },
          { value: "sent", label: "Wysłana" },
          { value: "overdue", label: "Przeterminowana" },
        ],
      },
      {
        key: "search",
        label: "Szukaj (numer faktury, kontrahent)",
        type: "text",
      },
    ],
  },
  {
    screen: "filters_expenses_list",
    minVersion: "1.51.0",
    fields: [
      {
        key: "issueDateFrom",
        label: "Data wystawienia od",
        type: "date_range",
      },
      {
        key: "issueDateTo",
        label: "Data wystawienia do",
        type: "date_range",
      },
      {
        key: "grossMin",
        label: "Kwota brutto od (PLN)",
        type: "amount_range",
      },
      {
        key: "grossMax",
        label: "Kwota brutto do (PLN)",
        type: "amount_range",
      },
      {
        key: "phrase",
        label: "Szukaj (opis, kontrahent)",
        type: "text",
      },
    ],
  },
];

/** Returns the filter definition for a given screen, or null if not found. */
export function getFilterDefinition(screen: string): ScreenFilterDefinition | null {
  return FILTER_DEFINITIONS.find((d) => d.screen === screen) ?? null;
}

/** Builds a human-readable description of available filters for use in AI prompts. */
export function buildFilterDescription(def: ScreenFilterDefinition): string {
  const lines = def.fields.map((f) => {
    const typeDesc =
      f.type === "date_range" ? "data (YYYY-MM-DD)"
      : f.type === "amount_range" ? "kwota (string z liczbą, np. '100')"
      : f.type === "boolean" ? "boolean (true/false)"
      : f.type === "enum" && f.enumValues
        ? `enum: ${f.enumValues.map((e) => `"${e.value}" (${e.label})`).join(", ")}`
      : "tekst";
    return `  - ${f.key}: ${f.label} [${typeDesc}]`;
  });
  return `Dostępne filtry dla ekranu ${def.screen}:\n${lines.join("\n")}`;
}
