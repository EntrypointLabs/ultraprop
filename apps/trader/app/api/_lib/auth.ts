import { NextResponse } from "next/server";
import {
  type AuthenticatedTrader,
  authenticatePrivyRequest,
  PrivyAuthError,
} from "@/lib/privy-server";

type AuthOutcome =
  | { trader: AuthenticatedTrader; response?: undefined }
  | { trader?: undefined; response: NextResponse };

/**
 * Authenticates a Privy-bearing request for the executor-gated API routes,
 * returning either the verified trader or a ready-to-return error response. The
 * on-chain call itself is firm-gated by the executor cap held server-side, so
 * the route's job is only to confirm a real signed-in session is making it.
 */
export async function requireTrader(req: Request): Promise<AuthOutcome> {
  try {
    return { trader: await authenticatePrivyRequest(req) };
  } catch (error) {
    if (error instanceof PrivyAuthError) {
      return {
        response: NextResponse.json(
          { error: error.message },
          { status: error.status },
        ),
      };
    }
    return {
      response: NextResponse.json(
        { error: "Could not verify your session." },
        { status: 401 },
      ),
    };
  }
}

/** Reads and parses a JSON body, tolerating an empty/invalid one as `{}`. */
export async function readJson<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

/** A Sui object id used as an on-chain account id: `0x` + up to 64 hex digits. */
export function isAccountId(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(value.trim());
}

/** Maps a server error to a JSON 500, never leaking a non-Error to the client. */
export function serverError(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}
