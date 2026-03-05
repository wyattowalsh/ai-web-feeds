import { NextResponse } from "next/server";
import { getValidationStats } from "@/lib/validation-stats";

export const dynamic = "force-dynamic"; // Always run fresh

/**
 * Validation stats API endpoint
 * Returns overall validation health metrics
 */
export async function GET() {
  try {
    const stats = await getValidationStats();

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error fetching validation stats:", error);
    return NextResponse.json({ error: "Failed to fetch validation stats" }, { status: 500 });
  }
}
