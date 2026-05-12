import Link from "next/link";
import { connection } from "next/server";

import { ListingActionBox } from "@/components/listings/listing-action-box";
import { ListingDetailHeader } from "@/components/listings/listing-detail-header";
import { ListingFeatureList } from "@/components/listings/listing-feature-list";
import { ListingGallery } from "@/components/listings/listing-gallery";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { getPublicListingDetail } from "@/lib/api/listings";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  await connection();

  const { id } = await params;

  try {
    const listing = await getPublicListingDetail(id);
    const actionBox = await ListingActionBox({ listing });

    return (
      <>
        <PublicHeader />
        <main>
          <section className="relative overflow-x-hidden bg-property-hero pt-36">
            <ListingDetailHeader listing={listing} />
          </section>

          <section className="bg-white py-14">
            <ListingGallery listing={listing} />
            <div className="mx-auto grid max-w-screen-xl gap-10 px-4 pt-16 lg:grid-cols-[1fr_360px]">
              <article className="flex flex-col gap-10">
                <section className="mx-auto max-w-4xl text-center text-[#668199]" data-aos="fade-up">
                  <p className="px-4 text-base sm:px-6 sm:text-lg md:px-8 md:text-xl lg:text-2xl">
                    {listing.description || listing.summary || "Bu ilan için açıklama henüz eklenmedi."}
                  </p>
                </section>

                <section className="rounded-lg bg-[#F0F6FA] p-8" data-aos="fade-up">
                  <h2 className="mb-6 flex justify-center text-2xl font-bold text-[#102D47] sm:text-4xl">
                    Available
                  </h2>
                  <ListingFeatureList listing={listing} />
                </section>
              </article>

              <aside className="lg:sticky lg:top-28 lg:self-start" data-aos="fade-left">
                {actionBox}
              </aside>
            </div>
          </section>
        </main>
        <PublicFooter />
      </>
    );
  } catch {
    return (
      <>
        <PublicHeader />
        <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-property-hero px-4 pt-36 text-center">
          <h1 className="text-3xl font-semibold text-[#102D47]">İlan yüklenemedi</h1>
          <p className="text-[#668199]">İlan detayları yüklenirken bir sorun oluştu.</p>
          <Button asChild>
            <Link href="/listings">İlanlara Dön</Link>
          </Button>
        </main>
        <PublicFooter />
      </>
    );
  }
}
