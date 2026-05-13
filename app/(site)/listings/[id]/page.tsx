import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";

import { ListingActionBox } from "@/components/listings/listing-action-box";
import { ListingContactBox } from "@/components/listings/listing-contact-box";
import { ListingDetailHeader } from "@/components/listings/listing-detail-header";
import { ListingFeatureList } from "@/components/listings/listing-feature-list";
import { ListingDetailGallery } from "@/components/listings/listing-detail-gallery";
import { ListingLocationSection } from "@/components/listings/listing-location-section";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { getPublicListingDetail } from "@/lib/api/listings";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ListingDetailPageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const listing = await getPublicListingDetail(id);
    return {
      title: `${listing.title} | Nihai Emlak`,
      description: listing.summary || listing.description?.slice(0, 160) || "İlan detayı.",
    };
  } catch {
    return {
      title: "İlan Bulunamadı | Nihai Emlak",
    };
  }
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  await connection();

  const { id } = await params;

  try {
    const listing = await getPublicListingDetail(id);
    const actionBox = await ListingActionBox({ listing });

    return (
      <>
        <PublicHeader />
        <main className="bg-slate-50 dark:bg-slate-900 pb-24 pt-36">
          <div className="mx-auto max-w-screen-xl px-4 md:px-8">
            
            {/* Geri Linki */}
            <div className="mb-6" data-aos="fade-down">
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                İlanlara Dön
              </Link>
            </div>

            {/* Ana Grid Layout */}
            <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
              
              {/* Sol Kolon */}
              <div className="flex flex-col gap-10">
                
                {/* Galeri */}
                <div data-aos="fade-up">
                  <ListingDetailGallery listing={listing} />
                </div>

                {/* Başlık ve Temel Özellikler */}
                <div data-aos="fade-up" data-aos-delay="100">
                  <ListingDetailHeader listing={listing} />
                </div>

                {/* Açıklama (Başlıksız, düz metin) */}
                <div className="text-[17px] leading-relaxed text-[#668199] dark:text-[#94a3b8]" data-aos="fade-up" data-aos-delay="200">
                  {listing.description || listing.summary || "Bu ilan için açıklama eklenmemiş."}
                </div>

                {/* Özellikler Listesi */}
                <section className="flex flex-col gap-6 pt-4" data-aos="fade-up" data-aos-delay="300">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#102D47] dark:text-white">
                    Özellikler
                  </h2>
                  <ListingFeatureList listing={listing} />
                </section>

                {/* Konum */}
                <section className="flex flex-col gap-6 pt-4" data-aos="fade-up" data-aos-delay="400">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#102D47] dark:text-white">
                    Konum
                  </h2>
                  <ListingLocationSection listing={listing} />
                </section>

              </div>

              {/* Sağ Kolon */}
              <div className="flex flex-col gap-6">
                <div className="sticky top-28 flex flex-col gap-6" data-aos="fade-left" data-aos-delay="200">
                  {actionBox}
                  <ListingContactBox listingId={listing.id} />
                </div>
              </div>
            </div>
          </div>
        </main>
        <PublicFooter />
      </>
    );
  } catch {
    notFound();
  }
}
