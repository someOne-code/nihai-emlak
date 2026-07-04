import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <div className="pt-24 min-h-screen bg-[#F8FAFC] dark:bg-[#080d16]">
        {children}
      </div>
      <PublicFooter />
    </>
  );
}
