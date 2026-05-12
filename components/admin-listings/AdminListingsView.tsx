"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Building2,
  ImageIcon,
  MapPin,
  Plus,
  Tag,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  createInitialLoadGuard,
  shouldStartInitialLoad,
} from "@/lib/admin-ui/initial-load-guard.ts";
import {
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "@/lib/admin-ui/content-refresh.ts";
import {
  AdminListingRow,
  AdminListingsViewModel,
  buildAdminListingsViewModel,
} from "@/lib/admin-ui/listings-view-model.ts";
import { slugify } from "@/lib/admin-ui/slugify";

import type { AdminListingDetailTabId } from "@/lib/admin-ui/listings-product-layout";
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


type FilterState = {
  status: "" | "active" | "passive";
  type: "" | "rent" | "sale";
};

const INITIAL_FILTERS: FilterState = { status: "", type: "" };

type ListingLoadOptions = {
  selectFirstWhenMissing?: boolean;
};

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
  const [initialDetailTab, setInitialDetailTab] = useState<AdminListingDetailTabId>("general");

  const mountedRef = useRef(true);
  const initialLoadGuardRef = useRef(createInitialLoadGuard());
  const resumeRefreshGateRef = useRef(createContentRefreshGate());
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAllAndCacheList = useCallback(
    async (
      selectedListingId: string | null,
      nextFilters: FilterState,
      options: ListingLoadOptions = {},
    ) => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          fetchListFn(filterStateToQuery(nextFilters)),
          selectedListingId ? fetchSnapshotFn(selectedListingId) : Promise.resolve(null),
        ]);
        if (!mountedRef.current) return;

        if (results[0].status === "rejected") {
          setError(safeErrorMessage((results[0] as PromiseRejectedResult).reason));
          return;
        }
        const cachedList = results[0].value;
        const snapshot = results[1].status === "fulfilled" ? results[1].value : null;

        setList(cachedList);
        setViewModel(
          buildAdminListingsViewModel({
            list: cachedList,
            selectedListingId,
            snapshot,
            selectFirstWhenMissing: options.selectFirstWhenMissing,
          }),
        );
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
    if (!shouldStartInitialLoad(initialLoadGuardRef.current)) {
      return;
    }

    loadAllAndCacheList(null, INITIAL_FILTERS);
  }, [loadAllAndCacheList]);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      if (!shouldRefreshContentOnResume(resumeRefreshGateRef.current)) {
        return;
      }

      void refreshContentViews([
        () => loadAllAndCacheList(viewModel.selectedListingId, filters),
      ]);
    };

    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("focus", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [filters, loadAllAndCacheList, viewModel.selectedListingId]);

  const handleSelectListing = useCallback(
    async (listingId: string) => {
      if (!list) return;
      setShowCreate(false);
      setInitialDetailTab("general");
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
      await loadAllAndCacheList(listingId, filters, {
        selectFirstWhenMissing: listingId !== null,
      });
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
      <div className="space-y-6">
        <ListingsPageHeader disabled onCreateClick={() => setShowCreate(true)} />
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && viewModel.rows.length === 0) {
    return (
      <div className="space-y-6">
        <ListingsPageHeader disabled onCreateClick={() => setShowCreate(true)} />
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAllAndCacheList(null, filters)}
            >
              Tekrar dene
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const detail = viewModel.detail;

  return (
    <div className="space-y-6">
      <ListingsPageHeader
        disabled={busy || loading}
        onCreateClick={() => {
          setShowCreate(true);
          setViewModel((prev) => ({ ...prev, selectedListingId: null, detail: null }));
        }}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-destructive/60 hover:text-destructive" aria-label="Hatayı kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-600/60 hover:text-emerald-700" aria-label="Bildirimi kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

        <section className="flex flex-col gap-5">
          {showCreate ? (
            <CreateListingPanel
              busy={busy}
              onCancel={() => setShowCreate(false)}
              onCreate={(payload) =>
                runAction("Yeni ilan oluşturuldu.", async () => {
                  await createAdminListing(payload);
                  setShowCreate(false);
                  setInitialDetailTab("general");
                  return null;
                })
              }
            />
          ) : detail ? (
            <ListingDetailTabs
              key={`tabs-${detail.listing.id}`}
              initialTab={initialDetailTab}
              listingType={detail.listing.type}
              general={
                <ListingGeneralPanel
                  key={`detail-${detail.listing.id}`}
                  detail={detail}
                  busy={busy}
                  onSave={(payload) =>
                    runAction("İlan bilgileri güncellendi.", async () => {
                      if (!viewModel.detail) return null;
                      await updateAdminListing(viewModel.detail.listing.id, payload);
                      return viewModel.detail.listing.id;
                    })
                  }
                  onStatusChange={(nextStatus) =>
                    runAction(`Durum güncellendi: ${nextStatus}`, async () => {
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
                    runAction("Görsel eklendi.", async () => {
                      if (!viewModel.detail) return null;
                      await addAdminListingImage(viewModel.detail.listing.id, payload);
                      return viewModel.detail.listing.id;
                    })
                  }
                  onDeleteImage={(imageId) =>
                    runAction("Görsel silindi.", async () => {
                      if (!viewModel.detail) return null;
                      await deleteAdminListingImage(
                        viewModel.detail.listing.id,
                        imageId,
                      );
                      return viewModel.detail.listing.id;
                    })
                  }
                  onReorder={(orderedIds) =>
                    runAction("Görsel sırası güncellendi.", async () => {
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
                    runAction(`Ana kalem güncellendi: ${code}`, async () => {
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
                    runAction(`Hizmet güncellendi: ${code}`, async () => {
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
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Detayı görüntülemek için soldan bir ilan seçin<br />veya yeni bir ilan oluşturun.
                </p>
              </CardContent>
            </Card>
          )}
        </section>
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
    <div className="flex gap-2 flex-wrap">
      <Select
        value={filters.status}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...filters, status: event.target.value as FilterState["status"] })
        }
        title="İlanın yayın durumuna göre filtreleyin"
      >
        <option value="">Tüm yayın durumları</option>
        <option value="active">Yayında</option>
        <option value="passive">Yayın dışı</option>
      </Select>
      <Select
        value={filters.type}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...filters, type: event.target.value as FilterState["type"] })
        }
      >
        <option value="">Tüm türler</option>
        <option value="rent">Kiralık</option>
        <option value="sale">Satılık</option>
      </Select>
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
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-card hover:border-primary/30 hover:bg-accent/50"
      }`}
      onClick={() => onSelect(row.listingId)}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h3 className="font-semibold text-sm truncate">{row.title}</h3>
        <StatusBadge statusLabel={row.statusLabel} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1.5">
        <span className="flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {row.typeLabel}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {row.locationLabel || "Konum yok"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums">
          {row.priceLabel}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          <ImageIcon className="h-2.5 w-2.5 mr-0.5" />
          {row.imageCount}
        </Badge>
        {row.typeLabel !== "Satilik" && (
          <CheckoutReadyBadge ready={row.isCheckoutReady} />
        )}
      </div>
    </button>
  );
}

function StatusBadge({ statusLabel }: { statusLabel: string }) {
  // Yayın durumu: ilanın müşteri tarafına görünür olup olmadığını anlatır.
  // "Aktif" -> yayında (görünür), "Pasif" -> yayın dışı (görünmez).
  const isActive = statusLabel === "Aktif";
  const isPassive = statusLabel === "Pasif";
  const variant = isActive ? ("success" as const) : isPassive ? ("destructive" as const) : ("secondary" as const);
  const visibleText = isActive ? "Yayında" : isPassive ? "Yayın dışı" : statusLabel;
  const tooltip = isActive
    ? "Yayın durumu: ilan şu anda müşterilere görünür."
    : isPassive
      ? "Yayın durumu: ilan müşterilere görünmüyor."
      : "Yayın durumu";
  return (
    <Badge
      variant={variant}
      className="text-[10px] px-1.5 py-0"
      title={tooltip}
      aria-label={tooltip}
    >
      {visibleText}
    </Badge>
  );
}

function CheckoutReadyBadge({ ready }: { ready: boolean }) {
  // Checkout hazırlığı: yayın durumundan bağımsız bir konfigürasyon kontrolüdür.
  // Görsel, fiyat ve ödeme kalemleri tamamsa "hazır", aksi halde "eksik" olur.
  // Aktif (yayında) bir ilanın checkout konfigürasyonu eksik olabilir.
  const tooltip = ready
    ? "Checkout konfigürasyonu tamam: görsel, fiyat ve ödeme kalemleri eklenmiş."
    : "Checkout için bazı yapılandırma kalemleri eksik (ör. görsel, fiyat, ödeme kalemi). Yayın durumundan bağımsızdır.";
  return (
    <Badge
      variant={ready ? "success" : "warning"}
      className="text-[10px] px-1.5 py-0"
      title={tooltip}
      aria-label={tooltip}
    >
      {ready ? "Checkout hazır" : "Checkout eksik"}
    </Badge>
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
  const [slugManual, setSlugManual] = useState(false);
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [roomCount, setRoomCount] = useState("");
  const [bathroomCount, setBathroomCount] = useState("");
  const [grossArea, setGrossArea] = useState("");
  const [isFurnished, setIsFurnished] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const titleError = showErrors && !title.trim() ? "Bu alan zorunludur" : null;
  const districtError = showErrors && !district.trim() ? "Bu alan zorunludur" : null;
  const descriptionError = showErrors && !description.trim() ? "Bu alan zorunludur" : null;

  const computedSlug = slugManual ? slug : slugify(title);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManual) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !district.trim() || !description.trim()) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onCreate({
      type,
      title: title.trim(),
      slug: computedSlug.trim(),
      city: city.trim() || null,
      district: district.trim() || null,
      price: Number(price) || 0,
      currency: currency.trim() || "TRY",
      summary: summary.trim() || null,
      description: description.trim() || null,
      room_count: roomCount ? Number(roomCount) : null,
      bathroom_count: bathroomCount ? Number(bathroomCount) : null,
      gross_area_m2: grossArea ? Number(grossArea) : null,
      is_furnished: isFurnished,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-balance">Yeni İlan Oluştur</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy} aria-label="Kapat">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          Temel bilgileri doldurun. Görseller ve ödeme kalemlerini oluşturduktan sonra düzenleyebilirsiniz.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* TEMEL */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Temel Bilgiler</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="İlan Türü">
                <Select
                  value={type}
                  onChange={(event) => setType(event.target.value as "rent" | "sale")}
                >
                  <option value="rent">Kiralık</option>
                  <option value="sale">Satılık</option>
                </Select>
              </FormField>
              <FormField label="İlan Başlığı" required error={titleError}>
                <Input
                  value={title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  placeholder="Örn: Kadıköy 2+1 Daire"
                  required
                  className={titleError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </FormField>
            </div>

            <FormField label="URL Adresi (Slug)" hint="Başlıktan otomatik oluşturulur.">
              <div className="flex gap-2 items-center">
                <Input
                  value={computedSlug}
                  onChange={(event) => {
                    setSlugManual(true);
                    setSlug(event.target.value);
                  }}
                  className="font-mono text-xs"
                  required
                />
                {slugManual && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs whitespace-nowrap"
                    onClick={() => {
                      setSlugManual(false);
                      setSlug(slugify(title));
                    }}
                  >
                    Otomatik
                  </Button>
                )}
              </div>
            </FormField>
          </fieldset>

          <Separator />

          {/* KONUM */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Konum</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Şehir">
                <Input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Örn: İstanbul"
                />
              </FormField>
              <FormField label="İlçe" required error={districtError}>
                <Input
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  placeholder="Örn: Kadıköy"
                  className={districtError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </FormField>
            </div>
          </fieldset>

          <Separator />

          {/* FİYAT */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Fiyat</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Fiyat">
                <Input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Para Birimi">
                <Select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option value="TRY">TRY (₺)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </Select>
              </FormField>
            </div>
          </fieldset>

          <Separator />

          {/* ÖZELLİKLER */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Özellikler</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Oda sayısı">
                <Input
                  type="number"
                  min={0}
                  value={roomCount}
                  onChange={(event) => setRoomCount(event.target.value)}
                  placeholder="Örn: 3"
                />
              </FormField>
              <FormField label="Banyo sayısı">
                <Input
                  type="number"
                  min={0}
                  value={bathroomCount}
                  onChange={(event) => setBathroomCount(event.target.value)}
                  placeholder="Örn: 1"
                />
              </FormField>
              <FormField label="Brüt alan (m²)">
                <Input
                  type="number"
                  min={0}
                  value={grossArea}
                  onChange={(event) => setGrossArea(event.target.value)}
                  placeholder="Örn: 120"
                />
              </FormField>
            </div>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isFurnished}
                onChange={(event) => setIsFurnished(event.target.checked)}
                className="size-4 rounded border-input"
              />
              <span>Mobilyalı</span>
            </label>
          </fieldset>

          <Separator />

          {/* AÇIKLAMA */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Açıklama</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Özet" hint="Kısa tanıtım metni.">
                <Textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="Kısa açıklama..."
                  rows={3}
                />
              </FormField>
              <FormField label="Detaylı açıklama" required error={descriptionError}>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Detaylı ilan metni..."
                  rows={3}
                  className={descriptionError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </FormField>
            </div>
          </fieldset>

          <Separator />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              İptal
            </Button>
            <Button type="submit" disabled={busy}>
              <Plus className="h-4 w-4" />
              Oluştur
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FormField({
  label,
  hint,
  children,
  required,
  error,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof AdminListingsClientError) {
    return err.message;
  }
  return "Beklenmeyen bir hata olustu.";
}

function filterStateToQuery(filters: FilterState): AdminListingsListFilters {
  const query: AdminListingsListFilters = {};
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  return query;
}

// Re-export type for external consumers if any.
export type { AdminListingsListFilters };
