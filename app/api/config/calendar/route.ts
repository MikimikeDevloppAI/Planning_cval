import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const year = request.nextUrl.searchParams.get("year") ?? new Date().getFullYear().toString();

  const { data, error } = await supabase
    .from("calendar")
    .select("*")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .eq("is_holiday", true)
    .order("date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();
  const { date, is_holiday, holiday_name } = body;

  const { data, error } = await supabase
    .from("calendar")
    .update({ is_holiday, holiday_name: holiday_name || null })
    .eq("date", date)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
