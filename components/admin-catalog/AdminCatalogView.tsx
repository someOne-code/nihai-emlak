"use client";

import { useEffect, useState, useCallback, useRef, type FormEvent } from "react";

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

// DB constraint: main_item_catalog.pricing_strategy IN
//   ('fixed', 'listing_price_multiplier', 'stay_months_multiplier').
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
      const [rawItems, rawServices] = await Promise.all([
        fetchAdminCatalogMainItems(),
        fetchAdminCatalogServices(),
      ]);
      setMainItems(
        (rawItems as Record<string, unknown>[]).map(buildAdminCatalogMainItemRow),
      );
      setServices(
        (rawServices as Record<string, unknown>[]).map(buildAdminCatalogServiceRow),
      );
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
    <div className="ctg-root">
      {alert && (
        <div
          role="status"
          aria-live="polite"
          className={`ctg-alert ${alert.kind === "error" ? "ctg-alert-error" : "ctg-alert-success"}`}
        >
          {alert.message}
        </div>
      )}

      <div className="ctg-header">
        <div className="ctg-header-text">
          <h1 className="ctg-heading">Fiyat Kataloğu</h1>
          <p className="ctg-subtitle">
            Tüm ilanlarda kullanılan varsayılan ödeme kalemleri ve ek hizmetleri tek bir
            yerden yönetin. Burada tanımladığınız kalemler her ilan oluşturulduğunda
            otomatik olarak katalog varsayılanı şeklinde sunulur; ilan bazlı özel tutarlar
            ilan detay sayfasından ayarlanır.
          </p>
        </div>
        <button
          id="ctg-reload-btn"
          type="button"
          className="ctg-action-btn"
          disabled={loading || busy}
          onClick={() => void reload()}
        >
          <svg
            aria-hidden="true"
            className="ctg-btn-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          Yenile
        </button>
      </div>

      {/* Tabs */}
      <div className="ctg-tabs" role="tablist" aria-label="Katalog bölümleri">
        <button
          id="tab-main-items"
          type="button"
          role="tab"
          aria-selected={tab === "main-items"}
          className={`ctg-tab ${tab === "main-items" ? "ctg-tab-active" : ""}`}
          onClick={() => setTab("main-items")}
        >
          <svg
            aria-hidden="true"
            className="ctg-tab-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
          Ana Ödeme Kalemleri
          <span className="ctg-tab-badge">{mainItems.length}</span>
        </button>

        <button
          id="tab-services"
          type="button"
          role="tab"
          aria-selected={tab === "services"}
          className={`ctg-tab ${tab === "services" ? "ctg-tab-active" : ""}`}
          onClick={() => setTab("services")}
        >
          <svg
            aria-hidden="true"
            className="ctg-tab-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          Ek Hizmetler
          <span className="ctg-tab-badge">{services.length}</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="ctg-loading" role="status" aria-label="Yükleniyor">
          <div className="ctg-spinner" aria-hidden="true" />
          <span>Katalog yükleniyor…</span>
        </div>
      ) : tab === "main-items" ? (
        <>
          <div className="ctg-toolbar">
            <button
              id="ctg-new-main-item-btn"
              type="button"
              className="ctg-action-btn ctg-action-primary"
              disabled={busy}
              onClick={() => setMainDialog({ mode: "create" })}
            >
              + Yeni Ana Kalem
            </button>
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
          <div className="ctg-toolbar">
            <button
              id="ctg-new-service-btn"
              type="button"
              className="ctg-action-btn ctg-action-primary"
              disabled={busy}
              onClick={() => setServiceDialog({ mode: "create" })}
            >
              + Yeni Hizmet
            </button>
          </div>
          <ServicesTable
            services={services}
            busy={busy}
            onToggle={handleToggleService}
            onEdit={(row) => setServiceDialog({ mode: "edit", row })}
          />
        </>
      )}

      {mainDialog && (
        <MainItemDialog
          state={mainDialog}
          busy={busy}
          existingCodes={mainItems.map((i) => i.code)}
          onCancel={() => setMainDialog(null)}
          onSave={handleSaveMainItem}
        />
      )}

      {serviceDialog && (
        <ServiceDialog
          state={serviceDialog}
          busy={busy}
          existingCodes={services.map((s) => s.code)}
          onCancel={() => setServiceDialog(null)}
          onSave={handleSaveService}
        />
      )}
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
      <div className="ctg-empty">
        <svg
          aria-hidden="true"
          className="ctg-empty-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9h.01M15 9h.01" />
          <path d="M9 15a5 5 0 0 0 6 0" />
        </svg>
        <p>Henüz ana ödeme kalemi yok.</p>
      </div>
    );
  }

  return (
    <div className="ctg-table-wrapper">
      <table className="ctg-table" id="main-items-table">
        <thead>
          <tr>
            <th>Kod</th>
            <th>Etiket</th>
            <th>Strateji</th>
            <th>Varsayılan Tutar</th>
            <th>Sıra</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MainItemRow
              key={item.code}
              item={item}
              busy={busy}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MainItemRow({
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
    <tr className={`ctg-row ${item.isActive ? "" : "ctg-row-passive"}`}>
      <td>
        <code className="ctg-code">{item.code}</code>
      </td>
      <td className="ctg-label-cell">
        <span className="ctg-label">{item.label}</span>
        {item.description && (
          <span className="ctg-description">{item.description}</span>
        )}
      </td>
      <td>
        <span
          className="ctg-strategy"
          title={PRICING_STRATEGY_DESCRIPTIONS[item.pricingStrategy] ?? item.pricingStrategy}
        >
          {item.pricingStrategyLabel}
        </span>
      </td>
      <td>
        <span className="ctg-amount">
          {item.defaultAmount !== null
            ? `${item.defaultAmount.toLocaleString("tr-TR")} TRY`
            : "—"}
        </span>
      </td>
      <td>
        <span className="ctg-sort">{item.sortOrder}</span>
      </td>
      <td>
        <span className={`ctg-badge ${item.isActive ? "ctg-badge-active" : "ctg-badge-passive"}`}>
          {item.statusLabel}
        </span>
      </td>
      <td>
        <div className="ctg-row-actions">
          <button
            type="button"
            id={`edit-main-${item.code}`}
            disabled={busy}
            className="ctg-toggle-btn ctg-toggle-edit"
            onClick={() => onEdit(item)}
          >
            Düzenle
          </button>
          <button
            type="button"
            id={`toggle-main-${item.code}`}
            disabled={busy}
            className={`ctg-toggle-btn ${item.isActive ? "ctg-toggle-deactivate" : "ctg-toggle-activate"}`}
            onClick={() => onToggle(item.code, item.isActive)}
          >
            {item.isActive ? "Pasife al" : "Aktifleştir"}
          </button>
        </div>
      </td>
    </tr>
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
      <div className="ctg-empty">
        <svg
          aria-hidden="true"
          className="ctg-empty-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9 9h.01M15 9h.01" />
          <path d="M9 15a5 5 0 0 0 6 0" />
        </svg>
        <p>Henüz ek hizmet yok.</p>
      </div>
    );
  }

  return (
    <div className="ctg-table-wrapper">
      <table className="ctg-table" id="services-table">
        <thead>
          <tr>
            <th>Kod</th>
            <th>Ad</th>
            <th>Katalog Fiyatı</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <ServiceRow
              key={service.code}
              service={service}
              busy={busy}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceRow({
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
    <tr className={`ctg-row ${service.isActive ? "" : "ctg-row-passive"}`}>
      <td>
        <code className="ctg-code">{service.code}</code>
      </td>
      <td className="ctg-label-cell">
        <span className="ctg-label">{service.name}</span>
        {service.description && (
          <span className="ctg-description">{service.description}</span>
        )}
      </td>
      <td>
        <span className="ctg-amount">
          {service.basePrice !== null
            ? `${service.basePrice.toLocaleString("tr-TR")} TRY`
            : "—"}
        </span>
      </td>
      <td>
        <span className={`ctg-badge ${service.isActive ? "ctg-badge-active" : "ctg-badge-passive"}`}>
          {service.statusLabel}
        </span>
      </td>
      <td>
        <div className="ctg-row-actions">
          <button
            type="button"
            id={`edit-service-${service.code}`}
            disabled={busy}
            className="ctg-toggle-btn ctg-toggle-edit"
            onClick={() => onEdit(service)}
          >
            Düzenle
          </button>
          <button
            type="button"
            id={`toggle-service-${service.code}`}
            disabled={busy}
            className={`ctg-toggle-btn ${service.isActive ? "ctg-toggle-deactivate" : "ctg-toggle-activate"}`}
            onClick={() => onToggle(service.code, service.isActive)}
          >
            {service.isActive ? "Pasife al" : "Aktifleştir"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Info icon helper (reused by dialogs for (i) hover tooltips)
// ---------------------------------------------------------------------------

// Build a human-readable checkout preview for the admin. Uses illustrative
// fixed numbers (15.000 TRY listing, 3 months stay) so admin can sanity check
// the formula without entering real listing data.
function buildMainItemLivePreview(
  strategy: string,
  amountRaw: string,
  multiplierRaw: string,
): string | null {
  if (strategy === "fixed") {
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `Her müşteri sabit ${n.toLocaleString("tr-TR")} TRY öder — ilan fiyatı ya da süresinden etkilenmez.`;
  }
  if (strategy === "listing_price_multiplier") {
    const m = Number(multiplierRaw);
    if (!Number.isFinite(m) || m <= 0) return null;
    const example = 15000 * m;
    return `15.000 TRY ilan fiyatı × ${m} çarpan = ${example.toLocaleString("tr-TR")} TRY tahsil edilir.`;
  }
  if (strategy === "stay_months_multiplier") {
    const m = Number(multiplierRaw);
    if (!Number.isFinite(m) || m <= 0) return null;
    const example = 3 * m;
    return `3 ay konaklama × ${m.toLocaleString("tr-TR")} TRY/ay = ${example.toLocaleString("tr-TR")} TRY tahsil edilir.`;
  }
  return null;
}

function InfoIcon({ title }: { title: string }) {
  return (
    <span
      className="ctg-info-icon"
      role="img"
      aria-label={title}
      title={title}
      tabIndex={0}
    >
      i
    </span>
  );
}

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
  state: { mode: "create" } | { mode: "edit"; row: AdminCatalogMainItemRow };
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
  const editing = state.mode === "edit";
  const row = editing ? state.row : null;

  const [code, setCode] = useState(row?.code ?? "");
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

  // Live preview of the checkout formula, computed from the form values the
  // admin has entered so far. Purely cosmetic — backend stays source of truth.
  const livePreview = buildMainItemLivePreview(
    pricingStrategy,
    defaultAmount,
    defaultMultiplier,
  );

  const normalizedCode = code.trim().toLowerCase();
  const duplicate =
    !editing &&
    normalizedCode.length > 0 &&
    existingCodes.some((c) => c.toLowerCase() === normalizedCode);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedCode = code.trim();
    const trimmedLabel = label.trim();

    if (!editing && trimmedCode.length === 0) {
      setLocalError("Kod zorunludur.");
      return;
    }
    if (duplicate) {
      setLocalError(`"${trimmedCode}" kodu zaten kullanılıyor. Farklı bir kod seç.`);
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
      setLocalError("Varsayılan tutar 0 veya pozitif sayı olmalı.");
      return;
    }
    if (required.amount && amountParsed === null) {
      setLocalError("Seçili strateji için varsayılan tutar zorunludur.");
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
      setLocalError("Varsayılan çarpan 0 veya pozitif sayı olmalı.");
      return;
    }
    if (required.multiplier && multiplierParsed === null) {
      setLocalError("Seçili strateji için varsayılan çarpan zorunludur.");
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

  return (
    <div
      className="ctg-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="main-item-dialog-title"
      onClick={onCancel}
    >
      <div className="ctg-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="main-item-dialog-title" className="ctg-dialog-title">
          {editing ? "Ana Kalemi Düzenle" : "Yeni Ana Kalem"}
        </h2>

        <form className="ctg-form" onSubmit={submit}>
          <label className="ctg-field">
            <span className="ctg-field-label">
              Kod
              <InfoIcon title="İç sistem tanıtıcısı — harfler ve alt çizgi, ör. kira, depozito, komisyon. Oluşturulduktan sonra değiştirilemez." />
            </span>
            <input
              id="main-item-code-input"
              type="text"
              className={`ctg-input ${duplicate ? "ctg-input-error" : ""}`}
              value={code}
              disabled={editing || busy}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ornek: kira"
              required={!editing}
            />
            {duplicate && (
              <span className="ctg-field-hint ctg-field-hint-error">
                Bu kod zaten kullanılıyor.
              </span>
            )}
          </label>

          <label className="ctg-field">
            <span className="ctg-field-label">Etiket</span>
            <input
              id="main-item-label-input"
              type="text"
              className="ctg-input"
              value={label}
              disabled={busy}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Örn: Aylık Kira"
              required
            />
          </label>

          <label className="ctg-field">
            <span className="ctg-field-label">Açıklama</span>
            <textarea
              id="main-item-description-input"
              className="ctg-input ctg-textarea"
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>

          <fieldset className="ctg-strategy-fieldset">
            <legend className="ctg-field-label ctg-field-label-inline">
              Fiyat Stratejisi
              <InfoIcon title={PRICING_STRATEGY_FIELD_HELP} />
            </legend>
            <div className="ctg-strategy-cards" role="radiogroup">
              {PRICING_STRATEGIES.map((s) => {
                const selected = pricingStrategy === s.value;
                return (
                  <label
                    key={s.value}
                    className={`ctg-strategy-card ${selected ? "ctg-strategy-card-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="main-item-pricing-strategy"
                      value={s.value}
                      checked={selected}
                      disabled={busy}
                      onChange={() => setPricingStrategy(s.value)}
                      className="ctg-strategy-card-radio"
                    />
                    <span className="ctg-strategy-card-body">
                      <span className="ctg-strategy-card-title">
                        {s.label}
                        <InfoIcon
                          title={PRICING_STRATEGY_LONG_DESCRIPTIONS[s.value] ?? s.label}
                        />
                      </span>
                      <span className="ctg-strategy-card-desc">
                        {PRICING_STRATEGY_DESCRIPTIONS[s.value] ?? ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="ctg-field-row">
            {required.amount && (
              <label className="ctg-field">
                <span className="ctg-field-label">Varsayılan Tutar (TRY)</span>
                <input
                  id="main-item-default-amount-input"
                  type="number"
                  min={0}
                  step="0.01"
                  className="ctg-input"
                  value={defaultAmount}
                  disabled={busy}
                  onChange={(e) => setDefaultAmount(e.target.value)}
                  placeholder="örn: 12000"
                />
              </label>
            )}

            {required.multiplier && (
              <label className="ctg-field">
                <span className="ctg-field-label">Varsayılan Çarpan</span>
                <input
                  id="main-item-default-multiplier-input"
                  type="number"
                  min={0}
                  step="0.01"
                  className="ctg-input"
                  value={defaultMultiplier}
                  disabled={busy}
                  onChange={(e) => setDefaultMultiplier(e.target.value)}
                  placeholder="örn: 1.0"
                />
              </label>
            )}

            <label className="ctg-field">
              <span className="ctg-field-label">Sıra</span>
              <input
                id="main-item-sort-order-input"
                type="number"
                step="1"
                className="ctg-input"
                value={sortOrder}
                disabled={busy}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>
          </div>

          {livePreview && (
            <div className="ctg-live-preview" aria-live="polite">
              <strong>Önizleme:</strong> {livePreview}
            </div>
          )}

          {localError && (
            <p className="ctg-form-error" role="alert">
              {localError}
            </p>
          )}

          <div className="ctg-dialog-footer">
            <button
              type="button"
              className="ctg-action-btn"
              disabled={busy}
              onClick={onCancel}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              id="main-item-submit-btn"
              className="ctg-action-btn ctg-action-primary"
              disabled={busy}
            >
              {busy ? "Kaydediliyor…" : editing ? "Kaydet" : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ServiceDialog({
  state,
  busy,
  existingCodes,
  onCancel,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; row: AdminCatalogServiceRow };
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
  const editing = state.mode === "edit";
  const row = editing ? state.row : null;

  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [basePrice, setBasePrice] = useState(
    row?.basePrice !== undefined && row?.basePrice !== null
      ? String(row.basePrice)
      : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const normalizedCode = code.trim().toLowerCase();
  const duplicate =
    !editing &&
    normalizedCode.length > 0 &&
    existingCodes.some((c) => c.toLowerCase() === normalizedCode);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedCode = code.trim();
    const trimmedName = name.trim();

    if (!editing && trimmedCode.length === 0) {
      setLocalError("Kod zorunludur.");
      return;
    }
    if (duplicate) {
      setLocalError(`"${trimmedCode}" kodu zaten kullanılıyor. Farklı bir kod seç.`);
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
      setLocalError("Katalog fiyatı 0 veya pozitif sayı olmalı.");
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
    <div
      className="ctg-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-dialog-title"
      onClick={onCancel}
    >
      <div className="ctg-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="service-dialog-title" className="ctg-dialog-title">
          {editing ? "Hizmeti Düzenle" : "Yeni Hizmet"}
        </h2>

        <form className="ctg-form" onSubmit={submit}>
          <label className="ctg-field">
            <span className="ctg-field-label">
              Kod
              <InfoIcon title="İç sistem tanıtıcısı — ör. temizlik, transfer, kahvaltı. Oluşturulduktan sonra değiştirilemez." />
            </span>
            <input
              id="service-code-input"
              type="text"
              className={`ctg-input ${duplicate ? "ctg-input-error" : ""}`}
              value={code}
              disabled={editing || busy}
              onChange={(e) => setCode(e.target.value)}
              placeholder="örn: temizlik"
              required={!editing}
            />
            {duplicate && (
              <span className="ctg-field-hint ctg-field-hint-error">
                Bu kod zaten kullanılıyor.
              </span>
            )}
          </label>

          <label className="ctg-field">
            <span className="ctg-field-label">Ad</span>
            <input
              id="service-name-input"
              type="text"
              className="ctg-input"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Profesyonel Temizlik"
              required
            />
          </label>

          <label className="ctg-field">
            <span className="ctg-field-label">Açıklama</span>
            <textarea
              id="service-description-input"
              className="ctg-input ctg-textarea"
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>

          <label className="ctg-field">
            <span className="ctg-field-label">Katalog Fiyatı (TRY)</span>
            <input
              id="service-base-price-input"
              type="number"
              min={0}
              step="0.01"
              className="ctg-input"
              value={basePrice}
              disabled={busy}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="örn: 500"
            />
          </label>

          {localError && (
            <p className="ctg-form-error" role="alert">
              {localError}
            </p>
          )}

          <div className="ctg-dialog-footer">
            <button
              type="button"
              className="ctg-action-btn"
              disabled={busy}
              onClick={onCancel}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              id="service-submit-btn"
              className="ctg-action-btn ctg-action-primary"
              disabled={busy}
            >
              {busy ? "Kaydediliyor…" : editing ? "Kaydet" : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
