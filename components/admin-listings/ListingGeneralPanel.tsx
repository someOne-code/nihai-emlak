"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import type { AdminListingDetail } from "@/lib/admin-ui/listings-view-model";

// Phase 8.6 Task 7: presentational panel for the "Genel Bilgiler" tab.
// Owns no data and never calls the admin client; the parent
// (AdminListingsView) keeps mutation orchestration and passes
// onSave(payload) and onStatusChange(status) callbacks down.
//
// Compared to the inline DetailPanel that lived in AdminListingsView
// this panel:
//  - splits fields into admin-readable groups (Temel / Konum / Fiyat /
//    Özellikler / Açıklama)
//  - keeps slug and type as read-only chips so the existing update
//    payload is not silently extended
//  - renders the status as two explicit actions (Aktifleştir / Pasife
//    al) where the current status is disabled
//  - never invents a currency: the form keeps whatever the snapshot
//    returned, including null/empty values
//  - drops the inline missing-reasons banner; readiness is now owned
//    by CheckoutReadinessPanel

export type ListingGeneralPanelProps = {
  detail: AdminListingDetail;
  busy: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onStatusChange: (status: "active" | "passive") => void;
};

export default function ListingGeneralPanel({
  detail,
  busy,
  onSave,
  onStatusChange,
}: ListingGeneralPanelProps) {
  const [title, setTitle] = useState(detail.listing.title);
  const [summary, setSummary] = useState(detail.listing.summary ?? "");
  const [description, setDescription] = useState(
    detail.listing.description ?? "",
  );
  const [city, setCity] = useState(detail.listing.city ?? "");
  const [district, setDistrict] = useState(detail.listing.district ?? "");
  const [price, setPrice] = useState(numericFieldValue(detail.listing.price));
  const [currency, setCurrency] = useState(detail.listing.currency ?? "");
  const [roomCount, setRoomCount] = useState(
    numericFieldValue(detail.listing.roomCount),
  );
  const [bathroomCount, setBathroomCount] = useState(
    numericFieldValue(detail.listing.bathroomCount),
  );
  const [grossArea, setGrossArea] = useState(
    numericFieldValue(detail.listing.grossAreaM2),
  );
  const [isFurnished, setIsFurnished] = useState(detail.listing.isFurnished);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      title: title.trim(),
      summary: summary.trim() || null,
      description: description.trim() || null,
      city: city.trim() || null,
      district: district.trim() || null,
      price: price.trim() === "" ? 0 : Number(price),
      // Currency is never invented here; if the field is empty we send
      // an empty string so the existing API/RPC validator keeps owning
      // the rule. This preserves the prior behavior for already-set
      // listings (currency persists when the admin does not touch it).
      currency: currency.trim(),
      room_count: roomCount.trim() === "" ? null : Number(roomCount),
      bathroom_count:
        bathroomCount.trim() === "" ? null : Number(bathroomCount),
      gross_area_m2: grossArea.trim() === "" ? null : Number(grossArea),
      is_furnished: isFurnished,
    });
  };

  const isActive = detail.listing.status === "active";
  const typeLabel = detail.listing.type === "rent" ? "Kiralık" : "Satılık";

  return (
    <div className="lstPanel">
      <div className="lstPanelHeader">
        <div className="lstGeneralPanelTitleGroup">
          <h2 className="lstPanelTitle">Genel bilgiler</h2>
          <p className="lstPanelDescription">
            Bu ilanın temel bilgilerini, konumunu, fiyatını ve özelliklerini
            buradan yönet.
          </p>
        </div>
        <div className="lstStatusActionRow">
          <span
            className={
              isActive
                ? "lstChip lstChipSuccess"
                : "lstChip lstChipWarning"
            }
            aria-label="Mevcut durum"
          >
            {isActive ? "Şu an aktif" : "Şu an pasif"}
          </span>
          <button
            type="button"
            className="lstSecondaryButton"
            disabled={busy || isActive}
            onClick={() => onStatusChange("active")}
          >
            Aktifleştir
          </button>
          <button
            type="button"
            className="lstSecondaryButton"
            disabled={busy || !isActive}
            onClick={() => onStatusChange("passive")}
          >
            Pasife al
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup title="Temel bilgiler">
          <Field label="İlan başlığı">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </Field>
          <Field label="İlan türü">
            <ReadOnlyValue>{typeLabel}</ReadOnlyValue>
          </Field>
          <Field label="Slug">
            <ReadOnlyValue>
              <code className="lstTechnicalCode">{detail.listing.slug}</code>
            </ReadOnlyValue>
          </Field>
        </FieldGroup>

        <FieldGroup title="Konum">
          <Field label="Şehir">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </Field>
          <Field label="İlçe">
            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Fiyat">
          <Field label="Fiyat">
            <input
              type="number"
              min={0}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>
          <Field label="Para birimi">
            <input
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              placeholder="Örn. TRY"
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="Özellikler">
          <Field label="Oda sayısı">
            <input
              type="number"
              min={0}
              value={roomCount}
              onChange={(event) => setRoomCount(event.target.value)}
            />
          </Field>
          <Field label="Banyo sayısı">
            <input
              type="number"
              min={0}
              value={bathroomCount}
              onChange={(event) => setBathroomCount(event.target.value)}
            />
          </Field>
          <Field label="Brüt alan (m²)">
            <input
              type="number"
              min={0}
              value={grossArea}
              onChange={(event) => setGrossArea(event.target.value)}
            />
          </Field>
          <Field label="Mobilyalı">
            <label className="lstCheckboxRow">
              <input
                type="checkbox"
                checked={isFurnished}
                onChange={(event) => setIsFurnished(event.target.checked)}
              />
              <span>Mobilyalı</span>
            </label>
          </Field>
        </FieldGroup>

        <FieldGroup title="Açıklama">
          <Field label="Özet">
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </Field>
          <Field label="Açıklama">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <div className="lstButtonRow">
          <button
            type="submit"
            className="lstPrimaryButton"
            disabled={busy}
          >
            İlan bilgilerini kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="lstFieldGroup">
      <legend className="lstFieldGroupTitle">{title}</legend>
      <div className="lstFormGrid">{children}</div>
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lstField">
      <label>{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return <div className="lstReadOnlyValue">{children}</div>;
}

function numericFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}
