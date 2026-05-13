import Image from "next/image";

export function ListingEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-lg bg-white px-6 py-16 text-center shadow-property dark:bg-[#1F2A37]">
      <Image
        src="/property-nextjs-pro/images/not-found/no-results.png"
        alt=""
        width={100}
        height={100}
        className="h-[100px] w-[100px]"
      />
      <p className="text-[#668199]">Bu kriterlere uygun ilan bulunamadı.</p>
    </div>
  );
}
