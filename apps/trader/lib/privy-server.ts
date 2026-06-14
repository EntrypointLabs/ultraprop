import "server-only";

import { PrivyClient } from "@privy-io/node";
import { createRemoteJWKSet, jwtVerify } from "jose";

const PRIVY_ISSUER = "privy.io";

function appId(): string {
  const id = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim();
  if (!id) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set.");
  return id;
}

function appSecret(): string {
  const secret = (process.env.PRIVY_APP_SECRET ?? "").trim();
  if (!secret) throw new Error("PRIVY_APP_SECRET is not set.");
  return secret;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(id: string) {
  jwks ??= createRemoteJWKSet(
    new URL(`https://auth.privy.io/api/v1/apps/${id}/jwks.json`),
  );
  return jwks;
}

let privy: PrivyClient | null = null;
function getPrivy(): PrivyClient {
  privy ??= new PrivyClient({ appId: appId(), appSecret: appSecret() });
  return privy;
}

/** Privy's linked-account union doesn't type the Sui (curve-signing) wallet, so
 * read it loosely the same way the client does. */
type LooseLinkedAccount = {
  type?: string;
  chain_type?: string;
  address?: string;
};

export class PrivyAuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PrivyAuthError";
    this.status = status;
  }
}

export interface AuthenticatedTrader {
  userId: string;
  /** Lowercased Sui addresses of the user's embedded wallets. */
  suiAddresses: string[];
}

/**
 * Authenticates a request bearing a Privy access token. The token is verified
 * against Privy's JWKS (proving the caller is the signed-in user), then the
 * user's embedded Sui wallet addresses are resolved from Privy so the caller
 * can only ever act on a wallet they actually own.
 */
export async function authenticatePrivyRequest(
  req: Request,
): Promise<AuthenticatedTrader> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new PrivyAuthError("Missing authentication token.", 401);

  const id = appId();
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, getJwks(id), {
      issuer: PRIVY_ISSUER,
      audience: id,
    });
    if (!payload.sub) throw new Error("token has no subject");
    userId = payload.sub;
  } catch {
    throw new PrivyAuthError("Your session is invalid or has expired.", 401);
  }

  let user: { linked_accounts?: unknown };
  try {
    user = await getPrivy().users()._get(userId);
  } catch {
    throw new PrivyAuthError("Could not load your account.", 502);
  }

  const accounts = (user.linked_accounts ?? []) as LooseLinkedAccount[];
  const suiAddresses = accounts
    .filter((a) => a.type === "wallet" && a.chain_type === "sui" && a.address)
    .map((a) => (a.address as string).toLowerCase());

  return { userId, suiAddresses };
}
