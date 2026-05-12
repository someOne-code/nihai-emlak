// Phase 9B: /admin/listing-catalog page
//
// Protected page: checks admin role. If non-admin, redirects to /admin.

import { redirect } from "next/navigation";

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import AdminCatalogView from "@/components/admin-catalog/AdminCatalogView";

// Note: `export const dynamic = "force-dynamic"` is intentionally omitted.
// `nextConfig.cacheComponents: true` disallows that segment config. The page
// becomes dynamic implicitly via Supabase auth cookie reads below.

export const metadata = {
  title: "Fiyat Kataloğu | Nihai Emlak Admin",
  description: "Ana ödeme kalemleri ve ek hizmetler kataloğunu yönetin.",
};

export default async function ListingCatalogPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/admin");
  }

  return <AdminCatalogView />;
}
