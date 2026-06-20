import { serve } from "@hono/node-server";
import { createDb } from "@shared/db";
import { Hono } from "hono";
import { type OnChainWriter, StubOnChainWriter } from "./onchain.js";
import { SettlementEngine } from "./settlement.js";
import { loadExecutorSuiConfig, SuiOnChainWriter } from "./sui-writer.js";

/**
 * The always-on executor process. It is intentionally NOT the public feed
 * gateway: it holds the firm's executor key and owns the position ledger, so it
 * runs as its own isolated service. Boot order: connect Neon → start the
 * settlement loop (its own mark-feed subscription) → expose a health endpoint.
 *
 * On-chain writes currently go through `StubOnChainWriter`; swapping in the real
 * Sui signer (a shared `@shared/sui-propfirm` extraction of the app's existing
 * `server.ts`) is the next brick and changes nothing else here.
 */

const PORT = Number(process.env.PORT) || 8788;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[executor] missing required env ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const { db, close } = createDb(requireEnv("DATABASE_URL"));
  const suiConfig = loadExecutorSuiConfig();
  const writer: OnChainWriter = suiConfig
    ? new SuiOnChainWriter(suiConfig)
    : new StubOnChainWriter();
  console.log(
    `[executor] on-chain writer: ${suiConfig ? "live (firm executor key)" : "STUB (no writes)"}`,
  );
  const settlement = new SettlementEngine(db, writer);
  await settlement.start();

  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true, service: "executor" }));

  const server = serve({ fetch: app.fetch, port: PORT });
  console.log(`[executor] listening on :${PORT}`);

  const shutdown = () => {
    console.log("[executor] shutting down");
    settlement.stop();
    server.close();
    void close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
