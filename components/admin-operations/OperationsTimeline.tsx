import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildOperationsTimelineEntries } from "@/lib/admin-ui/operations-timeline";

const TIMELINE_DATE_FORMAT = {
  locale: "tr-TR",
  timeZone: "Europe/Istanbul",
} as const;

export function OperationsTimeline({
  reservationSnapshot,
  listingSnapshot,
  documentTracking,
  eventHistory,
  financeOps,
}: {
  reservationSnapshot: Record<string, unknown> | null;
  listingSnapshot: Record<string, unknown> | null;
  documentTracking?: Record<string, unknown> | null;
  eventHistory?: Record<string, unknown>[];
  financeOps?: Record<string, unknown> | null;
}) {
  const entries = buildOperationsTimelineEntries(
    reservationSnapshot,
    listingSnapshot,
    documentTracking ?? null,
    financeOps ?? null,
    eventHistory ?? [],
  );
  if (entries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">İşlem Geçmişi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[360px] overflow-y-auto pr-2">
          <ol className="relative space-y-4 border-l border-border pl-6">
            {entries.map((entry, i) => (
              <li key={`${entry.label}-${entry.timestamp ?? i}`} className="relative">
                <span className="absolute -left-[25px] top-1 flex h-3 w-3 rounded-full border-2 border-primary bg-background" />
                <p className="text-sm font-semibold">{entry.label}</p>
                {entry.detail && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{entry.detail}</p>
                )}
                {entry.timestamp && (
                  <p className="text-xs text-muted-foreground/70">{formatTimelineDate(entry.timestamp)}</p>
                )}
                {i < entries.length - 1 && <Separator className="mt-3" />}
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimelineDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(TIMELINE_DATE_FORMAT.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIMELINE_DATE_FORMAT.timeZone,
  }).format(date);
}
