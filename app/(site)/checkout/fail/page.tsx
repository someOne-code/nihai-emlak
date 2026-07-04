import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";

export const metadata: Metadata = {
  title: "Ödeme Başarısız | Umut Emlak",
  description: "Kiralama talebiniz veya ödemeniz gerçekleştirilemedi.",
};

export default function CheckoutFailPage() {
  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-property-light dark:bg-property-dark pb-20 pt-40">
        <div className="container mx-auto max-w-screen-md px-4 text-center">
          <div className="flex flex-col items-center justify-center gap-6 rounded-2xl bg-white dark:bg-[#1a2432] p-8 md:p-16 shadow-property">
            <AlertCircle className="h-20 w-20 text-rose-500" />
            <h1 className="text-3xl font-bold text-property-midnight dark:text-white md:text-4xl">
              Ödeme Başarısız
            </h1>
            <p className="text-lg leading-relaxed text-property-gray max-w-lg">
              İşlem sırasında bir hata oluştu veya ödemeniz banka tarafından reddedildi. Lütfen kart bilgilerinizi kontrol edip tekrar deneyin ya da destek ekibimizle iletişime geçin.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-4 w-full justify-center">
              <Link
                href="/listings"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-[#2F73F2] px-8 text-sm font-semibold text-white transition hover:bg-blue-600 shadow-sm"
              >
                Tekrar Deneyin
              </Link>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
