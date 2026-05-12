"use client";

import { useState } from "react";
import { Info, Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  buildAdminListingMainItemDisplay,
  getAvailableMainItemAddCandidates,
  isAdminListingCheckoutConfigurable,
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
  if (!isAdminListingCheckoutConfigurable(detail)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ana Odeme Kalemleri</CardTitle>
          <CardDescription>
            Satilik ilanlarda checkout odeme kalemi yapilandirmasi beklenmez.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

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

const STRATEGY_LABELS: Record<string, string> = {
  fixed: "Sabit fiyat",
  per_month: "Aylık",
  multiplied: "Çarpanlı",
  one_time: "Tek seferlik",
};

const STRATEGY_TOOLTIPS: Record<string, string> = {
  fixed: "Sabit tutar, ay sayısına bağlı değildir.",
  per_month: "Her ay tekrarlanan ödeme. Toplam = tutar × ay sayısı.",
  multiplied: "Tutar, çarpan katsayısı ile hesaplanır.",
  one_time: "Tek seferlik yapılan ödeme.",
};

function formatAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("tr-TR");
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

  const strategyLabel = STRATEGY_LABELS[item.pricingStrategy] ?? item.pricingStrategy;
  const strategyTooltip = STRATEGY_TOOLTIPS[item.pricingStrategy] ?? "Fiyatlandırma stratejisi.";

  const effectiveAmount = item.overrideAmount ?? item.defaultAmount;
  const effectiveMultiplier = item.overrideMultiplier ?? item.defaultMultiplier;
  const showMultiplier = item.pricingStrategy !== "fixed" && item.pricingStrategy !== "one_time";

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
    <div className="rounded-lg border p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <strong className="text-sm text-balance">{display.primaryLabel}</strong>
          <code className="font-mono text-xs text-muted-foreground">{display.codeLabel}</code>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={item.isEnabled ? "success" : "warning"}
            className="text-[10px]"
            title={item.isEnabled ? "Bu kalem bu ilana bağlı ve aktif." : "Bu kalem pasif durumda."}
          >
            {display.enabledLabel}
          </Badge>
          <Badge
            variant={item.catalogIsActive ? "secondary" : "destructive"}
            className="text-[10px]"
            title={item.catalogIsActive ? "Fiyat kataloğunda aktif." : "Fiyat kataloğunda pasif — müşteriye gösterilmeyebilir."}
          >
            {display.catalogStatusLabel}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px]"
            title={strategyTooltip}
          >
            {strategyLabel}
          </Badge>
        </div>
      </div>

      {/* Summary: effective values */}
      <div className={`grid ${showMultiplier ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"} gap-x-4 gap-y-2 rounded-md bg-muted/40 px-3 py-2.5`}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Geçerli tutar</span>
          <span className="text-sm font-medium tabular-nums">
            {formatAmount(effectiveAmount)} ₺
            {item.overrideAmount != null && (
              <span className="ml-1 text-[10px] text-muted-foreground">(özel)</span>
            )}
          </span>
        </div>
        {showMultiplier && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground" title="Toplam hesabında kullanılan süre veya adet. Örn: aylık 1.000 ₺ × 12 ay = 12.000 ₺ toplam.">
              Süre / adet
              <Info className="inline-block ml-0.5 size-3 text-muted-foreground/60" />
            </span>
            <span className="text-sm font-medium tabular-nums">
              {effectiveMultiplier != null ? `×${effectiveMultiplier}` : "—"}
              {item.overrideMultiplier != null && (
                <span className="ml-1 text-[10px] text-muted-foreground">(özel)</span>
              )}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Katalog varsayılanı</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatAmount(item.defaultAmount)} ₺{showMultiplier ? ` · ×${item.defaultMultiplier ?? "—"}` : ""}
          </span>
        </div>
      </div>

      {/* Override form */}
      <div className={`grid grid-cols-1 ${showMultiplier ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
        <div className="flex flex-col gap-1.5">
          <Label
            className="text-xs"
            title="Müşterinin göreceği isim. Boş bırakırsanız katalog varsayılanı kullanılır."
          >
            Özel etiket
          </Label>
          <Input
            value={overrideLabel}
            onChange={(event) => setOverrideLabel(event.target.value)}
            placeholder={display.catalogLabel || "Varsayılan"}
            title="Bu ilana özel görünen isim"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            className="text-xs"
            title={`Bu ilana özel tutar (₺). Boş bırakırsanız katalog varsayılanı (${formatAmount(item.defaultAmount)} ₺) kullanılır.`}
          >
            Özel tutar (₺)
          </Label>
          <Input
            type="number"
            min={0}
            className="tabular-nums"
            value={overrideAmount}
            onChange={(event) => setOverrideAmount(event.target.value)}
            placeholder={formatAmount(item.defaultAmount)}
            title="Bu ilana özel tutar"
          />
        </div>
        {showMultiplier && (
          <div className="flex flex-col gap-1.5">
            <Label
              className="text-xs"
              title={`Kaç ay veya kaç adet ile çarpılacağını belirler. Örn: 12 ay kira. Boş bırakırsanız katalog varsayılanı (${item.defaultMultiplier ?? "yok"}) kullanılır.`}
            >
              Süre / adet
              <Info className="inline-block ml-0.5 size-3 text-muted-foreground/60" />
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="tabular-nums"
              value={overrideMultiplier}
              onChange={(event) => setOverrideMultiplier(event.target.value)}
              placeholder={item.defaultMultiplier != null ? String(item.defaultMultiplier) : "—"}
              title="Kaç ay veya kaç adet ile çarpılacak (ör. 12 ay kira)"
            />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        Boş bırakılan alanlarda katalog varsayılanı kullanılır.
      </p>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onConfigure(item.code, { is_enabled: false })}
          title="Bu ödeme kalemini ilandan kaldırır"
        >
          <Trash2 className="size-3" />
          Kaldır
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={handleSave}
          title="Özel değerleri kaydet"
        >
          <Save className="size-3" />
          Kaydet
        </Button>
      </div>
    </div>
  );
}

function numericFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}
