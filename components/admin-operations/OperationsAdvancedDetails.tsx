import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function OperationsAdvancedDetails({
  reservationSnapshot,
  listingSnapshot,
  selectedReservationId,
  selectedListingId,
}: {
  reservationSnapshot: Record<string, unknown> | null;
  listingSnapshot: Record<string, unknown> | null;
  selectedReservationId: string | null;
  selectedListingId: string | null;
}) {
  const order = asRecord(reservationSnapshot?.order);
  const payment = asRecord(reservationSnapshot?.payment);
  const reservationLatest = asRecord(reservationSnapshot?.latestEvent);
  const listingLatest = asRecord(listingSnapshot?.latestEvent);
  const reservationEligibility = asRecord(reservationSnapshot?.eligibility);
  const listingEligibility = asRecord(listingSnapshot?.eligibility);

  const ids: Array<{ label: string; value: string }> = [];
  if (selectedReservationId) ids.push({ label: "Rezervasyon", value: selectedReservationId });
  const orderId = asString(order?.id);
  if (orderId) ids.push({ label: "Siparis", value: orderId });
  const paymentId = asString(payment?.id);
  if (paymentId) ids.push({ label: "Ödeme", value: paymentId });
  if (selectedListingId) ids.push({ label: "İlan", value: selectedListingId });

  const reservationEvent = formatEventLine(reservationLatest);
  const listingEvent = formatEventLine(listingLatest);
  const eligibilityLines = formatEligibilityLines({
    reservationEligibility,
    listingEligibility,
    selectedListingId,
  });

  if (ids.length === 0 && !reservationEvent && !listingEvent && eligibilityLines.length === 0) {
    return null;
  }

  return (
    <Collapsible className="rounded-xl border border-dashed bg-muted/30 p-4">
      <CollapsibleTrigger className="text-sm font-semibold">
        Gelişmiş detaylar
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3 text-sm">
        {ids.length > 0 && (
          <DetailSection title="Kimlikler">
            {ids.map((entry) => (
              <div key={entry.label} className="grid grid-cols-[100px_1fr] gap-2">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="font-mono text-xs break-all">{entry.value}</span>
              </div>
            ))}
          </DetailSection>
        )}
        {reservationEvent && (
          <DetailSection title="Son rezervasyon işlemi">
            <p>{reservationEvent}</p>
          </DetailSection>
        )}
        {listingEvent && (
          <DetailSection title="Son ilan işlemi">
            <p>{listingEvent}</p>
          </DetailSection>
        )}
        {eligibilityLines.length > 0 && (
          <DetailSection title="Backend izinleri">
            {eligibilityLines.map((entry) => (
              <div key={entry.label} className="grid grid-cols-[140px_1fr] gap-2">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="font-semibold">{entry.value}</span>
              </div>
            ))}
          </DetailSection>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWorkflowName(value: string | null): string | null {
  if (!value) return null;
  const map: Record<string, string> = {
    admin_cancel_reservation: "Rezervasyon iptali",
    admin_cancel_reservation_rejected: "Rezervasyon iptali reddedildi",
    admin_confirm_reservation: "Rezervasyon onayı",
    admin_confirm_reservation_rejected: "Rezervasyon onayı reddedildi",
    admin_reopen_listing: "İlan yeniden açıldı",
    admin_reopen_listing_rejected: "İlan yeniden açma reddedildi",
  };
  return map[value] ?? value;
}

function formatEventLine(event: Record<string, unknown> | null): string | null {
  if (!event) return null;
  const workflow = formatWorkflowName(asString(event.workflow_name));
  const reason = asString(event.reason);
  const note = asString(event.note);
  const createdAt = asString(event.created_at);
  if (!workflow && !reason && !note && !createdAt) return null;
  const parts: string[] = [];
  if (workflow) parts.push(workflow);
  if (reason) parts.push(`Sebep: ${reason}`);
  if (note) parts.push(`Not: ${note}`);
  if (createdAt) parts.push(createdAt);
  return parts.join(" — ");
}

function formatEligibilityLines(input: {
  reservationEligibility: Record<string, unknown> | null;
  listingEligibility: Record<string, unknown> | null;
  selectedListingId: string | null;
}): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = [];
  const re = input.reservationEligibility;
  if (re) {
    if (re.can_cancel !== undefined) {
      lines.push({ label: "İptal", value: re.can_cancel === true ? "Evet" : "Hayır" });
    }
    if (re.can_confirm !== undefined) {
      lines.push({ label: "Onay", value: re.can_confirm === true ? "Evet" : "Hayır" });
    }
  }
  if (input.selectedListingId && input.listingEligibility) {
    if (input.listingEligibility.can_reopen !== undefined) {
      lines.push({ label: "İlan yeniden açma", value: input.listingEligibility.can_reopen === true ? "Evet" : "Hayır" });
    }
  }
  return lines;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}
