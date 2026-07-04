import {
  getTrendyolMarketIntelFieldPresentation,
  type TrendyolMarketIntelDisplayValue,
} from "./signal-presentation";

export type TrendyolMarketIntelSignalField = {
  key: string;
  label: string;
  value: TrendyolMarketIntelDisplayValue;
  parserError?: string | null;
};

type TrendyolSignalCardProps = {
  title: string;
  fields: TrendyolMarketIntelSignalField[];
};

export function TrendyolSignalCard({ title, fields }: TrendyolSignalCardProps) {
  const presentations = fields.map((field) => ({
    field,
    presentation: getTrendyolMarketIntelFieldPresentation(field),
  }));
  const unavailableCount = presentations.filter(
    ({ presentation }) => presentation.tone === "unavailable",
  ).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {unavailableCount > 0 ? (
          <p className="text-xs leading-5 text-slate-600">
            Some public signals are not exposed by Trendyol for this product.
          </p>
        ) : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {presentations.map(({ field, presentation }) => (
          <div key={field.key} className="min-w-0 rounded-md border border-slate-100 p-3">
            <dt className="text-xs font-medium text-slate-500">{field.label}</dt>
            <dd
              className={
                presentation.tone === "error"
                  ? "mt-1 text-sm font-semibold text-red-700"
                  : presentation.tone === "unavailable"
                    ? "mt-1 text-sm font-medium text-slate-500"
                    : "mt-1 text-sm font-semibold text-slate-950"
              }
            >
              {presentation.tone === "error" ? "Parser failed" : presentation.label}
            </dd>
            {presentation.description ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">{presentation.description}</p>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
