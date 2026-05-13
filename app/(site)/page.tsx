import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";

import { BlogPreview } from "@/components/home/blog-preview";
import { CompanyInfo } from "@/components/home/company-info";
import { DiscoverProperties } from "@/components/home/discover-properties";
import { HomeFeatures } from "@/components/home/home-features";
import { HomeServices } from "@/components/home/home-services";
import { FeaturedListings } from "@/components/listings/featured-listings";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { listPublishedBlogPreviewPosts } from "@/lib/api/blog";
import { listPublicListingsForServerPage } from "@/lib/read-models/public-listings";
import type { ApiListingListItem } from "@/types/listing";

export default async function Index() {
  await connection();

  let featuredListings: ApiListingListItem[] = [];
  let featuredListingsSource: "api" | "fallback" = "fallback";

  try {
    const response = await listPublicListingsForServerPage({ limit: 6 });
    featuredListings = response.items;
    featuredListingsSource = response.items.length > 0 ? "api" : "fallback";
  } catch {
    featuredListings = [];
    featuredListingsSource = "fallback";
  }

  const blogPreviewPosts = await listPublishedBlogPreviewPosts();

  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative overflow-x-hidden bg-property-hero bg-no-repeat pb-0 pt-44">
          <div className="container relative z-10 mx-auto max-w-screen-xl md:max-w-screen-md lg:max-w-screen-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="col-span-6 flex flex-col items-start justify-center" data-aos="fade-right">
                <div className="mb-8">
                  <p className="mb-4 ml-4 text-lg font-semibold text-[#2F73F2]">
                    Premium Gayrimenkul Yönetimi
                  </p>
                  <h1 className="ml-4 text-4xl font-bold leading-[1.2] text-[#102D47] dark:text-white md:text-[50px]">
                    Yaşam Alanınızı
                    <br />
                    Yeniden Keşfedin
                  </h1>
                </div>
                <div className="ml-4 max-w-xl sm:w-full">
                  <div className="flex gap-1 bg-transparent">
                    <Link
                      href="/listings?type=rent"
                      className="rounded-t-md border-b border-[#2F73F2] bg-white px-9 py-3 text-xl text-[#102D47] dark:bg-[#0c121e] dark:text-white"
                    >
                      Kiralık
                    </Link>
                    <Link
                      href="/listings?type=sale"
                      className="rounded-t-md bg-white/50 px-9 py-3 text-xl text-[#102D47] dark:bg-[#0c121e]/50 dark:text-white"
                    >
                      Satılık
                    </Link>
                  </div>
                  <div className="rounded-b-lg rounded-tr-lg bg-white p-8 pb-10 shadow-lg dark:bg-[#0c121e]">
                    <div className="relative my-2 rounded-lg border-0">
                      <div className="flex min-h-44 items-center rounded-lg border border-[#6bc5f94d] bg-white px-6 py-8 dark:border-[#224767] dark:bg-[#0c121e]">
                        <p className="text-2xl font-semibold leading-snug text-[#102D47] dark:text-white md:text-3xl">
                          İstanbul&apos;un en prestijli lokasyonlarında uzun dönem kiralama ve yatırım danışmanlığı.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mb-12 ml-4 mt-8 flex flex-col justify-start gap-3">
                  <div className="flex gap-2" data-aos="fade-left">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <svg key={index} className="h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 .587l3.668 7.431L24 9.763l-6 5.847L19.336 24 12 20.019 4.664 24 6 15.61 0 9.763l8.332-1.745z" />
                      </svg>
                    ))}
                  </div>
                  <div data-aos="fade-left">
                    <p className="text-lg text-black dark:text-white">
                      4.9/5 <span className="text-gray-400">- müşteri değerlendirmesi</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 col-span-6 hidden lg:block xl:-right-60">
                <Image
                  src="/property-nextjs-pro/images/hero/hero-image.png"
                  alt="heroimage"
                  width={800}
                  height={818}
                  priority
                  sizes="(min-width: 1280px) 800px, 50vw"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <FeaturedListings listings={featuredListings} source={featuredListingsSource} />
        <DiscoverProperties />
        <HomeFeatures />
        <HomeServices />
        <BlogPreview posts={blogPreviewPosts} />
        <CompanyInfo />
      </main>
      <PublicFooter />
    </>
  );
}
