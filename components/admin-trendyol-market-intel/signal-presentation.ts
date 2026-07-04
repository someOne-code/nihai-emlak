export const TRENDYOL_SIGNAL_UNAVAILABLE_COPY = "Unavailable from Trendyol";

export type TrendyolMarketIntelDisplayValue = string | number | boolean | null | undefined;

export type TrendyolMarketIntelFieldPresentation = {
  tone: "value" | "unavailable" | "error";
  label: string;
  description: string | null;
};

export type TrendyolMarketIntelFieldPresentationInput = {
  value: TrendyolMarketIntelDisplayValue;
  parserError?: string | null;
};

const UNAVAILABLE_DESCRIPTION =
  "Trendyol did not expose this public signal for the latest snapshot.";

export function getTrendyolMarketIntelFieldPresentation(
  input: TrendyolMarketIntelFieldPresentationInput,
): TrendyolMarketIntelFieldPresentation {
  const parserError = input.parserError?.trim();

  if (parserError) {
    return {
      tone: "error",
      label: "Parser failed",
      description: parserError,
    };
  }

  if (input.value === null || input.value === undefined) {
    return {
      tone: "unavailable",
      label: TRENDYOL_SIGNAL_UNAVAILABLE_COPY,
      description: UNAVAILABLE_DESCRIPTION,
    };
  }

  if (typeof input.value === "boolean") {
    return {
      tone: "value",
      label: input.value ? "Yes" : "No",
      description: null,
    };
  }

  return {
    tone: "value",
    label: String(input.value),
    description: null,
  };
}
