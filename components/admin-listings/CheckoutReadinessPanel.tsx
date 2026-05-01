"use client";

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

  const wrapperClassName = isSide ? "lstReadinessPanel" : "lstPanel";
  const Wrapper = isSide ? "aside" : "section";
  const wrapperProps = isSide
    ? { "aria-label": "Checkout hazırlığı" }
    : ({} as Record<string, never>);

  return (
    <Wrapper className={wrapperClassName} {...wrapperProps}>
      <div className="lstReadinessHeader">
        <h2 className="lstPanelTitle">Checkout hazırlığı</h2>
        <ReadinessBadge display={display} />
      </div>

      {display.summary && (
        <p className="lstReadinessHint">{display.summary}</p>
      )}

      {display.isApplicable && (
        <ReadinessChecklist display={display} />
      )}
    </Wrapper>
  );
}

function ReadinessBadge({
  display,
}: {
  display: AdminListingCheckoutReadinessDisplay;
}) {
  return (
    <span
      className={`lstChip ${chipModifierForStatus(display.status)}`}
      aria-label={`Checkout durumu: ${display.badgeLabel}`}
    >
      {display.badgeLabel}
    </span>
  );
}

function ReadinessChecklist({
  display,
}: {
  display: AdminListingCheckoutReadinessDisplay;
}) {
  if (display.missing.length === 0) {
    return (
      <p className="lstReadinessHint">
        Bu ilan için bilinen eksik konfigürasyon yok.
      </p>
    );
  }

  return (
    <div className="lstReadinessChecklistGroup">
      <p className="lstReadinessHint">
        Eksiklikleri çözmek için ilgili sekmeleri kullan:
      </p>
      <ul className="lstReadinessChecklist">
        {display.missing.map((item) => (
          <li key={item.rawKey} className="lstReadinessChecklistItem">
            <span
              className="lstReadinessChecklistMarker"
              aria-hidden="true"
            >
              ●
            </span>
            <div className="lstReadinessChecklistBody">
              <span className="lstReadinessChecklistMessage">
                {item.message}
              </span>
              {!item.isKnown && (
                <code className="lstTechnicalCode">{item.rawKey}</code>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function chipModifierForStatus(
  status: AdminListingCheckoutReadinessStatus,
): string {
  switch (status) {
    case "ready":
      return "lstChipSuccess";
    case "not-ready":
      return "lstChipWarning";
    case "not-applicable":
      return "lstChipNeutral";
    case "unknown":
    default:
      return "lstChipNeutral";
  }
}
