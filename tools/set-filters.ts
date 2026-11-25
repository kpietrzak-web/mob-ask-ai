/**
 * set_filters tool — emits a SET_FILTERS action to the mobile app.
 *
 * UWAGA: Zmiana struktury filtrów (klucze, typy, enumy) wymaga aktualizacji
 * w aplikacji mobilnej (scanner/ios):
 *   - src/modules/GridFilters/filterDefinitions.ts
 *   - src/modules/GridFilters/types.ts
 *   - src/intents/types.ts (SetFiltersPayload)
 *   - src/intents/parsers/aiChat.ts (przypadek SET_FILTERS)
 * Przy dodaniu nowej wersji filtrów: zaktualizuj minVersion w actionVersioning.ts.
 */
import type { ToolDefinition } from "./types";

const setFiltersTool: ToolDefinition = {
  schema: {
    name: "set_filters",
    description:
      "Ustaw filtry na bieżącym ekranie listy (przychody lub koszty) w aplikacji mobilnej." +
      " Wywołuj TYLKO gdy użytkownik podał konkretne kryteria filtrowania (np. zakres dat, kwotę, status)." +
      " Pola opcjonalne — wysyłaj tylko te, które użytkownik faktycznie podał." +
      " Daty w formacie YYYY-MM-DD. Kwoty jako string z liczbą (np. '100.50')." +
      " Nie podawaj pustych stringów ani null — po prostu nie dołączaj pola.",
    input_schema: {
      type: "object",
      properties: {
        filterType: {
          type: "string",
          enum: ["incomes", "expenses"],
          description: "Typ filtrowanej listy: 'incomes' — faktury sprzedażowe, 'expenses' — koszty",
        },
        issueDateFrom: {
          type: "string",
          description: "Data wystawienia od (YYYY-MM-DD)",
        },
        issueDateTo: {
          type: "string",
          description: "Data wystawienia do (YYYY-MM-DD)",
        },
        grossMin: {
          type: "string",
          description: "Minimalna kwota brutto, np. '100' lub '100.50'",
        },
        grossMax: {
          type: "string",
          description: "Maksymalna kwota brutto, np. '500' lub '500.00'",
        },
        isPaid: {
          type: "boolean",
          description: "Tylko przychody: true = tylko opłacone, false = tylko nieopłacone",
        },
        status: {
          type: "array",
          items: { type: "string", enum: ["issued", "draft", "sent", "overdue"] },
          description: "Tylko przychody: status faktury",
        },
        phrase: {
          type: "string",
          description: "Tylko koszty: tekst do wyszukania",
        },
        search: {
          type: "string",
          description: "Tylko przychody: tekst do wyszukania (numer faktury lub kontrahent)",
        },
      },
      required: ["filterType"],
    },
  },

  async execute(input, ctx) {
    const { filterType, ...filters } = input as {
      filterType: "incomes" | "expenses";
      issueDateFrom?: string;
      issueDateTo?: string;
      grossMin?: string;
      grossMax?: string;
      isPaid?: boolean;
      status?: string[];
      phrase?: string;
      search?: string;
    };

    ctx.emit({
      type: "SET_FILTERS",
      actionType: "direct",
      payload: { filterType, filters },
    });

    return { success: true };
  },
};

export default setFiltersTool;
