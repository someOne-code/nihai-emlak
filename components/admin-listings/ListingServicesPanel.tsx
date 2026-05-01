"use client";

import { useState } from "react";

import {
  buildAdminListingServiceDisplay,
  getAvailableServiceAddCandidates,
  type AdminListingAvailableService,
  type AdminListingDetail,
  type AdminListingService,
} from "@/lib/admin-ui/listings-view-model";

// Phase 8.6 Task 6: presentational panel for the "Ek Hizmetler"
// surface. Owns no data and never calls the admin client; the parent
// (AdminListingsView) keeps mutation orchestration and passes
// onConfigure(code, payload) callbacks down. The panel:
//  - exposes catalog candidates only (excludes already attached codes)
//  - states that attaching does NOT create a global service catalog
//  - renders primary name / raw code / enabled & catalog status
//  - reuses existing override price behavior

export type ServiceConfigurePayload = {
  is_enabled?: boolean;
  override_price?: number | null;
};

type ListingServicesPanelProps = {
  detail: AdminListingDetail;
  services: AdminListingService[];
  busy: boolean;
  onConfigure: (code: string, payload: ServiceConfigurePayload) => void;
};

export default function ListingServicesPanel({
  detail,
  services,
  busy,
  onConfigure,
}: ListingServicesPanelProps) {
  const candidates = getAvailableServiceAddCandidates(detail);

  return (
    <div className="lstPanel">
      <div className="lstPanelHeader">
        <h2 className="lstPanelTitle">Ek Hizmetler</h2>
        <span className="lstOptionMeta">{services.length} kayıt</span>
      </div>

      <p className="lstPanelDescription">
        Temizlik, taşıma gibi ek hizmetleri bu ilana bağla.
      </p>

      <ServiceAddControl
        candidates={candidates}
        busy={busy}
        onConfigure={onConfigure}
      />

      <p className="lstHelperNote">
        Bu işlem global hizmet katalogu oluşturmaz; seçili hizmeti
        sadece bu ilana bağlar.
      </p>

      {services.length === 0 ? (
        <div className="lstEmpty">
          Bu ilana henüz ek hizmet bağlanmadı.
        </div>
      ) : (
        <div className="lstMainItemList">
          {services.map((service) => (
            <ServiceRow
              key={service.code}
              service={service}
              busy={busy}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceAddControl({
  candidates,
  busy,
  onConfigure,
}: {
  candidates: AdminListingAvailableService[];
  busy: boolean;
  onConfigure: (code: string, payload: ServiceConfigurePayload) => void;
}) {
  const [code, setCode] = useState(candidates[0]?.code ?? "");

  if (candidates.length === 0) {
    return (
      <div className="lstEmpty">
        Eklenebilir hizmet yok. Tüm aktif katalog hizmetleri bu ilana
        bağlı olabilir veya global katalog boş olabilir.
      </div>
    );
  }

  const selectedCode = candidates.some((candidate) => candidate.code === code)
    ? code
    : candidates[0].code;

  return (
    <div className="lstMainItemAddBox">
      <div className="lstField">
        <label htmlFor="lstServiceAddSelect">
          Katalogdan ek hizmet seç
        </label>
        <select
          id="lstServiceAddSelect"
          value={selectedCode}
          disabled={busy}
          onChange={(event) => setCode(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option key={candidate.code} value={candidate.code}>
              {candidate.name || candidate.code}
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

function ServiceRow({
  service,
  busy,
  onConfigure,
}: {
  service: AdminListingService;
  busy: boolean;
  onConfigure: (code: string, payload: ServiceConfigurePayload) => void;
}) {
  const display = buildAdminListingServiceDisplay(service);
  const [overridePrice, setOverridePrice] = useState(
    numericFieldValue(service.overridePrice),
  );

  const handleSave = () => {
    onConfigure(service.code, {
      override_price:
        overridePrice.trim() === "" ? null : Number(overridePrice),
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
              service.isEnabled
                ? "lstChip lstChipSuccess"
                : "lstChip lstChipWarning"
            }
          >
            {display.enabledLabel}
          </span>
          <span
            className={
              service.catalogIsActive
                ? "lstChip"
                : "lstChip lstChipDanger"
            }
          >
            {display.catalogStatusLabel}
          </span>
        </div>
      </div>

      <ul className="lstMainItemFacts">
        <li>{display.basePriceLabel}</li>
        <li>{display.overridePriceLabel}</li>
      </ul>

      <div className="lstInlineRow" style={{ marginTop: "0.5rem" }}>
        <div className="lstField">
          <label>Override fiyat</label>
          <input
            type="number"
            min={0}
            value={overridePrice}
            onChange={(event) => setOverridePrice(event.target.value)}
          />
        </div>
      </div>

      <div className="lstMainItemControls">
        <button
          type="button"
          className="lstSecondaryButton"
          disabled={busy}
          onClick={() =>
            onConfigure(service.code, { is_enabled: !service.isEnabled })
          }
        >
          {service.isEnabled ? "Devre dışı bırak" : "Aktifleştir"}
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
