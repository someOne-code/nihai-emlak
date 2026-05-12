import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatListingPrice } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function SaleLeadPreviewBox({
  listing,
}: {
  isAuthenticated: boolean;
  listing: ApiListingDetail;
}) {
  return (
    <div className="rounded-xl bg-white p-8 shadow-property dark:bg-[#1F2A37] dark:shadow-none">
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-sm text-[#668199] dark:text-[#94a3b8] mb-1">Satış Fiyatı</div>
          <div className="text-3xl font-bold text-[#2F73F2]">{formatListingPrice(listing)}</div>
        </div>

        <div className="rounded-md bg-[#F0F6FA] p-4 text-center dark:bg-[#0e1624]">
          <div className="text-xs text-[#668199] dark:text-[#94a3b8] uppercase tracking-wider mb-1">İlan Modu</div>
          <div className="font-medium text-[#102D47] dark:text-white">Talep Bırakın</div>
        </div>

        <p className="text-sm leading-6 text-[#668199] dark:text-[#94a3b8] text-center px-2">
          Bu ilan hakkında bilgi almak için iletişim talebi oluşturabilirsiniz.
        </p>

        {/* 
          // The sale lead form is out of scope for this task,
          // so we use a placeholder #sale-lead-preview fragment.
        */}
        <div id="sale-lead-preview" className="hidden"></div>

        <Button asChild className="w-full bg-[#2F73F2] hover:bg-blue-600 text-white">
          <Link href="#sale-lead-preview">İletişim Talebi Gönder</Link>
        </Button>
        <Button asChild variant="outline" className="w-full border-[#2F73F2] text-[#2F73F2] hover:bg-[#2F73F2] hover:text-white transition-colors">
          <Link href="#listing-contact">İletişime Geçin</Link>
        </Button>
      </div>
    </div>
  );
}
