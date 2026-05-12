import Link from "next/link";
import { connection } from "next/server";

import { ListingFilters } from "@/components/listings/listing-filters";
import { ListingGrid } from "@/components/listings/listing-grid";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { listPublicListings } from "@/lib/api/listings";
import type { ApiListingListResponse, ListingType } from "@/types/listing";

type ListingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListingsPage({ searchParams }: ListingsPageProps) {
  await connection();

  const params = await searchParams;
  const type = readListingType(params.type);
  const city = readStringParam(params.city);
  const limit = readNumberParam(params.limit, 24);
  const offset = readNumberParam(params.offset, 0);
  const result = await getListingsResult({ city, limit, offset, type });

  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative overflow-x-hidden bg-property-hero bg-cover pb-20 pt-36 text-center">
          <h1 className="relative text-[50px] font-bold capitalize leading-[1.2] text-[#102D47] dark:text-white">
            Properties List
          </h1>
          <p className="mx-auto mb-12 mt-7 w-full max-w-md px-4 text-lg font-normal text-[#668199] sm:px-0">
            Kiralık ve satılık ilanları keşfedin.
          </p>
          <div className="mx-0 my-[0.9375rem] flex flex-wrap items-baseline justify-center">
            <Link href="/" className="flex items-center text-xl font-normal text-[#102D47] hover:underline after:relative after:mx-3 after:inline-block after:size-2 after:-rotate-45 after:border-b-2 after:border-r-2 after:border-[#102D47] after:content-[''] dark:text-white dark:after:border-white">
              Home
            </Link>
            <span className="mx-2.5 text-xl text-[#102D47] dark:text-white">Property List</span>
          </div>
        </section>

        <section className="bg-white px-4 py-14 dark:bg-[#0c121e]">
          <div className="mx-auto max-w-screen-xl">
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="hidden lg:col-span-4 lg:block">
                <ListingFilters city={city} type={type} />
              </div>
              <div className="col-span-12 lg:col-span-8">
                <div className="flex w-full flex-wrap items-center justify-between gap-6 pb-8 lg:flex-nowrap lg:gap-0">
                  <div className="flex flex-1 justify-between px-4">
                    <h5 className="text-xl text-[#102D47] dark:text-white">
                      {result.ok ? `${result.response.items.length} Properties Found` : "Properties"}
                    </h5>
                    <p className="flex items-center gap-2 text-[#668199]">Sort by</p>
                  </div>
                  <div className="flex flex-1 gap-3 px-4">
                    <select className="rounded-lg border border-[#6bc5f94d] bg-white p-3 pr-9 text-[#102D47] dark:border-[#224767] dark:bg-[#0e1624] dark:text-white">
                      <option>Sort by Title</option>
                    </select>
                    <button className="rounded-lg border border-[#2F73F2] bg-transparent p-3 text-[#2F73F2] hover:bg-[#2F73F2] hover:text-white">
                      ≡
                    </button>
                    <button className="rounded-lg border border-[#2F73F2] bg-[#2F73F2] p-3 text-white">
                      ▦
                    </button>
                  </div>
                </div>

                <div className="px-4">
                  {result.ok ? (
                    <ListingGrid listings={result.response.items} />
                  ) : (
                    <div className="rounded-lg bg-white p-10 text-center text-[#668199] shadow-property dark:bg-[#1F2A37]">
                      İlanlar yüklenirken bir sorun oluştu.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
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

function readNumberParam(value: string | string[] | undefined, fallback: number): number {
  const raw = readStringParam(value);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getListingsResult(input: {
  city: string;
  limit: number;
  offset: number;
  type: ListingType | null;
}): Promise<
  | { ok: true; response: ApiListingListResponse }
  | { ok: false }
> {
  try {
    const response = await listPublicListings({
      city: input.city || undefined,
      limit: input.limit,
      offset: input.offset,
      type: input.type ?? undefined,
    });
    return { ok: true, response };
  } catch {
    return { ok: false };
  }
}
