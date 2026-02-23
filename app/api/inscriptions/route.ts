import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  try {
    const res = await fetch(
      "https://dashboard.claws.tech/api/inscriptions?limit=6",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("upstream");
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ inscriptions: [] });
  }
}
