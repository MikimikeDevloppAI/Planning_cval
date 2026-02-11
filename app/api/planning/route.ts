import { NextRequest, NextResponse } from "next/server";
import { fetchPlanningData } from "@/lib/queries/planning";

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");

  if (!weekStart) {
    return NextResponse.json(
      { error: "weekStart parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const data = await fetchPlanningData(weekStart);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Planning API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
