"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  const [heatingType, setHeatingType] = useState(detail.listing.heatingType ?? "");
  const [fuelType, setFuelType] = useState(detail.listing.fuelType ?? "");
  const [balconyCount, setBalconyCount] = useState(
    numericFieldValue(detail.listing.balconyCount),
  );
  const [hasElevator, setHasElevator] = useState(
    nullableBooleanFieldValue(detail.listing.hasElevator),
  );
  const [parkingType, setParkingType] = useState(detail.listing.parkingType ?? "");
  const [inSite, setInSite] = useState(nullableBooleanFieldValue(detail.listing.inSite));
  const [buildingAge, setBuildingAge] = useState(
    numericFieldValue(detail.listing.buildingAge),
  );
  const [floorCount, setFloorCount] = useState(
    numericFieldValue(detail.listing.floorCount),
  );
  const [floorNumber, setFloorNumber] = useState(detail.listing.floorNumber ?? "");
  const [usageStatus, setUsageStatus] = useState(detail.listing.usageStatus ?? "");
  const [facade, setFacade] = useState(detail.listing.facade ?? "");
  const [grossArea, setGrossArea] = useState(
    numericFieldValue(detail.listing.grossAreaM2),
  );
  const [isFurnished, setIsFurnished] = useState(detail.listing.isFurnished);
  const [showErrors, setShowErrors] = useState(false);

  const titleError = showErrors && !title.trim() ? "Bu alan zorunludur" : null;
  const districtError = showErrors && !district.trim() ? "Bu alan zorunludur" : null;
  const descriptionError = showErrors && !description.trim() ? "Bu alan zorunludur" : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !district.trim() || !description.trim()) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
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
      heating_type: heatingType || null,
      fuel_type: fuelType || null,
      balcony_count: balconyCount.trim() === "" ? null : Number(balconyCount),
      has_elevator: parseNullableBooleanFieldValue(hasElevator),
      parking_type: parkingType || null,
      in_site: parseNullableBooleanFieldValue(inSite),
      building_age: buildingAge.trim() === "" ? null : Number(buildingAge),
      floor_count: floorCount.trim() === "" ? null : Number(floorCount),
      floor_number: floorNumber.trim() || null,
      usage_status: usageStatus || null,
      facade: facade.trim() || null,
      gross_area_m2: grossArea.trim() === "" ? null : Number(grossArea),
      is_furnished: isFurnished,
    });
  };

  const isActive = detail.listing.status === "active";
  const typeLabel = detail.listing.type === "rent" ? "Kiralık" : "Satılık";
  const isRent = detail.listing.type === "rent";
  const isCheckoutReady = detail.checkoutEligibility.isCheckoutReady;
  const isPublishReady = detail.publishReadiness.isPublishReady;
  const canPublish = isPublishReady && (!isRent || isCheckoutReady);
  const publishBlockReasons: string[] = [];
  const publishFieldLabels: Record<string, string> = { description: "Açıklama", district: "İlçe", image: "Görsel" };
  for (const key of detail.publishReadiness.missing) {
    publishBlockReasons.push(publishFieldLabels[key] ?? key);
  }
  if (isRent && !isCheckoutReady) {
    publishBlockReasons.push("Checkout yapılandırması");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Genel Bilgiler</CardTitle>
            <CardDescription>
              İlanın temel bilgilerini, konumunu ve fiyatını buradan düzenleyin.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge
              variant={isActive ? "success" : "warning"}
              aria-label={
                isActive
                  ? "Yayın durumu: ilan şu anda müşterilere görünür."
                  : "Yayın durumu: ilan müşterilere görünmüyor."
              }
              title={
                isActive
                  ? "Yayın durumu: ilan şu anda müşterilere görünür."
                  : "Yayın durumu: ilan müşterilere görünmüyor."
              }
            >
              {isActive ? "Yayında" : "Yayın dışı"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || isActive || !canPublish}
              onClick={() => onStatusChange("active")}
              title={
                !canPublish
                  ? `Yayına almak için eksikleri tamamlayın: ${publishBlockReasons.join(", ")}`
                  : "İlanı yayına alır ve müşterilere görünür yapar."
              }
            >
              Yayına al
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !isActive}
              onClick={() => onStatusChange("passive")}
              title="İlanı yayından kaldırır; müşteri tarafında görünmez."
            >
              Yayından kaldır
            </Button>
          </div>
          {!canPublish && !isActive && publishBlockReasons.length > 0 && (
            <div className="mt-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                Yayına almak için aşağıdaki eksikleri tamamlayın:
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                {publishBlockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <FieldGroup title="Temel Bilgiler">
            <Field label="İlan başlığı" required error={titleError}>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className={titleError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </Field>
            <Field label="İlan türü">
              <ReadOnlyValue>{typeLabel}</ReadOnlyValue>
            </Field>
            <Field label="URL Adresi (Slug)">
              <ReadOnlyValue>
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {detail.listing.slug}
                </code>
              </ReadOnlyValue>
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup title="Konum">
            <Field label="Şehir">
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Örn: İstanbul"
              />
            </Field>
            <Field label="İlçe" required error={districtError}>
              <Input
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                placeholder="Örn: Kadıköy"
                className={districtError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup title="Fiyat">
            <Field label="Fiyat">
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
            <Field label="Para birimi">
              <Select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="">Belirtilmedi</option>
              </Select>
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup title="Özellikler">
            <Field label="Oda sayısı">
              <Input
                type="number"
                min={0}
                value={roomCount}
                onChange={(event) => setRoomCount(event.target.value)}
              />
            </Field>
            <Field label="Banyo sayısı">
              <Input
                type="number"
                min={0}
                value={bathroomCount}
                onChange={(event) => setBathroomCount(event.target.value)}
              />
            </Field>
            <Field label="Isıtma">
              <Select value={heatingType} onChange={(event) => setHeatingType(event.target.value)}>
                <option value="">Belirtilmedi</option>
                <option value="central">Merkezi Sistem</option>
                <option value="combi">Kombi</option>
                <option value="floor_heating">Yerden Isıtma</option>
                <option value="stove">Soba</option>
                <option value="air_conditioning">Klima</option>
                <option value="none">Yok</option>
                <option value="other">Diğer</option>
              </Select>
            </Field>
            <Field label="Yakıt">
              <Select value={fuelType} onChange={(event) => setFuelType(event.target.value)}>
                <option value="">Belirtilmedi</option>
                <option value="natural_gas">Doğalgaz</option>
                <option value="electricity">Elektrik</option>
                <option value="coal">Kömür</option>
                <option value="fuel_oil">Fuel Oil</option>
                <option value="none">Yok</option>
                <option value="other">Diğer</option>
              </Select>
            </Field>
            <Field label="Balkon sayısı">
              <Input
                type="number"
                min={0}
                value={balconyCount}
                onChange={(event) => setBalconyCount(event.target.value)}
              />
            </Field>
            <Field label="Asansör">
              <Select value={hasElevator} onChange={(event) => setHasElevator(event.target.value)}>
                <option value="">Belirtilmedi</option>
                <option value="true">Var</option>
                <option value="false">Yok</option>
              </Select>
            </Field>
            <Field label="Otopark">
              <Select value={parkingType} onChange={(event) => setParkingType(event.target.value)}>
                <option value="">Belirtilmedi</option>
                <option value="open">Açık Otopark</option>
                <option value="closed">Kapalı Otopark</option>
                <option value="open_closed">Açık ve Kapalı Otopark</option>
                <option value="none">Yok</option>
                <option value="other">Diğer</option>
              </Select>
            </Field>
            <Field label="Site içerisinde">
              <Select value={inSite} onChange={(event) => setInSite(event.target.value)}>
                <option value="">Belirtilmedi</option>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </Select>
            </Field>
            <Field label="Bina yaşı">
              <Input
                type="number"
                min={0}
                value={buildingAge}
                onChange={(event) => setBuildingAge(event.target.value)}
              />
            </Field>
            <Field label="Kat sayısı">
              <Input
                type="number"
                min={0}
                value={floorCount}
                onChange={(event) => setFloorCount(event.target.value)}
              />
            </Field>
            <Field label="Bulunduğu kat">
              <Input
                value={floorNumber}
                onChange={(event) => setFloorNumber(event.target.value)}
                placeholder="Örn: 3. Kat"
              />
            </Field>
            <Field label="Kullanım durumu">
              <Select value={usageStatus} onChange={(event) => setUsageStatus(event.target.value)}>
                <option value="">Belirtilmedi</option>
                <option value="empty">Boş</option>
                <option value="tenant_occupied">Kiracılı</option>
                <option value="owner_occupied">Mülk Sahibi Oturuyor</option>
                <option value="unknown">Belirtilmemiş</option>
              </Select>
            </Field>
            <Field label="Cephe">
              <Input
                value={facade}
                onChange={(event) => setFacade(event.target.value)}
                placeholder="Örn: Güney Batı"
              />
            </Field>
            <Field label="Brüt alan (m²)">
              <Input
                type="number"
                min={0}
                value={grossArea}
                onChange={(event) => setGrossArea(event.target.value)}
              />
            </Field>
            <Field label="Mobilyalı">
              <label className="inline-flex items-center gap-2 pt-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFurnished}
                  onChange={(event) => setIsFurnished(event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span>Mobilyalı</span>
              </label>
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup title="Açıklama">
            <Field label="Özet">
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
              />
            </Field>
            <Field label="Detaylı açıklama" required error={descriptionError}>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                className={descriptionError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </Field>
          </FieldGroup>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={busy}>
              <Save className="h-4 w-4" />
              Kaydet
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, required, error }: { label: string; children: ReactNode; required?: boolean; error?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center h-9 px-3 rounded-md border border-dashed border-input bg-muted/50 text-sm">
      {children}
    </div>
  );
}

function numericFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function nullableBooleanFieldValue(value: boolean | null): string {
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  return "";
}

function parseNullableBooleanFieldValue(value: string): boolean | null {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}
