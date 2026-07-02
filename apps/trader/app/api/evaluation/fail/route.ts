import { NextResponse } from "next/server";
import {
  isAccountId,
  readJson,
  requireTrader,
  serverError,
} from "@/app/api/_lib/auth";
import { failEvaluation } from "@/lib/sui/server";

export const runtime = "nodejs";

/** Marks the authenticated trader's evaluation failed on-chain. */
export async function POST(req: Request) {
  const auth = await requireTrader(req);
  if (auth.response) return auth.response;

  const { accountId } = await readJson<{ accountId: string }>(req);
  if (!isAccountId(accountId)) {
    return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  }

  try {
    return NextResponse.json(await failEvaluation(accountId));
  } catch (error) {
    return serverError(error, "We couldn't record the evaluation result.");
  }
}
