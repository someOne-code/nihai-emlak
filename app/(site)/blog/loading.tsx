import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";

export default function BlogLoading() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative overflow-x-hidden bg-property-hero bg-cover pb-20 pt-36 text-center">
          <div className="container mx-auto max-w-screen-xl px-4 text-center md:max-w-screen-md lg:max-w-screen-xl">
            <div className="mx-auto h-12 w-80 max-w-full animate-pulse rounded-lg bg-[#dbe7f0] dark:bg-white/10" />
            <div className="mx-auto mt-7 h-6 w-[36rem] max-w-full animate-pulse rounded-lg bg-[#dbe7f0] dark:bg-white/10" />
            <div className="mx-auto mt-10 h-6 w-56 animate-pulse rounded-lg bg-[#dbe7f0] dark:bg-white/10" />
          </div>
        </section>
        <section className="bg-property-light py-14 md:py-20">
          <div className="container mx-auto max-w-screen-2xl px-4 md:max-w-screen-md lg:max-w-screen-xl 2xl:max-w-screen-2xl">
            <div className="grid overflow-hidden rounded-lg bg-property-surface shadow-[0_14px_44px_rgba(16,45,71,0.10)] lg:grid-cols-2">
              <div className="min-h-[320px] animate-pulse bg-[#dbe7f0] lg:min-h-[420px]" />
              <div className="space-y-5 p-7 md:p-10 lg:p-12">
                <div className="h-5 w-48 animate-pulse rounded bg-[#dbe7f0]" />
                <div className="h-10 w-full animate-pulse rounded bg-[#dbe7f0]" />
                <div className="h-10 w-3/4 animate-pulse rounded bg-[#dbe7f0]" />
                <div className="h-24 w-full animate-pulse rounded bg-[#dbe7f0]" />
              </div>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-lg bg-property-surface shadow-property" />
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
