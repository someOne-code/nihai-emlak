import { SaleLeadForm } from "@/components/sale/sale-lead-form";
import { formatListingPrice } from "@/lib/mappers/listing.mapper";
import type { ApiListingDetail } from "@/types/listing";

export function SaleLeadPreviewBox({ listing }: { listing: ApiListingDetail }) {
  return (
    <div className="rounded-xl bg-white p-8 shadow-property dark:bg-[#1F2A37] dark:shadow-none">
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-1 text-sm text-[#668199] dark:text-[#94a3b8]">Satış Fiyatı</div>
          <div className="text-3xl font-bold text-[#2F73F2]">{formatListingPrice(listing)}</div>
        </div>

        <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-5 text-center">
          <div className="mb-1 text-xs uppercase tracking-wider text-primary/80">Süreç</div>
          <div className="font-medium text-primary">Satış Bilgi Talebi</div>
        </div>

        <p className="px-2 text-center text-sm leading-6 text-[#668199] dark:text-[#94a3b8]">
          Bu ilan hakkında bilgi almak için iletişim bilgilerinizi bırakın.
        </p>

        <div data-aos="fade-up" data-aos-delay="100">
          <SaleLeadForm listing={listing} />
        </div>
      </div>
    </div>
  );
}
