import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { MessageSquare, Calendar, CreditCard, ChevronRight, User, Home } from "lucide-react";

import { formatListingPrice, getListingLocation } from "@/lib/mappers/listing.mapper";

type ListingImage = {
  image_url: string;
  is_primary: boolean;
};

type DbListing = {
  id: string;
  title: string;
  type: "rent" | "sale";
  city: string;
  district: string | null;
  price: number;
  currency: string;
  listing_images: ListingImage[];
};

type DbReservation = {
  id: string;
  listing_id: string;
  user_id: string;
  move_in_date: string;
  stay_months: number;
  guest_count: number;
  note: string | null;
  status: string;
  created_at: string;
  listing: DbListing | null;
};

type DbOrder = {
  id: string;
  reservation_id: string;
  user_id: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
};

type DbConversation = {
  id: string;
  user_id: string;
  listing_id: string;
  chatwoot_conversation_id: string | null;
  status: string;
  updated_at: string;
  listing: DbListing | null;
};

function getPrimaryImage(images: ListingImage[] | undefined): string {
  if (!images || images.length === 0) return "/property-nextjs-pro/placeholder-property.jpg";
  const primary = images.find((img) => img.is_primary);
  return primary ? primary.image_url : images[0].image_url;
}

export default async function ProtectedPage() {
  await connection();
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/auth/login");
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // 2. Fetch reservations with listings and image sub-query
  const { data: reservations } = (await supabase
    .from("reservations")
    .select(`
      *,
      listing:listings (
        id,
        title,
        type,
        city,
        district,
        price,
        currency,
        listing_images (
          image_url,
          is_primary
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })) as { data: DbReservation[] | null };

  // 3. Fetch orders
  const { data: orders } = (await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })) as { data: DbOrder[] | null };

  // 4. Fetch conversations
  const { data: conversations } = (await supabase
    .from("chatwoot_conversations")
    .select(`
      *,
      listing:listings (
        id,
        title,
        type,
        city,
        district,
        price,
        currency,
        listing_images (
          image_url,
          is_primary
        )
      )
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })) as { data: DbConversation[] | null };

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Belirtilmemiş";

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      {/* Profil Karşılama Kartı */}
      <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-[#1e293b] dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2F73F2]/10 text-[#2F73F2]">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Hoş Geldiniz, {profile?.full_name || user.email}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Üyelik Tarihi: {joinDate} | E-posta: {user.email}
            </p>
          </div>
        </div>
        <div className="rounded-full bg-[#2F73F2]/10 px-4 py-1.5 text-xs font-semibold text-[#2F73F2]">
          {profile?.role === "admin" ? "Yönetici" : "Standart Üye"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol Kolon: Rezervasyonlarım */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#2F73F2]" />
              Rezervasyonlarım ve Kiralama Taleplerim
            </h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {reservations?.length || 0} Talep
            </span>
          </div>

          {reservations && reservations.length > 0 ? (
            <div className="space-y-4">
              {reservations.map((res) => {
                const listing = res.listing;
                if (!listing) return null;

                const primaryImage = getPrimaryImage(listing.listing_images);
                const relatedOrder = orders?.find((o) => o.reservation_id === res.id);

                return (
                  <div
                    key={res.id}
                    className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:bg-[#1e293b] dark:border-slate-800 flex flex-col sm:flex-row"
                  >
                    {/* İlan Kapak Resmi */}
                    <div className="relative h-44 w-full sm:w-44 shrink-0">
                      <Image
                        src={primaryImage}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>

                    {/* Detaylar */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {listing.type === "rent" ? "Kiralık" : "Satılık"}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              res.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : res.status === "cancelled"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                            }`}
                          >
                            {res.status === "approved"
                              ? "Onaylandı"
                              : res.status === "cancelled"
                                ? "İptal Edildi"
                                : "Beklemede"}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1 mb-1">
                          {listing.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          {getListingLocation(listing)}
                        </p>

                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                          <div>
                            <span className="text-slate-400 block">Giriş Tarihi</span>
                            <span className="font-medium">
                              {new Date(res.move_in_date).toLocaleDateString("tr-TR")}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Kiralama Süresi</span>
                            <span className="font-medium">{res.stay_months} Ay</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                        <div>
                          <span className="text-slate-400 text-xs block">Toplam Tutar</span>
                          <span className="text-base font-bold text-[#2F73F2]">
                            {formatListingPrice(listing)}
                          </span>
                        </div>

                        {relatedOrder && relatedOrder.status === "pending" && (
                          <Link
                            href={`/checkout?listingId=${encodeURIComponent(listing.id)}`}
                            className="rounded-lg bg-[#2F73F2] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 flex items-center gap-1.5"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Ödemeyi Tamamla
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 text-center bg-white dark:bg-[#1e293b]">
              <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Henüz yapılmış bir kiralama talebiniz veya rezervasyonunuz bulunmuyor.
              </p>
              <Link
                href="/listings"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F73F2] px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-600"
              >
                <Home className="h-4 w-4" />
                İlanları Keşfet
              </Link>
            </div>
          )}
        </div>

        {/* Sağ Kolon: Mesajlarım / Sohbetlerim */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#2F73F2]" />
              İlan Görüşmelerim
            </h2>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {conversations?.length || 0} Sohbet
            </span>
          </div>

          {conversations && conversations.length > 0 ? (
            <div className="space-y-4">
              {conversations.map((conv) => {
                const listing = conv.listing;
                if (!listing) return null;

                const primaryImage = getPrimaryImage(listing.listing_images);

                return (
                  <div
                    key={conv.id}
                    className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-[#1e293b] dark:border-slate-800 flex items-center gap-4"
                  >
                    {/* Ufak İlan Görseli */}
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0">
                      <Image
                        src={primaryImage}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">
                        {listing.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5 truncate">
                        {getListingLocation(listing)}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          conv.status === "ready"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                        }`}
                      >
                        {conv.status === "ready" ? "Sohbet Aktif" : "Hazırlanıyor"}
                      </span>
                    </div>

                    <Link
                      href={`/listings/${listing.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-[#2F73F2]/10 hover:text-[#2F73F2] dark:bg-slate-800 dark:text-slate-500"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 text-center bg-white dark:bg-[#1e293b]">
              <MessageSquare className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Herhangi bir ilan için henüz bir görüşme başlatmadınız. İlan detay sayfasındaki mesaj formundan danışmanlarımıza yazabilirsiniz.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
