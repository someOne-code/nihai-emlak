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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Ana Ödeme Kalemleri</CardTitle>
            <CardDescription>
              Kira, depozito gibi ana ödeme kalemlerini bu ilana bağlayın.
            </CardDescription>
          </div>
          <Badge variant="outline">{items.filter((i) => i.isEnabled).length} kalem</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MainItemAddControl
          candidates={candidates}
          busy={busy}
          onConfigure={onConfigure}
        />

        {items.filter((i) => i.isEnabled).length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Bu ilana henüz ana ödeme kalemi bağlanmadı.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.filter((i) => i.isEnabled).map((item) => (
              <MainItemRow
                key={item.code}
                item={item}
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
      <div className="text-sm text-muted-foreground py-3 text-center rounded-lg border border-dashed bg-muted/30">
        Eklenebilir kalem kalmadı.
      </div>
    );
  }

  const selectedCode = candidates.some((candidate) => candidate.code === code)
    ? code
    : candidates[0].code;

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 rounded-lg border border-dashed bg-muted/30">
      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <Label htmlFor="lstMainItemAddSelect">Katalogdan seç</Label>
        <Select
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
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <strong className="text-sm">{display.primaryLabel}</strong>
          <code className="font-mono text-xs text-muted-foreground">{display.codeLabel}</code>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant={item.isEnabled ? "success" : "warning"} className="text-[10px]">
            {display.enabledLabel}
          </Badge>
          <Badge variant={item.catalogIsActive ? "secondary" : "destructive"} className="text-[10px]">
            {display.catalogStatusLabel}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{display.defaultAmountLabel}</span>
        <span>{display.customAmountLabel}</span>
        <span>{display.defaultMultiplierLabel}</span>
        <span>{display.customMultiplierLabel}</span>
        <span>Strateji: {item.pricingStrategy}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Özel etiket</Label>
          <Input
            value={overrideLabel}
            onChange={(event) => setOverrideLabel(event.target.value)}
            placeholder="Varsayılan"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Özel tutar</Label>
          <Input
            type="number"
            min={0}
            value={overrideAmount}
            onChange={(event) => setOverrideAmount(event.target.value)}
            placeholder="Varsayılan"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Özel çarpan</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={overrideMultiplier}
            onChange={(event) => setOverrideMultiplier(event.target.value)}
            placeholder="Varsayılan"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Boş bırakırsanız katalog varsayılanı kullanılır.
      </p>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onConfigure(item.code, { is_enabled: false })}
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
