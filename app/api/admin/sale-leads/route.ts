import {
  handleAdminSaleLeadsGet,
  handleAdminSaleLeadsPost,
} from "@/lib/admin/sale-leads-route";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return handleAdminSaleLeadsGet(request, {
    createServerSupabaseClient,
  });
}

export async function POST(request: Request) {
  return handleAdminSaleLeadsPost(request, {
    createServerSupabaseClient,
  });
}
