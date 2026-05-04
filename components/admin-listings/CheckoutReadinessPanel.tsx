"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildAdminListingCheckoutReadinessDisplay,
  type AdminListingCheckoutReadinessDisplay,
  type AdminListingCheckoutReadinessStatus,
  type AdminListingDetail,
} from "@/lib/admin-ui/listings-view-model";

// Phase 8.6 Task 7: presentational checkout readiness panel. Renders
// admin-friendly Turkish copy derived from the DB/RPC snapshot via
// `buildAdminListingCheckoutReadinessDisplay`. The view never invents
// readiness decisions; status, badge label, summary, and missing list
// items all come from the helper. The same component is reused by the
// always-visible side aside and the "Checkout Hazırlığı" tab so the
// two surfaces stay consistent by construction.

type CheckoutReadinessPanelProps = {
  detail: AdminListingDetail | null;
  variant?: "side" | "tab";
};

export default function CheckoutReadinessPanel({
  detail,
  variant = "side",
}: CheckoutReadinessPanelProps) {
  const display = buildAdminListingCheckoutReadinessDisplay(detail);
  const isSide = variant === "side";

  if (isSide) {
    return (
      <aside
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sticky top-4"
        aria-label="Checkout hazırlığı"
      >
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <h2 className="font-semibold text-sm">Checkout Hazırlığı</h2>
          <ReadinessBadge display={display} />
        </div>
        {display.summary && (
          <p className="text-xs text-muted-foreground">{display.summary}</p>
        )}
        {display.isApplicable && <ReadinessChecklist display={display} />}
      </aside>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <CardTitle className="text-base">Checkout Hazırlığı</CardTitle>
          <ReadinessBadge display={display} />
        </div>
      </CardHeader>
      <CardContent>
        {display.summary && (
          <p className="text-sm text-muted-foreground mb-3">{display.summary}</p>
        )}
        {display.isApplicable && <ReadinessChecklist display={display} />}
      </CardContent>
    </Card>
  );
}

function ReadinessBadge({
  display,
}: {
  display: AdminListingCheckoutReadinessDisplay;
}) {
  const variant = badgeVariantForStatus(display.status);
  return (
    <Badge variant={variant} aria-label={`Checkout durumu: ${display.badgeLabel}`}>
      {display.badgeLabel}
    </Badge>
  );
}

function ReadinessChecklist({
  display,
}: {
  display: AdminListingCheckoutReadinessDisplay;
}) {
  if (display.missing.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        <span>Tüm gereksinimler karşılandı.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Eksiklikleri çözmek için ilgili sekmeleri kullanın:
      </p>
      <ul className="flex flex-col gap-1.5">
        {display.missing.map((item) => (
          <li
            key={item.rawKey}
            className="flex items-start gap-2 px-3 py-2 rounded-md border bg-muted/50 text-sm"
          >
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{item.message}</span>
              {!item.isKnown && (
                <code className="font-mono text-xs text-muted-foreground">
                  {item.rawKey}
                </code>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function badgeVariantForStatus(
  status: AdminListingCheckoutReadinessStatus,
): "success" | "warning" | "secondary" {
  switch (status) {
    case "ready":
      return "success";
    case "not-ready":
      return "warning";
    case "not-applicable":
    case "unknown":
    default:
      return "secondary";
  }
}
