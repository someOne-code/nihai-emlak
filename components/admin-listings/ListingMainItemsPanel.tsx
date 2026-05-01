"use client";

import { useState } from "react";

import {
  buildAdminListingMainItemDisplay,
  getAvailableMainItemAddCandidates,
  type AdminListingAvailableMainItem,
  type AdminListingDetail,
  type AdminListingMainItem,
} from "@/lib/admin-ui/listings-view-model";

// Phase 8.6 Task 5: presentational panel for the "Ana Ödeme Kalemleri"
// surface. Owns no data and never calls the admin client; the parent
// (AdminListingsView) keeps mutation orchestration and passes
// onConfigure(code, payload) callbacks down. The panel:
//  - exposes catalog candidates only (excludes already attached codes)
//  - states that attaching does NOT create a global catalog entry
//  - renders primary label / raw code / enabled & catalog status
//  - reuses existing override label / amount / multiplier behavior

export type MainItemConfigurePayload = {
  is_enabled?: boolean;
  override_label?: string | null;
  override_amount?: number | null;
  override_multiplier?: number | null;
};

type ListingMainItemsPanelProps = {
  detail: AdminListingDetail;
  items: AdminListingMainItem[];
  busy: boolean;
  onConfigure: (code: string, payload: MainItemConfigurePayload) => void;
};

export default function ListingMainItemsPanel({
  detail,
  items,
  busy,
  onConfigure,
}: ListingMainItemsPanelProps) {
  const candidates = getAvailableMainItemAddCandidates(detail);

  return (
    <div className="lstPanel">
      <div className="lstPanelHeader">
        <h2 className="lstPanelTitle">Ana Ödeme Kalemleri</h2>
        <span className="lstOptionMeta">{items.length} kayıt</span>
      </div>

      <p className="lstPanelDescription">
        Kira, depozito gibi ana ödeme kalemlerini bu ilana bağla.
      </p>

      <MainItemAddControl
        candidates={candidates}
        busy={busy}
        onConfigure={onConfigure}
      />

      <p className="lstHelperNote">
        Bu işlem global katalog oluşturmaz; seçili kalemi sadece bu
        ilana bağlar.
      </p>

      {items.length === 0 ? (
        <div className="lstEmpty">
          Bu ilana henüz ana ödeme kalemi bağlanmadı.
        </div>
      ) : (
        <div className="lstMainItemList">
          {items.map((item) => (
            <MainItemRow
              key={item.code}
              item={item}
              busy={busy}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MainItemAddControl({
  candidates,
  busy,
  onConfigure,
}: {
  candidates: AdminListingAvailableMainItem[];
  busy: boolean;
  onConfigure: (code: string, payload: MainItemConfigurePayload) => void;
}) {
  const [code, setCode] = useState(candidates[0]?.code ?? "");

  if (candidates.length === 0) {
    return (
      <div className="lstEmpty">
        Eklenebilir ana ödeme kalemi yok. Tüm aktif katalog kalemleri
        bu ilana bağlı olabilir veya global katalog boş olabilir.
      </div>
    );
  }

  const selectedCode = candidates.some((candidate) => candidate.code === code)
    ? code
    : candidates[0].code;

  return (
    <div className="lstMainItemAddBox">
      <div className="lstField">
        <label htmlFor="lstMainItemAddSelect">
          Katalogdan ana ödeme kalemi seç
        </label>
        <select
          id="lstMainItemAddSelect"
          value={selectedCode}
          disabled={busy}
          onChange={(event) => setCode(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option key={candidate.code} value={candidate.code}>
              {candidate.label || candidate.code}
            </option>
          ))}
        </select>
      </div>
      <div className="lstButtonRow" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="lstPrimaryButton"
          disabled={busy}
          onClick={() => onConfigure(selectedCode, { is_enabled: true })}
        >
          İlana ekle
        </button>
      </div>
    </div>
  );
}

function MainItemRow({
  item,
  busy,
  onConfigure,
}: {
  item: AdminListingMainItem;
  busy: boolean;
  onConfigure: (code: string, payload: MainItemConfigurePayload) => void;
}) {
  const display = buildAdminListingMainItemDisplay(item);
  const [overrideLabel, setOverrideLabel] = useState(item.overrideLabel ?? "");
  const [overrideAmount, setOverrideAmount] = useState(
    numericFieldValue(item.overrideAmount),
  );
  const [overrideMultiplier, setOverrideMultiplier] = useState(
    numericFieldValue(item.overrideMultiplier),
  );

  const handleSave = () => {
    onConfigure(item.code, {
      override_label:
        overrideLabel.trim() === "" ? null : overrideLabel.trim(),
      override_amount:
        overrideAmount.trim() === "" ? null : Number(overrideAmount),
      override_multiplier:
        overrideMultiplier.trim() === "" ? null : Number(overrideMultiplier),
    });
  };

  return (
    <div className="lstMainItemRow">
      <div className="lstMainItemHeader">
        <div className="lstMainItemTitleGroup">
          <strong>{display.primaryLabel}</strong>
          <code className="lstTechnicalCode">{display.codeLabel}</code>
        </div>
        <div className="lstMainItemBadges">
          <span
            className={
              item.isEnabled
                ? "lstChip lstChipSuccess"
                : "lstChip lstChipWarning"
            }
          >
            {display.enabledLabel}
          </span>
          <span
            className={
              item.catalogIsActive
                ? "lstChip"
                : "lstChip lstChipDanger"
            }
          >
            {display.catalogStatusLabel}
          </span>
        </div>
      </div>

      <ul className="lstMainItemFacts">
        <li>{display.defaultAmountLabel}</li>
        <li>{display.overrideAmountLabel}</li>
        <li>{display.defaultMultiplierLabel}</li>
        <li>{display.overrideMultiplierLabel}</li>
        <li>Fiyat stratejisi: {item.pricingStrategy}</li>
      </ul>

      <div className="lstInlineRow" style={{ marginTop: "0.5rem" }}>
        <div className="lstField">
          <label>Etiket override</label>
          <input
            value={overrideLabel}
            onChange={(event) => setOverrideLabel(event.target.value)}
          />
        </div>
        <div className="lstField">
          <label>Tutar override</label>
          <input
            type="number"
            min={0}
            value={overrideAmount}
            onChange={(event) => setOverrideAmount(event.target.value)}
          />
        </div>
        <div className="lstField">
          <label>Çarpan override</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={overrideMultiplier}
            onChange={(event) => setOverrideMultiplier(event.target.value)}
          />
        </div>
      </div>

      <div className="lstMainItemControls">
        <button
          type="button"
          className="lstSecondaryButton"
          disabled={busy}
          onClick={() => onConfigure(item.code, { is_enabled: !item.isEnabled })}
        >
          {item.isEnabled ? "Devre dışı bırak" : "Aktifleştir"}
        </button>
        <button
          type="button"
          className="lstPrimaryButton"
          disabled={busy}
          onClick={handleSave}
        >
          Override kaydet
        </button>
      </div>
    </div>
  );
}

function numericFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}
