import { type NextRequest, NextResponse } from "next/server";
import { isUsernameClaimingEnabled } from "@/lib/sui/config";
import {
  fullUsername,
  isUsernameAvailable,
  normalizeLabel,
  SuiNsError,
} from "@/lib/sui/suins";

export const runtime = "nodejs";

/**
 * Public availability check for a username label. Returns whether
 * `label.<parent>` is free to claim, plus the full name to show the user. An
 * invalid label comes back as `available: false` with the reason, so the UI has
 * one shape to render for every "you can't claim this" case.
 */
export async function GET(req: NextRequest) {
  if (!isUsernameClaimingEnabled()) {
    return NextResponse.json(
      { error: "Username claiming isn't available yet." },
      { status: 503 },
    );
  }

  const rawLabel = (req.nextUrl.searchParams.get("label") ?? "").trim();

  let label: string;
  try {
    label = normalizeLabel(rawLabel);
  } catch (error) {
    return NextResponse.json({
      available: false,
      reason: error instanceof SuiNsError ? error.message : "Invalid username.",
    });
  }

  try {
    const available = await isUsernameAvailable(label);
    return NextResponse.json({
      available,
      name: fullUsername(label),
      reason: available ? null : "That username is taken.",
    });
  } catch (error) {
    console.error("[username] availability", error);
    return NextResponse.json(
      { error: "We couldn't check that username. Try again." },
      { status: 502 },
    );
  }
}
