"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  AdminListingsClientError,
  addAdminListingImage,
  configureAdminListingMainItem,
  configureAdminListingService,
  createAdminListing,
  deleteAdminListingImage,
  reorderAdminListingImages,
  setAdminListingStatus,
  updateAdminListing,
} from "@/lib/admin-ui/listings-client.ts";
import { selectAdminListing } from "@/lib/admin-ui/listings-controller.ts";
import {
  fetchAdminListingsList as fetchListFn,
  fetchAdminListingSnapshot as fetchSnapshotFn,
  type AdminListingsListFilters,
  type AdminListingsListResponse,
} from "@/lib/admin-ui/listings-client.ts";
import {
  AdminListingRow,
  AdminListingsViewModel,
} from "@/lib/admin-ui/listings-view-model.ts";

import CheckoutReadinessPanel from "./CheckoutReadinessPanel";
import ListingDetailTabs from "./ListingDetailTabs";
import ListingGeneralPanel from "./ListingGeneralPanel";
import ListingImagesPanel from "./ListingImagesPanel";
import ListingMainItemsPanel from "./ListingMainItemsPanel";
import ListingServicesPanel from "./ListingServicesPanel";
import ListingsList from "./ListingsList";
import ListingsPageHeader from "./ListingsPageHeader";

const INITIAL_VIEW_MODEL: AdminListingsViewModel = {
  rows: [],
  selectedListingId: null,
  detail: null,
};

const styles = {
  container: "opsContainer",
  heading: "opsHeading",
  lead: "opsLead",
  errorBanner: "opsErrorBanner",
  successBanner: "opsSuccessBanner",
  loadingText: "opsLoadingText",
  retryButton: "opsRetryButton",
  badge: "opsBadge",
  badgeSuccess: "opsBadgeSuccess",
  badgeWarning: "opsBadgeWarning",
  badgeDanger: "opsBadgeDanger",
  badgeNeutral: "opsBadgeNeutral",
  workspace: "lstWorkspace",
  sidebar: "lstSidebar",
  filterRow: "lstFilterRow",
  listingItem: "lstListingItem",
  listingItemSelected: "lstListingItemSelected",
  listingItemHeader: "lstListingItemHeader",
  listingItemTitle: "lstListingItemTitle",
  listingItemMeta: "lstListingItemMeta",
  detail: "lstDetail",
  panel: "lstPanel",
  panelHeader: "lstPanelHeader",
  panelTitle: "lstPanelTitle",
  formGrid: "lstFormGrid",
  field: "lstField",
  buttonRow: "lstButtonRow",
  primaryButton: "lstPrimaryButton",
  secondaryButton: "lstSecondaryButton",
  dangerButton: "lstDangerButton",
  inlineRow: "lstInlineRow",
  optionRow: "lstOptionRow",
  optionMeta: "lstOptionMeta",
  imageList: "lstImageList",
  imageCard: "lstImageCard",
  imageCardThumb: "lstImageCardThumb",
  imageCardActions: "lstImageCardActions",
  empty: "lstEmpty",
  chip: "lstChip",
  chipSuccess: "lstChipSuccess",
  chipDanger: "lstChipDanger",
  chipWarning: "lstChipWarning",
  missingList: "lstMissingList",
} as const;

type FilterState = {
  status: "" | "active" | "passive";
  type: "" | "rent" | "sale";
};

const INITIAL_FILTERS: FilterState = { status: "", type: "" };

export default function AdminListingsView() {
  const [viewModel, setViewModel] = useState<AdminListingsViewModel>(INITIAL_VIEW_MODEL);
  const [list, setList] = useState<AdminListingsListResponse | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAllAndCacheList = useCallback(
    async (selectedListingId: string | null, nextFilters: FilterState) => {
      setLoading(true);
      setError(null);
      try {
        const cachedList = await fetchListFn(filterStateToQuery(nextFilters));
        if (!mountedRef.current) return;
        setList(cachedList);
        const model = await selectAdminListing(
          { fetchAdminListingSnapshot: fetchSnapshotFn },
          {
            list: cachedList,
            listingId: selectedListingId ?? firstListingIdInList(cachedList) ?? "",
          },
        );
        if (!mountedRef.current) return;
        setViewModel(model);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(safeErrorMessage(err));
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadAllAndCacheList(null, INITIAL_FILTERS);
  }, [loadAllAndCacheList]);

  const handleSelectListing = useCallback(
    async (listingId: string) => {
      if (!list) return;
      setActionError(null);
      setActionSuccess(null);
      setBusy(true);
      try {
        const model = await selectAdminListing(
          { fetchAdminListingSnapshot: fetchSnapshotFn },
          { list, listingId },
        );
        if (!mountedRef.current) return;
        setViewModel(model);
      } catch (err) {
        if (!mountedRef.current) return;
        setActionError(safeErrorMessage(err));
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [list],
  );

  const handleApplyFilters = useCallback(
    (nextFilters: FilterState) => {
      setFilters(nextFilters);
      loadAllAndCacheList(viewModel.selectedListingId, nextFilters);
    },
    [loadAllAndCacheList, viewModel.selectedListingId],
  );

  const refreshAfterMutation = useCallback(
    async (listingId: string | null, message: string) => {
      setActionSuccess(message);
      setActionError(null);
      await loadAllAndCacheList(listingId, filters);
    },
    [filters, loadAllAndCacheList],
  );

  const runAction = useCallback(
    async (label: string, action: () => Promise<string | null>) => {
      setBusy(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        const refreshTarget = await action();
        if (!mountedRef.current) return;
        await refreshAfterMutation(refreshTarget, label);
      } catch (err) {
        if (!mountedRef.current) return;
        setActionError(safeErrorMessage(err));
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [refreshAfterMutation],
  );

  if (loading && viewModel.rows.length === 0) {
    return (
      <div className={styles.container}>
        <ListingsPageHeader disabled onCreateClick={() => setShowCreate(true)} />
        <p className={styles.loadingText}>Yukleniyor...</p>
      </div>
    );
  }

  if (error && viewModel.rows.length === 0) {
    return (
      <div className={styles.container}>
        <ListingsPageHeader disabled onCreateClick={() => setShowCreate(true)} />
        <div className={styles.errorBanner}>{error}</div>
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => loadAllAndCacheList(null, filters)}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const detail = viewModel.detail;

  return (
    <div className={styles.container}>
      <ListingsPageHeader
        disabled={busy || loading}
        onCreateClick={() => setShowCreate(true)}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}
      {actionError && <div className={styles.errorBanner}>{actionError}</div>}
      {actionSuccess && <div className={styles.successBanner}>{actionSuccess}</div>}

      <div className="lstProductShell">
        <ListingsList
          rowsCount={viewModel.rows.length}
          loading={loading}
          toolbar={
            <FilterControls
              filters={filters}
              disabled={busy || loading}
              onChange={handleApplyFilters}
            />
          }
        >
          {viewModel.rows.map((row) => (
            <ListingItem
              key={row.listingId}
              row={row}
              selected={row.listingId === viewModel.selectedListingId}
              onSelect={handleSelectListing}
            />
          ))}
        </ListingsList>

        <section className={styles.detail}>
          {showCreate && (
            <CreateListingPanel
              busy={busy}
              onCancel={() => setShowCreate(false)}
              onCreate={(payload) =>
                runAction("Yeni ilan olusturuldu.", async () => {
                  const created = await createAdminListing(payload);
                  setShowCreate(false);
                  return readListingIdFromMutation(created);
                })
              }
            />
          )}

          {detail ? (
            <ListingDetailTabs
              key={`tabs-${detail.listing.id}`}
              general={
                <ListingGeneralPanel
                  key={`detail-${detail.listing.id}`}
                  detail={detail}
                  busy={busy}
                  onSave={(payload) =>
                    runAction("Ilan bilgileri guncellendi.", async () => {
                      if (!viewModel.detail) return null;
                      await updateAdminListing(viewModel.detail.listing.id, payload);
                      return viewModel.detail.listing.id;
                    })
                  }
                  onStatusChange={(nextStatus) =>
                    runAction(`Durum guncellendi: ${nextStatus}`, async () => {
                      if (!viewModel.detail) return null;
                      await setAdminListingStatus(viewModel.detail.listing.id, nextStatus);
                      return viewModel.detail.listing.id;
                    })
                  }
                />
              }
              images={
                <ListingImagesPanel
                  key={`images-${detail.listing.id}`}
                  images={detail.images}
                  busy={busy}
                  onAddImage={(payload) =>
                    runAction("Gorsel eklendi.", async () => {
                      if (!viewModel.detail) return null;
                      await addAdminListingImage(viewModel.detail.listing.id, payload);
                      return viewModel.detail.listing.id;
                    })
                  }
                  onDeleteImage={(imageId) =>
                    runAction("Gorsel silindi.", async () => {
                      if (!viewModel.detail) return null;
                      await deleteAdminListingImage(
                        viewModel.detail.listing.id,
                        imageId,
                      );
                      return viewModel.detail.listing.id;
                    })
                  }
                  onReorder={(orderedIds) =>
                    runAction("Gorsel sirasi guncellendi.", async () => {
                      if (!viewModel.detail) return null;
                      await reorderAdminListingImages(
                        viewModel.detail.listing.id,
                        orderedIds,
                      );
                      return viewModel.detail.listing.id;
                    })
                  }
                />
              }
              mainItems={
                <ListingMainItemsPanel
                  key={`main-${detail.listing.id}`}
                  detail={detail}
                  items={detail.mainItems}
                  busy={busy}
                  onConfigure={(code, payload) =>
                    runAction(`Ana kalem guncellendi: ${code}`, async () => {
                      if (!viewModel.detail) return null;
                      await configureAdminListingMainItem(
                        viewModel.detail.listing.id,
                        code,
                        payload,
                      );
                      return viewModel.detail.listing.id;
                    })
                  }
                />
              }
              services={
                <ListingServicesPanel
                  key={`services-${detail.listing.id}`}
                  detail={detail}
                  services={detail.services}
                  busy={busy}
                  onConfigure={(code, payload) =>
                    runAction(`Hizmet guncellendi: ${code}`, async () => {
                      if (!viewModel.detail) return null;
                      await configureAdminListingService(
                        viewModel.detail.listing.id,
                        code,
                        payload,
                      );
                      return viewModel.detail.listing.id;
                    })
                  }
                />
              }
              checkout={
                <CheckoutReadinessPanel detail={detail} variant="tab" />
              }
            />
          ) : (
            !showCreate && (
              <div className={styles.panel}>
                <p className={styles.empty}>
                  Detayi goruntulemek icin soldan bir ilan secin veya yeni bir ilan olusturun.
                </p>
              </div>
            )
          )}
        </section>

        <CheckoutReadinessPanel detail={detail} variant="side" />
      </div>
    </div>
  );
}

function FilterControls({
  filters,
  disabled,
  onChange,
}: {
  filters: FilterState;
  disabled: boolean;
  onChange: (filters: FilterState) => void;
}) {
  return (
    <div className={styles.filterRow}>
      <select
        value={filters.status}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...filters, status: event.target.value as FilterState["status"] })
        }
      >
        <option value="">Tum durumlar</option>
        <option value="active">Aktif</option>
        <option value="passive">Pasif</option>
      </select>
      <select
        value={filters.type}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...filters, type: event.target.value as FilterState["type"] })
        }
      >
        <option value="">Tum turler</option>
        <option value="rent">Kiralik</option>
        <option value="sale">Satilik</option>
      </select>
    </div>
  );
}

function ListingItem({
  row,
  selected,
  onSelect,
}: {
  row: AdminListingRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={selected ? styles.listingItemSelected : styles.listingItem}
      onClick={() => onSelect(row.listingId)}
    >
      <div className={styles.listingItemHeader}>
        <h3 className={styles.listingItemTitle}>{row.title}</h3>
        <StatusChip statusLabel={row.statusLabel} />
      </div>
      <div className={styles.listingItemMeta}>
        <span>{row.typeLabel}</span>
        <span>{row.locationLabel || "Konum yok"}</span>
        <span>{row.priceLabel}</span>
      </div>
      <div className={styles.listingItemMeta}>
        <span>{row.imageCount} gorsel</span>
        <span>{row.mainItemCount} ana kalem</span>
        <span>{row.serviceOptionCount} hizmet</span>
        <CheckoutReadyChip ready={row.isCheckoutReady} />
      </div>
    </button>
  );
}

function StatusChip({ statusLabel }: { statusLabel: string }) {
  const className =
    statusLabel === "Aktif"
      ? `${styles.chip} ${styles.chipSuccess}`
      : statusLabel === "Pasif"
        ? `${styles.chip} ${styles.chipDanger}`
        : `${styles.chip}`;
  return <span className={className}>{statusLabel}</span>;
}

function CheckoutReadyChip({ ready }: { ready: boolean }) {
  return (
    <span
      className={`${styles.chip} ${ready ? styles.chipSuccess : styles.chipWarning}`}
    >
      {ready ? "Checkout hazir" : "Checkout eksik"}
    </span>
  );
}

function CreateListingPanel({
  busy,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  onCancel: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState<"rent" | "sale">("rent");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("TRY");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreate({
      type,
      title: title.trim(),
      slug: slug.trim(),
      city: city.trim() || null,
      district: district.trim() || null,
      price: Number(price) || 0,
      currency: currency.trim() || "TRY",
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Yeni ilan</h2>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
          disabled={busy}
        >
          Iptal
        </button>
      </div>
      <form onSubmit={handleSubmit} className={styles.formGrid}>
        <Field label="Tur">
          <select value={type} onChange={(event) => setType(event.target.value as "rent" | "sale")}>
            <option value="rent">Kiralik</option>
            <option value="sale">Satilik</option>
          </select>
        </Field>
        <Field label="Baslik">
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <Field label="Slug">
          <input value={slug} onChange={(event) => setSlug(event.target.value)} required />
        </Field>
        <Field label="Sehir">
          <input value={city} onChange={(event) => setCity(event.target.value)} />
        </Field>
        <Field label="Ilce">
          <input value={district} onChange={(event) => setDistrict(event.target.value)} />
        </Field>
        <Field label="Fiyat (kucuk birim)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field label="Para birimi">
          <input value={currency} onChange={(event) => setCurrency(event.target.value)} />
        </Field>
        <div className={styles.buttonRow}>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            Olustur
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof AdminListingsClientError) {
    return err.message;
  }
  return "Beklenmeyen bir hata olustu.";
}

function readListingIdFromMutation(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  const listing = record.listing;
  if (listing && typeof listing === "object") {
    const id = (listing as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  return null;
}

function firstListingIdInList(list: AdminListingsListResponse): string | null {
  for (const item of list.items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const id = (item as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim().length > 0) {
        return id;
      }
    }
  }
  return null;
}

function filterStateToQuery(filters: FilterState): AdminListingsListFilters {
  const query: AdminListingsListFilters = {};
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  return query;
}

// Re-export type for external consumers if any.
export type { AdminListingsListFilters };
