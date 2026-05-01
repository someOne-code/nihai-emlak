import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

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

  return (
    <div className="flex-1 w-full flex flex-col gap-6 items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold">Backend Protected Route</h1>
      <div className="bg-muted p-6 rounded-md w-full max-w-md border">
        <h2 className="font-semibold mb-2">Authenticated User Info:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
}
