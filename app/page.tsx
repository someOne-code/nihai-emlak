import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default async function Index() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8 items-center justify-center min-h-screen p-8">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <h1 className="text-3xl font-bold">Nihai Emlak - Backend Workspace</h1>
      <p className="text-lg text-muted-foreground text-center max-w-xl">
        Bu ortam sadece operasyonel API, veritabanı (Supabase) ve içerik yönetim (Payload) katmanları içindir. 
        Müşteriye dönük Frontend UI tarafı başka bir repo ve ekip tarafından yönetilmektedir.
      </p>
      <div className="flex gap-4 mt-6">
        <Link href="/auth/login" className="px-5 py-2.5 bg-foreground text-background font-medium rounded-md hover:bg-foreground/90 transition">
          Supabase Auth Test
        </Link>
        <Link href="/admin" className="px-5 py-2.5 border rounded-md font-medium hover:bg-muted transition">
          Payload CMS Admin
        </Link>
      </div>
    </div>
  );
}
