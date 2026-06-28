import { NextResponse } from "next/server";

import { getApifySettingsPublic, saveApifyToken } from "@/services/apify-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getApifySettingsPublic();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Apify settings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Apify API token is required." }, { status: 400 });
    }

    const settings = await saveApifyToken(token);
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save Apify token." },
      { status: 400 },
    );
  }
}
