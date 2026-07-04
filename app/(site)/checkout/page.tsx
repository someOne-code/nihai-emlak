import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import type { MainItemOption, ServiceItemOption } from "@/components/checkout/checkout-form";
import { getPublicListingDetailForServerPage } from "@/lib/read-models/public-listings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Güvenli Ödeme | Umut Emlak",
  description: "Kiralama talebinizi onaylayın ve güvenli ödemenizi gerçekleştirin.",
};

type CheckoutPageProps = {
  searchParams: Promise<{ listingId?: string }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  await connection();
  const { listingId } = await searchParams;

  if (!listingId) {
    redirect("/listings");
  }

  let listing;
  try {
    listing = await getPublicListingDetailForServerPage(listingId);
  } catch {
    redirect("/listings");
  }

  // Only rent listings can go through checkout
  if (listing.type !== "rent") {
    redirect(`/listings/${listing.slug}`);
  }

  const supabase = await createClient();

  // Fetch enabled main item options for this listing
  const { data: mainItemsData, error: mainItemsError } = await supabase
    .from("listing_main_item_options")
    .select(`
      id,
      override_label,
      override_amount,
      override_multiplier,
      main_item_catalog (
        id,
        code,
        label,
        description,
        pricing_strategy,
        default_amount,
        default_multiplier
      )
    `)
    .eq("listing_id", listingId)
    .eq("is_enabled", true);

  if (mainItemsError) {
    console.error("Failed to load listing main items:", mainItemsError);
  }

  // Fetch enabled service catalog items for this listing
  const { data: servicesData, error: servicesError } = await supabase.rpc(
    "list_public_listing_services",
    {
      p_listing_id: listingId,
    }
  );

  if (servicesError) {
    console.error("Failed to load listing services:", servicesError);
  }

  const mainItems = (mainItemsData || []) as unknown as MainItemOption[];
  const services = ((servicesData as unknown as { items: ServiceItemOption[] } | null)?.items || []);

  const isbankCheckoutUrl =
    process.env.ISBANK_HOSTED_CHECKOUT_URL ||
    "https://entegrasyon.asseco-see.com.tr/fim/est3Dgate";

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 pt-36">
        <div className="mx-auto max-w-screen-xl px-4 md:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-[#102D47] dark:text-white tracking-tight">
              Ödeme ve Başvuru
            </h1>
            <p className="text-slate-500 mt-2">
              Kiralama başvurunuzu tamamlamak için lütfen aşağıdaki form adımlarını doldurun.
            </p>
          </div>

          <CheckoutForm
            listing={listing}
            mainItems={mainItems}
            services={services}
            isbankCheckoutUrl={isbankCheckoutUrl}
          />
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
