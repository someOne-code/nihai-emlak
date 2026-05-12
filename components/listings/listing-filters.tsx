import { Button } from "@/components/ui/button";
import type { ListingType } from "@/types/listing";

export function ListingFilters({
  city,
  type,
}: {
  city: string;
  type: ListingType | null;
}) {
  return (
    <form className="rounded-lg bg-white px-8 py-14 shadow-property dark:bg-[#0e1624]">
      <p className="mb-6 text-2xl font-semibold text-[#102D47] dark:text-white">Advanced Search</p>
      <div className="flex flex-col gap-6">
        <input
          name="city"
          defaultValue={city}
          placeholder="Şehir"
          className="w-full rounded-lg border border-[#6bc5f94d] bg-white px-3 py-3 text-[#102D47] outline-none focus:border-[#2F73F2] dark:border-[#224767] dark:bg-[#0e1624] dark:text-white"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="w-full rounded-lg border border-[#6bc5f94d] bg-white px-3 py-3 text-[#102D47] outline-none focus:border-[#2F73F2] dark:border-[#224767] dark:bg-[#0e1624] dark:text-white"
          aria-label="İlan tipi"
        >
          <option value="">Tümü</option>
          <option value="rent">Kiralık</option>
          <option value="sale">Satılık</option>
        </select>
        <Button type="submit" className="w-full rounded-lg bg-[#2F73F2] py-3 text-base text-white hover:bg-blue-700">
          Find Property
        </Button>
      </div>
    </form>
  );
}
