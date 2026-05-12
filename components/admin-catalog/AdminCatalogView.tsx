"use client";

import { useEffect, useState, useCallback, useRef, type FormEvent } from "react";
import {
  CreditCard, Info, Pencil, Plus, RefreshCw, Save,
  Settings, ToggleLeft, ToggleRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import {
  fetchAdminCatalogMainItems,
  fetchAdminCatalogServices,
  createAdminCatalogMainItem,
  updateAdminCatalogMainItem,
  createAdminCatalogService,
  updateAdminCatalogService,
  AdminCatalogClientError,
  type AdminCatalogMainItemCreatePayload,
  type AdminCatalogMainItemUpdatePayload,
  type AdminCatalogServiceCreatePayload,
  type AdminCatalogServiceUpdatePayload,
} from "@/lib/admin-ui/catalog-client";
import {
  buildAdminCatalogMainItemRow,
  buildAdminCatalogServiceRow,
  pricingStrategyRequires,
  PRICING_STRATEGY_LABELS,
  PRICING_STRATEGY_DESCRIPTIONS,
  PRICING_STRATEGY_LONG_DESCRIPTIONS,
  PRICING_STRATEGY_FIELD_HELP,
  type AdminCatalogMainItemRow,
  type AdminCatalogServiceRow,
} from "@/lib/admin-ui/catalog-view-model";
import {
  createInitialLoadGuard,
  shouldStartInitialLoad,
} from "@/lib/admin-ui/initial-load-guard";
import {
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "@/lib/admin-ui/content-refresh";

type Tab = "main-items" | "services";

type AlertState = {
  kind: "success" | "error";
  message: string;
} | null;

type MainItemDialogState =
  | { mode: "create" }
  | { mode: "edit"; row: AdminCatalogMainItemRow }
  | null;

type ServiceDialogState =
  | { mode: "create" }
  | { mode: "edit"; row: AdminCatalogServiceRow }
  | null;

const PRICING_STRATEGIES = [
  { value: "fixed", label: PRICING_STRATEGY_LABELS.fixed },
  {
    value: "listing_price_multiplier",
    label: PRICING_STRATEGY_LABELS.listing_price_multiplier,
  },
  {
    value: "stay_months_multiplier",
    label: PRICING_STRATEGY_LABELS.stay_months_multiplier,
  },
];

// ---------------------------------------------------------------------------
// Top-level view
// ---------------------------------------------------------------------------

export default function AdminCatalogView() {
  const [tab, setTab] = useState<Tab>("main-items");
  const [mainItems, setMainItems] = useState<AdminCatalogMainItemRow[]>([]);
  const [services, setServices] = useState<AdminCatalogServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [mainDialog, setMainDialog] = useState<MainItemDialogState>(null);
  const [serviceDialog, setServiceDialog] = useState<ServiceDialogState>(null);

  const alertRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadGuardRef = useRef(createInitialLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());

  const showAlert = useCallback((kind: "success" | "error", message: string) => {
    setAlert({ kind, message });
    if (alertRef.current) clearTimeout(alertRef.current);
    alertRef.current = setTimeout(() => setAlert(null), 4000);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchAdminCatalogMainItems(),
        fetchAdminCatalogServices(),
      ]);

      if (results[0].status === "fulfilled") {
        setMainItems(
          (results[0].value as Record<string, unknown>[]).map(buildAdminCatalogMainItemRow),
        );
      }
      if (results[1].status === "fulfilled") {
        setServices(
          (results[1].value as Record<string, unknown>[]).map(buildAdminCatalogServiceRow),
        );
      }

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        const firstReason = (failures[0] as PromiseRejectedResult).reason;
        const message =
          firstReason instanceof AdminCatalogClientError
            ? firstReason.message
            : "Katalog kısmen yüklenemedi";
        showAlert("error", message);
      }
    } catch (err) {
      const message =
        err instanceof AdminCatalogClientError
          ? err.message
          : "Katalog yüklenemedi";
      showAlert("error", message);
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (!shouldStartInitialLoad(initialLoadGuardRef.current)) {
      return;
    }

    void reload();
  }, [reload]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (!shouldRefreshContentOnResume(resumeRefreshGateRef.current)) {
        return;
      }

      void refreshContentViews([() => reload()]);
    };

    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [reload]);

  const handleToggleMainItem = useCallback(
    async (code: string, isActive: boolean) => {
      setBusy(true);
      try {
        await updateAdminCatalogMainItem(code, { is_active: !isActive });
        showAlert("success", `Katalog kalemi "${code}" güncellendi.`);
        await reload();
      } catch (err) {
        const message =
          err instanceof AdminCatalogClientError ? err.message : "Güncelleme başarısız";
        showAlert("error", message);
      } finally {
        setBusy(false);
      }
    },
    [reload, showAlert],
  );

  const handleSaveMainItem = useCallback(
    async (
      mode: "create" | "edit",
      code: string,
      payload:
        | AdminCatalogMainItemCreatePayload
        | AdminCatalogMainItemUpdatePayload,
    ) => {
      setBusy(true);
      try {
        if (mode === "create") {
          await createAdminCatalogMainItem(
            payload as AdminCatalogMainItemCreatePayload,
          );
          showAlert("success", `Katalog kalemi "${code}" oluşturuldu.`);
        } else {
          await updateAdminCatalogMainItem(
            code,
            payload as AdminCatalogMainItemUpdatePayload,
          );
          showAlert("success", `Katalog kalemi "${code}" güncellendi.`);
        }
        setMainDialog(null);
        await reload();
      } catch (err) {
        const message =
          err instanceof AdminCatalogClientError
            ? err.message
            : "Kaydetme başarısız";
        showAlert("error", message);
      } finally {
        setBusy(false);
      }
    },
    [reload, showAlert],
  );

  const handleSaveService = useCallback(
    async (
      mode: "create" | "edit",
      code: string,
      payload:
        | AdminCatalogServiceCreatePayload
        | AdminCatalogServiceUpdatePayload,
    ) => {
      setBusy(true);
      try {
        if (mode === "create") {
          await createAdminCatalogService(
            payload as AdminCatalogServiceCreatePayload,
          );
          showAlert("success", `Hizmet "${code}" oluşturuldu.`);
        } else {
          await updateAdminCatalogService(
            code,
            payload as AdminCatalogServiceUpdatePayload,
          );
          showAlert("success", `Hizmet "${code}" güncellendi.`);
        }
        setServiceDialog(null);
        await reload();
      } catch (err) {
        const message =
          err instanceof AdminCatalogClientError
            ? err.message
            : "Kaydetme başarısız";
        showAlert("error", message);
      } finally {
        setBusy(false);
      }
    },
    [reload, showAlert],
  );

  const handleToggleService = useCallback(
    async (code: string, isActive: boolean) => {
      setBusy(true);
      try {
        await updateAdminCatalogService(code, { is_active: !isActive });
        showAlert("success", `Hizmet "${code}" güncellendi.`);
        await reload();
      } catch (err) {
        const message =
          err instanceof AdminCatalogClientError ? err.message : "Güncelleme başarısız";
        showAlert("error", message);
      } finally {
        setBusy(false);
      }
    },
    [reload, showAlert],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Alert */}
      {alert && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            alert.kind === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {alert.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-balance">Fiyat Kataloğu</h1>
          <p className="text-sm text-muted-foreground text-pretty max-w-2xl">
            Tüm ilanlarda kullanılan varsayılan ödeme kalemleri ve ek hizmetleri tek bir
            yerden yönetin. İlan bazlı özel tutarlar ilan detay sayfasından ayarlanır.
          </p>
        </div>
        <Button
          id="ctg-reload-btn"
          variant="outline"
          size="sm"
          disabled={loading || busy}
          onClick={() => void reload()}
        >
          <RefreshCw className="size-4" />
          Yenile
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" role="tablist" aria-label="Katalog bölümleri">
        <button
          id="tab-main-items"
          type="button"
          role="tab"
          aria-selected={tab === "main-items"}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "main-items"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          onClick={() => setTab("main-items")}
        >
          <CreditCard className="size-4" />
          Ana Ödeme Kalemleri
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {mainItems.length}
          </Badge>
        </button>
        <button
          id="tab-services"
          type="button"
          role="tab"
          aria-selected={tab === "services"}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "services"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          onClick={() => setTab("services")}
        >
          <Settings className="size-4" />
          Ek Hizmetler
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {services.length}
          </Badge>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : tab === "main-items" ? (
        <>
          <div className="flex justify-end">
            <Button
              id="ctg-new-main-item-btn"
              size="sm"
              disabled={busy}
              onClick={() => setMainDialog({ mode: "create" })}
            >
              <Plus className="size-4" />
              Yeni Ana Kalem
            </Button>
          </div>
          <MainItemsTable
            items={mainItems}
            busy={busy}
            onToggle={handleToggleMainItem}
            onEdit={(row) => setMainDialog({ mode: "edit", row })}
          />
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              id="ctg-new-service-btn"
              size="sm"
              disabled={busy}
              onClick={() => setServiceDialog({ mode: "create" })}
            >
              <Plus className="size-4" />
              Yeni Hizmet
            </Button>
          </div>
          <ServicesTable
            services={services}
            busy={busy}
            onToggle={handleToggleService}
            onEdit={(row) => setServiceDialog({ mode: "edit", row })}
          />
        </>
      )}

      {/* Dialogs */}
      <MainItemDialog
        state={mainDialog}
        busy={busy}
        existingCodes={mainItems.map((i) => i.code)}
        onCancel={() => setMainDialog(null)}
        onSave={handleSaveMainItem}
      />

      <ServiceDialog
        state={serviceDialog}
        busy={busy}
        existingCodes={services.map((s) => s.code)}
        onCancel={() => setServiceDialog(null)}
        onSave={handleSaveService}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main items table
// ---------------------------------------------------------------------------

function MainItemsTable({
  items,
  busy,
  onToggle,
  onEdit,
}: {
  items: AdminCatalogMainItemRow[];
  busy: boolean;
  onToggle: (code: string, isActive: boolean) => void;
  onEdit: (row: AdminCatalogMainItemRow) => void;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CreditCard className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Henüz ana ödeme kalemi yok.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table id="main-items-table">
        <TableHeader>
          <TableRow>
            <TableHead>Etiket</TableHead>
            <TableHead>Hesaplama</TableHead>
            <TableHead className="tabular-nums">Varsayılan</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <CatalogMainItemRow
              key={item.code}
              item={item}
              busy={busy}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CatalogMainItemRow({
  item,
  busy,
  onToggle,
  onEdit,
}: {
  item: AdminCatalogMainItemRow;
  busy: boolean;
  onToggle: (code: string, isActive: boolean) => void;
  onEdit: (row: AdminCatalogMainItemRow) => void;
}) {
  return (
    <TableRow className={item.isActive ? "" : "opacity-60"}>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{item.label}</span>
          <code className="font-mono text-xs text-muted-foreground">{item.code}</code>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="text-[10px]"
          title={PRICING_STRATEGY_DESCRIPTIONS[item.pricingStrategy] ?? item.pricingStrategy}
        >
          {item.pricingStrategyLabel}
        </Badge>
      </TableCell>
      <TableCell className="tabular-nums text-sm">
        {item.defaultAmount !== null
          ? `${item.defaultAmount.toLocaleString("tr-TR")} ₺`
          : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={item.isActive ? "success" : "secondary"} className="text-[10px]">
          {item.statusLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1.5 justify-end">
          <Button
            variant="outline"
            size="sm"
            id={`edit-main-${item.code}`}
            disabled={busy}
            onClick={() => onEdit(item)}
          >
            <Pencil className="size-3" />
            Düzenle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            id={`toggle-main-${item.code}`}
            disabled={busy}
            onClick={() => onToggle(item.code, item.isActive)}
            title={item.isActive ? "Kalemi pasife al" : "Kalemi aktifleştir"}
          >
            {item.isActive ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
            {item.isActive ? "Pasife al" : "Aktifleştir"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Services table
// ---------------------------------------------------------------------------

function ServicesTable({
  services,
  busy,
  onToggle,
  onEdit,
}: {
  services: AdminCatalogServiceRow[];
  busy: boolean;
  onToggle: (code: string, isActive: boolean) => void;
  onEdit: (row: AdminCatalogServiceRow) => void;
}) {
  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Settings className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Henüz ek hizmet yok.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table id="services-table">
        <TableHeader>
          <TableRow>
            <TableHead>Ad</TableHead>
            <TableHead className="tabular-nums">Katalog Fiyatı</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <CatalogServiceRow
              key={service.code}
              service={service}
              busy={busy}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CatalogServiceRow({
  service,
  busy,
  onToggle,
  onEdit,
}: {
  service: AdminCatalogServiceRow;
  busy: boolean;
  onToggle: (code: string, isActive: boolean) => void;
  onEdit: (row: AdminCatalogServiceRow) => void;
}) {
  return (
    <TableRow className={service.isActive ? "" : "opacity-60"}>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-sm">{service.name}</span>
          <code className="font-mono text-xs text-muted-foreground">{service.code}</code>
        </div>
      </TableCell>
      <TableCell className="tabular-nums text-sm">
        {service.basePrice !== null
          ? `${service.basePrice.toLocaleString("tr-TR")} ₺`
          : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={service.isActive ? "success" : "secondary"} className="text-[10px]">
          {service.statusLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1.5 justify-end">
          <Button
            variant="outline"
            size="sm"
            id={`edit-service-${service.code}`}
            disabled={busy}
            onClick={() => onEdit(service)}
          >
            <Pencil className="size-3" />
            Düzenle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            id={`toggle-service-${service.code}`}
            disabled={busy}
            onClick={() => onToggle(service.code, service.isActive)}
            title={service.isActive ? "Hizmeti pasife al" : "Hizmeti aktifleştir"}
          >
            {service.isActive ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
            {service.isActive ? "Pasife al" : "Aktifleştir"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMainItemLivePreview(
  strategy: string,
  amountRaw: string,
  multiplierRaw: string,
): string | null {
  if (strategy === "fixed") {
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `Her müşteri sabit ${n.toLocaleString("tr-TR")} ₺ öder — ilan fiyatı veya süresinden etkilenmez.`;
  }
  if (strategy === "listing_price_multiplier") {
    const m = Number(multiplierRaw);
    if (!Number.isFinite(m) || m <= 0) return null;
    const example = 15_000 * m;
    return `Örnek: 15.000 ₺ ilan fiyatı × ${m} oran = ${example.toLocaleString("tr-TR")} ₺ tahsil edilir.`;
  }
  if (strategy === "stay_months_multiplier") {
    const m = Number(multiplierRaw);
    if (!Number.isFinite(m) || m <= 0) return null;
    const example = 3 * m;
    return `Örnek: 3 ay kalma × aylık ${m.toLocaleString("tr-TR")} ₺ = ${example.toLocaleString("tr-TR")} ₺ tahsil edilir.`;
  }
  return null;
}

// Generates a URL/DB-safe slug from a Turkish label.
// "Aylık Kira" → "aylik_kira", "İlk Ay Komisyonu" → "ilk_ay_komisyonu"
const TR_CHAR_MAP: Record<string, string> = {
  ş: "s", Ş: "s", ç: "c", Ç: "c", ğ: "g", Ğ: "g",
  ı: "i", İ: "i", ö: "o", Ö: "o", ü: "u", Ü: "u",
};
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[şŞçÇğĞıİöÖüÜ]/g, (ch) => TR_CHAR_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const MULTIPLIER_FIELD_LABELS: Record<string, string> = {
  listing_price_multiplier: "Oran",
  stay_months_multiplier: "Aylık tutar (₺)",
};

const MULTIPLIER_FIELD_HINTS: Record<string, string> = {
  listing_price_multiplier: "İlan fiyatı ile çarpılacak oran. Örn: 1.0 = tam fiyat, 0.5 = yarısı.",
  stay_months_multiplier: "Her ay için alınacak tutar. Toplam = bu tutar × kalma süresi.",
};

// ---------------------------------------------------------------------------
// Dialogs (create + edit)
// ---------------------------------------------------------------------------

function MainItemDialog({
  state,
  busy,
  existingCodes,
  onCancel,
  onSave,
}: {
  state: MainItemDialogState;
  busy: boolean;
  existingCodes: string[];
  onCancel: () => void;
  onSave: (
    mode: "create" | "edit",
    code: string,
    payload:
      | AdminCatalogMainItemCreatePayload
      | AdminCatalogMainItemUpdatePayload,
  ) => void;
}) {
  const editing = state?.mode === "edit";
  const row = editing ? state.row : null;

  const [label, setLabel] = useState(row?.label ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [pricingStrategy, setPricingStrategy] = useState(
    row?.pricingStrategy ?? "fixed",
  );
  const [defaultAmount, setDefaultAmount] = useState(
    row?.defaultAmount !== undefined && row?.defaultAmount !== null
      ? String(row.defaultAmount)
      : "",
  );
  const [defaultMultiplier, setDefaultMultiplier] = useState(
    row?.defaultMultiplier !== undefined && row?.defaultMultiplier !== null
      ? String(row.defaultMultiplier)
      : "",
  );
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 0));
  const [localError, setLocalError] = useState<string | null>(null);

  const required = pricingStrategyRequires(pricingStrategy);

  const livePreview = buildMainItemLivePreview(
    pricingStrategy,
    defaultAmount,
    defaultMultiplier,
  );

  // Auto-generate code from label for create mode
  const autoCode = editing ? row!.code : slugify(label);
  const duplicate =
    !editing &&
    autoCode.length > 0 &&
    existingCodes.some((c) => c.toLowerCase() === autoCode);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedLabel = label.trim();
    const trimmedCode = editing ? row!.code : slugify(trimmedLabel);

    if (!editing && trimmedCode.length === 0) {
      setLocalError("İsim girildiğinde sistem kodu otomatik oluşturulur.");
      return;
    }
    if (duplicate) {
      setLocalError(`Bu isimden üretilen kod ("${trimmedCode}") zaten kullanılıyor. Farklı bir isim girin.`);
      return;
    }
    if (trimmedLabel.length === 0) {
      setLocalError("Etiket zorunludur.");
      return;
    }

    const amountParsed =
      !required.amount || defaultAmount.trim() === ""
        ? null
        : Number(defaultAmount);
    if (amountParsed !== null && (!Number.isFinite(amountParsed) || amountParsed < 0)) {
      setLocalError("Tutar 0 veya pozitif sayı olmalı.");
      return;
    }
    if (required.amount && amountParsed === null) {
      setLocalError("Bu hesaplama yöntemi için tutar zorunludur.");
      return;
    }

    const multiplierParsed =
      !required.multiplier || defaultMultiplier.trim() === ""
        ? null
        : Number(defaultMultiplier);
    if (
      multiplierParsed !== null &&
      (!Number.isFinite(multiplierParsed) || multiplierParsed < 0)
    ) {
      setLocalError("Değer 0 veya pozitif sayı olmalı.");
      return;
    }
    if (required.multiplier && multiplierParsed === null) {
      setLocalError("Bu hesaplama yöntemi için değer zorunludur.");
      return;
    }

    const sortParsed = Number(sortOrder);
    if (!Number.isFinite(sortParsed)) {
      setLocalError("Sıra numarası geçerli olmalı.");
      return;
    }

    const descriptionValue =
      description.trim().length === 0 ? null : description.trim();

    if (editing && row) {
      const payload: AdminCatalogMainItemUpdatePayload = {
        label: trimmedLabel,
        description: descriptionValue,
        pricing_strategy: pricingStrategy,
        default_amount: amountParsed,
        default_multiplier: multiplierParsed,
        sort_order: sortParsed,
      };
      onSave("edit", row.code, payload);
    } else {
      const payload: AdminCatalogMainItemCreatePayload = {
        code: trimmedCode,
        label: trimmedLabel,
        description: descriptionValue,
        pricing_strategy: pricingStrategy,
        default_amount: amountParsed,
        default_multiplier: multiplierParsed,
        sort_order: sortParsed,
      };
      onSave("create", trimmedCode, payload);
    }
  };

  const multiplierLabel = MULTIPLIER_FIELD_LABELS[pricingStrategy] ?? "Oran";
  const multiplierHint = MULTIPLIER_FIELD_HINTS[pricingStrategy] ?? "";

  return (
    <Dialog open={state !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogHeader>
        <DialogTitle>
          {editing ? "Ana Kalemi Düzenle" : "Yeni Ana Kalem"}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? "Bu ödeme kaleminin ayarlarını güncelleyin."
            : "Tüm ilanlarda kullanılacak yeni bir ödeme kalemi tanımlayın."}
        </DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        {/* Etiket (isim) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Kalem adı</Label>
          <Input
            id="main-item-label-input"
            value={label}
            disabled={busy}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ör: Aylık Kira, Depozito, Komisyon"
            required
          />
          {!editing && autoCode.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Sistem kodu: <code className="font-mono text-xs">{autoCode}</code>
              {duplicate && <span className="text-destructive ml-1">(bu kod zaten var — farklı bir isim girin)</span>}
            </p>
          )}
          {editing && (
            <p className="text-[11px] text-muted-foreground">
              Sistem kodu: <code className="font-mono text-xs">{row!.code}</code>
            </p>
          )}
        </div>

        {/* Açıklama */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Açıklama (opsiyonel)</Label>
          <Textarea
            id="main-item-description-input"
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Hesaplama yöntemi */}
        <fieldset className="flex flex-col gap-2.5 border-0 p-0 m-0">
          <legend className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            Hesaplama yöntemi
            <span title={PRICING_STRATEGY_FIELD_HELP}><Info className="size-3 text-muted-foreground/60" /></span>
          </legend>
          <div className="flex flex-col gap-2" role="radiogroup">
            {PRICING_STRATEGIES.map((s) => {
              const selected = pricingStrategy === s.value;
              return (
                <label
                  key={s.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="main-item-pricing-strategy"
                    value={s.value}
                    checked={selected}
                    disabled={busy}
                    onChange={() => setPricingStrategy(s.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold flex items-center gap-1">
                      {s.label}
                      <span title={PRICING_STRATEGY_LONG_DESCRIPTIONS[s.value] ?? s.label}>
                        <Info className="size-3.5 text-muted-foreground/50 shrink-0" />
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground text-pretty">
                      {PRICING_STRATEGY_DESCRIPTIONS[s.value] ?? ""}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Tutar / oran alanları */}
        <div className="flex gap-3 flex-wrap">
          {required.amount && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <Label className="text-xs">Varsayılan tutar (₺)</Label>
              <Input
                id="main-item-default-amount-input"
                type="number"
                min={0}
                step="0.01"
                className="tabular-nums"
                value={defaultAmount}
                disabled={busy}
                onChange={(e) => setDefaultAmount(e.target.value)}
                placeholder="ör: 5000"
              />
            </div>
          )}

          {required.multiplier && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <Label className="text-xs" title={multiplierHint}>
                {multiplierLabel}
                <Info className="inline-block ml-1 size-3 text-muted-foreground/60" />
              </Label>
              <Input
                id="main-item-default-multiplier-input"
                type="number"
                min={0}
                step="0.01"
                className="tabular-nums"
                value={defaultMultiplier}
                disabled={busy}
                onChange={(e) => setDefaultMultiplier(e.target.value)}
                placeholder={pricingStrategy === "listing_price_multiplier" ? "ör: 1.0" : "ör: 500"}
              />
              <p className="text-[11px] text-muted-foreground text-pretty">{multiplierHint}</p>
            </div>
          )}
        </div>

        {/* Sıra — hidden by default, uses 0 */}
        <input type="hidden" name="sort_order" value={sortOrder} />

        {/* Canlı önizleme */}
        {livePreview && (
          <div
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 text-pretty"
            aria-live="polite"
          >
            <strong>Önizleme:</strong> {livePreview}
          </div>
        )}

        {/* Hata */}
        {localError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert">
            {localError}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Vazgeç
          </Button>
          <Button type="submit" id="main-item-submit-btn" disabled={busy}>
            <Save className="size-4" />
            {busy ? "Kaydediliyor…" : editing ? "Kaydet" : "Oluştur"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function ServiceDialog({
  state,
  busy,
  existingCodes,
  onCancel,
  onSave,
}: {
  state: ServiceDialogState;
  busy: boolean;
  existingCodes: string[];
  onCancel: () => void;
  onSave: (
    mode: "create" | "edit",
    code: string,
    payload:
      | AdminCatalogServiceCreatePayload
      | AdminCatalogServiceUpdatePayload,
  ) => void;
}) {
  const editing = state?.mode === "edit";
  const row = editing ? state.row : null;

  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [basePrice, setBasePrice] = useState(
    row?.basePrice !== undefined && row?.basePrice !== null
      ? String(row.basePrice)
      : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Auto-generate code from name for create mode
  const autoCode = editing ? row!.code : slugify(name);
  const duplicate =
    !editing &&
    autoCode.length > 0 &&
    existingCodes.some((c) => c.toLowerCase() === autoCode);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedName = name.trim();
    const trimmedCode = editing ? row!.code : slugify(trimmedName);

    if (!editing && trimmedCode.length === 0) {
      setLocalError("İsim girildiğinde sistem kodu otomatik oluşturulur.");
      return;
    }
    if (duplicate) {
      setLocalError(`Bu isimden üretilen kod ("${trimmedCode}") zaten kullanılıyor. Farklı bir isim girin.`);
      return;
    }
    if (trimmedName.length === 0) {
      setLocalError("Ad zorunludur.");
      return;
    }

    const priceParsed = basePrice.trim() === "" ? undefined : Number(basePrice);
    if (
      priceParsed !== undefined &&
      (!Number.isFinite(priceParsed) || priceParsed < 0)
    ) {
      setLocalError("Fiyat 0 veya pozitif sayı olmalı.");
      return;
    }

    const descriptionValue =
      description.trim().length === 0 ? null : description.trim();

    if (editing && row) {
      const payload: AdminCatalogServiceUpdatePayload = {
        name: trimmedName,
        description: descriptionValue,
        ...(priceParsed !== undefined ? { base_price: priceParsed } : {}),
      };
      onSave("edit", row.code, payload);
    } else {
      const payload: AdminCatalogServiceCreatePayload = {
        code: trimmedCode,
        name: trimmedName,
        description: descriptionValue,
        ...(priceParsed !== undefined ? { base_price: priceParsed } : {}),
      };
      onSave("create", trimmedCode, payload);
    }
  };

  return (
    <Dialog open={state !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogHeader>
        <DialogTitle>
          {editing ? "Hizmeti Düzenle" : "Yeni Hizmet"}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? "Bu ek hizmetin ayarlarını güncelleyin."
            : "İlanlara eklenebilecek yeni bir ek hizmet tanımlayın."}
        </DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        {/* Hizmet adı */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Hizmet adı</Label>
          <Input
            id="service-name-input"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="ör: Profesyonel Temizlik, Transfer"
            required
          />
          {!editing && autoCode.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Sistem kodu: <code className="font-mono text-xs">{autoCode}</code>
              {duplicate && <span className="text-destructive ml-1">(bu kod zaten var — farklı bir isim girin)</span>}
            </p>
          )}
          {editing && (
            <p className="text-[11px] text-muted-foreground">
              Sistem kodu: <code className="font-mono text-xs">{row!.code}</code>
            </p>
          )}
        </div>

        {/* Açıklama */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Açıklama (opsiyonel)</Label>
          <Textarea
            id="service-description-input"
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Fiyat */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Katalog fiyatı (₺)</Label>
          <Input
            id="service-base-price-input"
            type="number"
            min={0}
            step="0.01"
            className="tabular-nums"
            value={basePrice}
            disabled={busy}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="ör: 500"
          />
        </div>

        {/* Hata */}
        {localError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert">
            {localError}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Vazgeç
          </Button>
          <Button type="submit" id="service-submit-btn" disabled={busy}>
            <Save className="size-4" />
            {busy ? "Kaydediliyor…" : editing ? "Kaydet" : "Oluştur"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
