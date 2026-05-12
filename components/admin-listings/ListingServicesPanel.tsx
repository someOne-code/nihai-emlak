"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  buildAdminListingServiceDisplay,
  getAvailableServiceAddCandidates,
  isAdminListingCheckoutConfigurable,
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
  if (!isAdminListingCheckoutConfigurable(detail)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ek Hizmetler</CardTitle>
          <CardDescription>
            Satilik ilanlarda checkout ek hizmet yapilandirmasi beklenmez.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasEnabledMainItem = detail.mainItems.some((m) => m.isEnabled);

  if (!hasEnabledMainItem) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ek Hizmetler</CardTitle>
          <CardDescription>
            Ek hizmet eklemek için önce &quot;Ana Ödeme Kalemleri&quot; sekmesinden en az bir ana ödeme kalemi ekleyin.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const candidates = getAvailableServiceAddCandidates(detail);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Ek Hizmetler</CardTitle>
            <CardDescription>
              Temizlik, taşıma gibi ek hizmetleri bu ilana bağlayın.
            </CardDescription>
          </div>
          <Badge variant="outline">{services.filter((s) => s.isEnabled).length} hizmet</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ServiceAddControl
          candidates={candidates}
          busy={busy}
          onConfigure={onConfigure}
        />

        {services.filter((s) => s.isEnabled).length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Bu ilana henüz ek hizmet bağlanmadı.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {services.filter((s) => s.isEnabled).map((service) => (
              <ServiceRow
                key={service.code}
                service={service}
                busy={busy}
                onConfigure={onConfigure}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
      <div className="text-sm text-muted-foreground py-3 text-center rounded-lg border border-dashed bg-muted/30">
        Eklenebilir hizmet kalmadı.
      </div>
    );
  }

  const selectedCode = candidates.some((candidate) => candidate.code === code)
    ? code
    : candidates[0].code;

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 rounded-lg border border-dashed bg-muted/30">
      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <Label htmlFor="lstServiceAddSelect">Katalogdan seç</Label>
        <Select
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
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => onConfigure(selectedCode, { is_enabled: true })}
      >
        <Plus className="h-4 w-4" />
        Ekle
      </Button>
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
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <strong className="text-sm">{display.primaryLabel}</strong>
          <code className="font-mono text-xs text-muted-foreground">{display.codeLabel}</code>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={service.isEnabled ? "success" : "warning"} className="text-[10px]">
            {display.enabledLabel}
          </Badge>
          <Badge variant={service.catalogIsActive ? "secondary" : "destructive"} className="text-[10px]">
            {display.catalogStatusLabel}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{display.basePriceLabel}</span>
        <span>{display.customPriceLabel}</span>
      </div>

      <div className="flex flex-col gap-1.5 max-w-xs pt-1">
        <Label className="text-xs">Özel fiyat</Label>
        <Input
          type="number"
          min={0}
          value={overridePrice}
          onChange={(event) => setOverridePrice(event.target.value)}
          placeholder="Varsayılan"
        />
        <p className="text-xs text-muted-foreground">
          Boş bırakırsanız katalog varsayılanı geçerlidir.
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onConfigure(service.code, { is_enabled: false })}
        >
          Kaldır
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={handleSave}
        >
          <Save className="h-3 w-3" />
          Kaydet
        </Button>
      </div>
    </div>
  );
}

function numericFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}
