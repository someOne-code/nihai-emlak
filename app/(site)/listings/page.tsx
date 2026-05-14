import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ListingFilters, MobileFilterButton } from "@/components/listings/listing-filters";
import { ListingResults, type ListingSort } from "@/components/listings/listing-results";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { listPublicListingsForServerPage } from "@/lib/read-models/public-listings";
import { getPublicListingFiltersForServerPage } from "@/lib/read-models/public-listings";
import type { ApiListingListResponse, ListingType } from "@/types/listing";
import type { PublicListingFilters } from "@/types/listing-filters";

type ListingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  await connection();

  const params = await searchParams;
  const listingParams = readListingParams(params);
  const sort = readListingSort(params.sort);
  const filterMetadataResult = await getFilterMetadataResult();

  if (!filterMetadataResult.ok) {
    return (
      <>
        <PublicHeader />
        <main>
          <ListingsHero />
          <section className="bg-white px-4 py-14 dark:bg-[#0c121e]">
            <div className="mx-auto max-w-screen-xl rounded-lg bg-white p-10 text-center text-[#668199] shadow-property dark:bg-[#1F2A37]">
              İlanlar yüklenirken bir sorun oluştu.
            </div>
          </section>
        </main>
        <PublicFooter />
      </>
    );
  }

  const filterMetadata = filterMetadataResult.filters;

  return (
    <>
      <PublicHeader />
      <main>
        <ListingsHero />

        <section className="bg-white px-4 py-14 dark:bg-[#0c121e]">
          <div className="mx-auto max-w-screen-xl">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <h2 className="text-2xl font-semibold text-[#102D47] dark:text-white">İlanlar</h2>
              <MobileFilterButton filters={filterMetadata} values={listingParams} />
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
              <aside className="hidden lg:col-span-4 lg:block">
                <ListingFilters filters={filterMetadata} values={listingParams} />
              </aside>

              <div className="lg:col-span-8" aria-label="Sıralama ve ilan sonuçları">
                <Suspense fallback={<ListingsResultsFallback />}>
                  <ListingsContent params={listingParams} sort={sort} />
                </Suspense>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

function ListingsHero() {
  return (
    <section className="relative overflow-x-hidden bg-property-hero bg-cover pb-20 pt-36 text-center">
      <h1 className="relative text-[50px] font-bold capitalize leading-[1.2] text-[#102D47] dark:text-white">
        İlanlar
      </h1>
      <p className="mx-auto mb-12 mt-7 w-full max-w-md px-4 text-lg font-normal text-[#668199] sm:px-0">
        Kiralık ve satılık ilanları keşfedin.
      </p>
      <nav className="mx-0 my-[0.9375rem] flex flex-wrap items-baseline justify-center" aria-label="Breadcrumb">
        <Link href="/" className="flex items-center text-xl font-normal text-[#102D47] hover:underline after:relative after:mx-3 after:inline-block after:size-2 after:-rotate-45 after:border-b-2 after:border-r-2 after:border-[#102D47] after:content-[''] dark:text-white dark:after:border-white">
          Ana Sayfa
        </Link>
        <Link href="/listings" className="mx-2.5 text-xl text-[#102D47] hover:underline dark:text-white" aria-current="page">
          İlanlar
        </Link>
      </nav>
    </section>
  );
}

async function ListingsContent({
  params,
  sort,
}: {
  params: ListingParams;
  sort: ListingSort;
}) {
  const result = await getListingsResult(params);
  if (!result.ok) {
    return (
      <div className="rounded-lg bg-white p-10 text-center text-[#668199] shadow-property dark:bg-[#1F2A37]">
        İlanlar yüklenirken bir sorun oluştu.
      </div>
    );
  }

  const items = result.response.items;
  const limit = params.limit;
  const offset = params.offset;

  return (
    <div className="flex flex-col gap-8">
      <ListingResults listings={items} initialSort={sort} />
      <div className="flex flex-wrap justify-between gap-3">
        {offset > 0 ? (
          <Link
            href={getPaginationHref({ ...params, offset: Math.max(0, offset - limit), sort })}
            className="rounded-lg border border-[#2F73F2] px-5 py-3 font-semibold text-[#2F73F2] hover:bg-[#2F73F2] hover:text-white"
          >
            Önceki
          </Link>
        ) : (
          <span />
        )}
        {items.length === limit ? (
          <Link
            href={getPaginationHref({ ...params, offset: offset + limit, sort })}
            className="ml-auto rounded-lg border border-[#2F73F2] bg-[#2F73F2] px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Sonraki
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ListingsResultsFallback() {
  return (
    <div className="flex flex-col gap-6" aria-label="İlanlar yükleniyor">
      <div className="h-20 animate-pulse rounded-lg bg-[#F0F6FA] shadow-property dark:bg-[#1F2A37]" />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-lg bg-[#F0F6FA] shadow-property dark:bg-[#1F2A37]" />
        ))}
      </div>
    </div>
  );
}

function readStringParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

function readListingType(value: string | string[] | undefined): ListingType | null {
  const raw = readStringParam(value);
  return raw === "rent" || raw === "sale" ? raw : null;
}

function readListingSort(value: string | string[] | undefined): ListingSort {
  const raw = readStringParam(value);
  return raw === "price_asc" || raw === "price_desc" || raw === "title_asc" ? raw : "default";
}

type ListingParams = {
  city: string;
  district: string;
  isFurnished: "" | "true" | "false";
  limit: number;
  maxArea: string;
  maxPrice: string;
  minArea: string;
  minBathrooms: string;
  minPrice: string;
  minRooms: string;
  offset: number;
  type: ListingType | null;
};

function readListingParams(params: Record<string, string | string[] | undefined>): ListingParams {
  return {
    city: readStringParam(params.city),
    district: readStringParam(params.district),
    isFurnished: readFurnishedParam(params.is_furnished),
    limit: readNumberParam(params.limit, 12),
    maxArea: readNumberStringParam(params.max_area),
    maxPrice: readNumberStringParam(params.max_price),
    minArea: readNumberStringParam(params.min_area),
    minBathrooms: readNumberStringParam(params.min_bathrooms),
    minPrice: readNumberStringParam(params.min_price),
    minRooms: readNumberStringParam(params.min_rooms),
    offset: readNumberParam(params.offset, 0),
    type: readListingType(params.type),
  };
}

function readFurnishedParam(value: string | string[] | undefined): "" | "true" | "false" {
  const raw = readStringParam(value);
  return raw === "true" || raw === "false" ? raw : "";
}

function readNumberStringParam(value: string | string[] | undefined): string {
  const raw = readStringParam(value);
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed >= 0 ? raw : "";
}

function readNumberParam(value: string | string[] | undefined, fallback: number): number {
  const raw = readStringParam(value);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getPaginationHref(input: ListingParams & { sort: ListingSort }): string {
  const search = new URLSearchParams();

  if (input.type) search.set("type", input.type);
  if (input.city) search.set("city", input.city);
  if (input.district) search.set("district", input.district);
  if (input.minPrice) search.set("min_price", input.minPrice);
  if (input.maxPrice) search.set("max_price", input.maxPrice);
  if (input.minRooms) search.set("min_rooms", input.minRooms);
  if (input.minBathrooms) search.set("min_bathrooms", input.minBathrooms);
  if (input.minArea) search.set("min_area", input.minArea);
  if (input.maxArea) search.set("max_area", input.maxArea);
  if (input.isFurnished) search.set("is_furnished", input.isFurnished);
  if (input.sort !== "default") search.set("sort", input.sort);
  search.set("limit", String(input.limit));
  search.set("offset", String(input.offset));

  return `/listings?${search.toString()}`;
}

async function getListingsResult(input: ListingParams): Promise<
  | { ok: true; response: ApiListingListResponse }
  | { ok: false }
> {
  try {
    const response = await listPublicListingsForServerPage({
      city: input.city || undefined,
      district: input.district || undefined,
      is_furnished: input.isFurnished || undefined,
      limit: input.limit,
      max_area: input.maxArea || undefined,
      max_price: input.maxPrice || undefined,
      min_area: input.minArea || undefined,
      min_bathrooms: input.minBathrooms || undefined,
      min_price: input.minPrice || undefined,
      min_rooms: input.minRooms || undefined,
      offset: input.offset,
      type: input.type ?? undefined,
    });
    return { ok: true, response };
  } catch {
    return { ok: false };
  }
}

async function getFilterMetadataResult(): Promise<
  | { ok: true; filters: PublicListingFilters }
  | { ok: false }
> {
  try {
    const filters = await getPublicListingFiltersForServerPage();
    return { ok: true, filters };
  } catch {
    return { ok: false };
  }
}
