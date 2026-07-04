"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { ApiListingDetail } from "@/types/listing";
import { Button } from "@/components/ui/button";
import { getListingDetailImages } from "@/lib/mappers/listing.mapper";

export type MainItemOption = {
  id: string;
  override_label: string | null;
  override_amount: string | null;
  override_multiplier: string | null;
  main_item_catalog: {
    id: string;
    code: string;
    label: string;
    description: string | null;
    pricing_strategy: string;
    default_amount: string | null;
    default_multiplier: string | null;
  };
};

export type ServiceItemOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
};

type CheckoutFormProps = {
  listing: ApiListingDetail;
  mainItems: MainItemOption[];
  services: ServiceItemOption[];
  isbankCheckoutUrl: string;
};

type QuoteItem = {
  code: string;
  label: string;
  amount: number;
};

type QuoteData = {
  total_amount: number;
  currency: string;
  items: QuoteItem[];
};

export function CheckoutForm({
  listing,
  mainItems,
  services,
  isbankCheckoutUrl,
}: CheckoutFormProps) {
  const [moveInDate, setMoveInDate] = useState("");
  const [stayMonths, setStayMonths] = useState(1);
  const [guestCount, setGuestCount] = useState(1);
  const [selectedMainItems, setSelectedMainItems] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const note = "Lütfen kiralama işlemini başlatın.";

  // Contact Info
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredMethod, setPreferredMethod] = useState<"phone" | "whatsapp" | "email">("whatsapp");
  const [preferredTime, setPreferredTime] = useState("");
  const [occupantName, setOccupantName] = useState("");
  const [documentReadiness, setDocumentReadiness] = useState<"ready" | "needs_help" | "later">("ready");
  const [contactNote, setContactNote] = useState("");

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected main items with all available main items
  useEffect(() => {
    if (mainItems.length > 0) {
      setSelectedMainItems(mainItems.map((item) => item.main_item_catalog.code));
    }
  }, [mainItems]);

  // Set default move-in date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setMoveInDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  // Calculate quote dynamically on changes
  useEffect(() => {
    if (!moveInDate || selectedMainItems.length === 0) {
      setQuote(null);
      return;
    }

    const calculateQuote = async () => {
      setIsCalculating(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("calculate_checkout_quote", {
          p_listing_id: listing.id,
          p_main_item_codes: selectedMainItems,
          p_service_item_codes: selectedServices,
          p_stay_months: stayMonths,
        });

        if (error) {
          console.error("Quote calculation error:", error);
          setQuote(null);
        } else {
          setQuote(data as QuoteData);
        }
      } catch (err) {
        console.error("Failed to calculate quote:", err);
        setQuote(null);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateQuote();
  }, [listing.id, selectedMainItems, selectedServices, stayMonths, moveInDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Step 1: Create checkout reservation
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listing_id: listing.id,
          move_in_date: moveInDate,
          stay_months: stayMonths,
          guest_count: guestCount,
          main_items: selectedMainItems,
          service_items: selectedServices,
          note: note,
          contact: {
            full_name: fullName,
            phone: phone,
            email: email || null,
            preferred_contact_method: preferredMethod,
            preferred_contact_time: preferredTime || null,
            occupant_full_name: occupantName || null,
            document_readiness: documentReadiness,
            note: contactNote || null,
          },
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.success) {
        throw new Error(checkoutData.error || "Kiralama oluşturulurken bir hata oluştu.");
      }

      const orderId = checkoutData.data.order.id;

      // Step 2: Initialize payment
      const initRes = await fetch("/api/checkout/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: orderId,
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error || "Ödeme başlatılırken bir hata oluştu.");
      }

      // Step 3: Redirect to Is Bankasi gateway using hidden form post
      const isbankFields = initData.data.isbank;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = isbankCheckoutUrl;

      Object.entries(isbankFields).forEach(([key, val]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(val);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bir şeyler ters gitti. Lütfen bilgilerinizi kontrol edip tekrar deneyin.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  const handleMainItemToggle = (code: string) => {
    setSelectedMainItems((prev) =>
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code]
    );
  };

  const handleServiceToggle = (code: string) => {
    setSelectedServices((prev) =>
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code]
    );
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency || "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_400px]">
      {/* Sol Kolon - Form Alanları */}
      <div className="flex flex-col gap-8 rounded-2xl bg-white dark:bg-[#1a2432] p-6 md:p-8 shadow-property">
        <div>
          <h2 className="text-2xl font-bold text-[#102D47] dark:text-white mb-2">Kiralama Bilgileri</h2>
          <p className="text-sm text-property-gray">Taşınma tarihini ve kiralama detaylarını seçin.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
              Taşınma Tarihi
            </label>
            <input
              type="date"
              required
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
              Kalış Süresi (Ay)
            </label>
            <select
              value={stayMonths}
              onChange={(e) => setStayMonths(Number(e.target.value))}
              className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} Ay
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
              Misafir Sayısı
            </label>
            <input
              type="number"
              min={1}
              required
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
              className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
            />
          </div>
        </div>

        {/* Ana Ödeme Kalemleri */}
        {mainItems.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-3">
              Ödeme Kalemleri
            </label>
            <div className="flex flex-col gap-3">
              {mainItems.map((item) => {
                const code = item.main_item_catalog.code;
                const isSelected = selectedMainItems.includes(code);
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#2F73F2] bg-blue-50/20 dark:bg-blue-950/10"
                        : "border-[#D8E4EF] dark:border-[#243447] hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded text-[#2F73F2] border-slate-300 focus:ring-[#2F73F2]"
                      checked={isSelected}
                      onChange={() => handleMainItemToggle(code)}
                    />
                    <div>
                      <div className="font-semibold text-property-midnight dark:text-white">
                        {item.override_label || item.main_item_catalog.label}
                      </div>
                      {item.main_item_catalog.description && (
                        <div className="text-xs text-property-gray mt-0.5">
                          {item.main_item_catalog.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* İlave Hizmetler */}
        {services.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 mb-3">
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4]">
                İlave Hizmetler (İsteğe Bağlı)
              </label>
              {selectedMainItems.length === 0 && (
                <span className="text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1 rounded border border-rose-100 dark:border-rose-900/30">
                  Ek ödeme eklemek için önce en az bir ana ödeme kalemi seçin.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {services.map((service) => {
                const isSelected = selectedServices.includes(service.code);
                const isDisabled = selectedMainItems.length === 0;
                return (
                  <label
                    key={service.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                      isDisabled
                        ? "border-[#E5EDF5] dark:border-[#1E2D3D] opacity-50 cursor-not-allowed bg-slate-50/50"
                        : isSelected
                        ? "border-[#2F73F2] bg-blue-50/20 dark:bg-blue-950/10 cursor-pointer"
                        : "border-[#D8E4EF] dark:border-[#243447] hover:bg-slate-50/50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isDisabled}
                      className="mt-1 h-4 w-4 rounded text-[#2F73F2] border-slate-300 focus:ring-[#2F73F2] disabled:opacity-50"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(service.code)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between font-semibold text-property-midnight dark:text-white">
                        <span>{service.name}</span>
                        <span className="text-[#2F73F2]">
                          +{formatPrice(service.price, service.currency)}
                        </span>
                      </div>
                      {service.description && (
                        <div className="text-xs text-property-gray mt-0.5">
                          {service.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* İletişim Bilgileri (Intake Form) */}
        <div className="border-t border-[#E5EDF5] dark:border-[#1E2D3D] pt-8">
          <h3 className="text-xl font-bold text-[#102D47] dark:text-white mb-2">İletişim & Evrak Bilgileri</h3>
          <p className="text-sm text-property-gray mb-6">Ofisimizin kontrat hazırlığı yapabilmesi için bilgilerinizi eksiksiz doldurun.</p>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
                Ad Soyad
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Örn. Ali Yılmaz"
                className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
                Telefon Numarası
              </label>
              <input
                type="tel"
                required
                minLength={7}
                maxLength={32}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Örn. +905321234567"
                className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
                E-posta Adresi (İsteğe Bağlı)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Örn. ali.yilmaz@example.com"
                className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
                Tercih Edilen İletişim Kanalı
              </label>
              <select
                value={preferredMethod}
                onChange={(e) => setPreferredMethod(e.target.value as "whatsapp" | "phone" | "email")}
                className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Telefon Araması</option>
                <option value="email">E-posta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
                Tercih Edilen Görüşme Saati
              </label>
              <input
                type="text"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                placeholder="Örn. Hafta içi 18:00 sonrası"
                className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
                Evrak Hazırlık Durumu
              </label>
              <select
                value={documentReadiness}
                onChange={(e) => setDocumentReadiness(e.target.value as "ready" | "needs_help" | "later")}
                className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
              >
                <option value="ready">Evraklarım Tamam / Hazır</option>
                <option value="needs_help">Destek / Danışmanlık İstiyorum</option>
                <option value="later">Daha Sonra Hazırlayacağım</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
              Kiralayacak Diğer Kişilerin Ad Soyadı (Varsa)
            </label>
            <input
              type="text"
              value={occupantName}
              onChange={(e) => setOccupantName(e.target.value)}
              placeholder="Örn. Ayşe Yılmaz"
              className="w-full h-11 px-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2]"
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-semibold text-property-midnight dark:text-[#aab7c4] mb-2">
              Ofis Notu
            </label>
            <textarea
              rows={3}
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="Kiralama ofisimize iletmek istediğiniz ekstra bir bilgi var mı?"
              className="w-full p-4 rounded-lg border border-[#D8E4EF] dark:border-[#243447] bg-white dark:bg-[#0f172a] text-[#102D47] dark:text-white focus:outline-none focus:border-[#2F73F2] resize-none"
            />
          </div>
        </div>
      </div>

      {/* Sağ Kolon - İlan Özet Kartı */}
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl bg-white dark:bg-[#1a2432] p-6 shadow-property sticky top-28">
          <div className="flex flex-col gap-6">
            <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100">
              {(() => {
                const detailImages = getListingDetailImages(listing);
                const primaryImg = detailImages.find((img) => img.isPrimary) || detailImages[0];
                const coverImageUrl = primaryImg ? primaryImg.src : null;

                return coverImageUrl ? (
                  <Image
                    src={coverImageUrl}
                    alt={listing.title}
                    fill
                    sizes="350px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#2F73F2]">
                    Görsel Yok
                  </div>
                );
              })()}
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#102D47] dark:text-white leading-snug">
                {listing.title}
              </h3>
              <p className="text-xs text-property-gray mt-1">
                {listing.district ? `${listing.district}, ` : ""}{listing.city}
              </p>
            </div>

            {/* Fiyat Listesi */}
            <div className="border-t border-[#E5EDF5] dark:border-[#1E2D3D] pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-property-gray mb-3">
                ÜYT / Fatura Detayları
              </div>
              
              {isCalculating ? (
                <div className="py-4 text-center text-sm text-[#2F73F2]">
                  Hesaplanıyor...
                </div>
              ) : quote ? (
                <div className="flex flex-col gap-2">
                  {quote.items.map((qItem, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-[#668199] dark:text-[#aab7c4]">{qItem.label}</span>
                      <span className="font-medium text-property-midnight dark:text-white">
                        {formatPrice(qItem.amount, quote.currency)}
                      </span>
                    </div>
                  ))}
                  
                  <div className="border-t border-[#E5EDF5] dark:border-[#1E2D3D] mt-3 pt-3 flex justify-between items-baseline">
                    <span className="font-semibold text-[#102D47] dark:text-white">Toplam Ödeme</span>
                    <span className="text-2xl font-bold text-[#2F73F2]">
                      {formatPrice(quote.total_amount, quote.currency)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-property-gray">
                  Tarih ve kalem seçin
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !quote || selectedMainItems.length === 0}
              className="w-full h-12 bg-emerald-600 text-white font-semibold hover:bg-emerald-500 rounded-lg shadow-sm"
            >
              {isSubmitting ? "Yönlendiriliyor..." : "Ödemeyi Başlat"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
