import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { fetchCandles, type MarkTick, type VenueId } from "@shared/venues";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getFeed } from "./feed.js";
import { getCatalog } from "./indexer.js";

/**
 * The thin edge in front of the venue layer. The browser hits THIS service, never
 * `api.hyperliquid.xyz` — keys / rate-limits / CORS stay server-side, and Bybit
 * becomes a future drop-in with no FE change. Every venue call is wrapped so a
 * failure surfaces as a logged 500, never a silently swallowed error.
 */

const PORT = Number(process.env.PORT) || 8787;
const DEFAULT_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;
/** Keep the SSE line warm during quiet mark periods so the client's silence
 * timer never trips on a healthy connection (and recovers promptly on reconnect). */
const FEED_HEARTBEAT_MS = 5_000;

/** Resolve the short query alias ("hl") to a full VenueId. */
function resolveVenue(raw: string | undefined): VenueId {
  if (raw === "hl" || raw === "hyperliquid" || raw == null)
    return "hyperliquid";
  if (raw === "bybit") return "bybit";
  return "hyperliquid";
}

const app = new Hono();

app.get("/api/catalog", async (c) => {
  const venue = resolveVenue(c.req.query("venue"));
  try {
    const markets = await getCatalog(venue);
    return c.json(markets);
  } catch (error) {
    console.error("[api/catalog] catalog fetch failed", error);
    return c.json({ error: "catalog fetch failed" }, 500);
  }
});

app.get("/api/feed", (c) => {
  const venue = resolveVenue(c.req.query("venue"));
  // Defeat proxy/CDN buffering so each batch reaches the browser as it is written.
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    const feed = getFeed(venue);
    let aborted = false;
    const queue: MarkTick[][] = [];
    let notify: (() => void) | null = null;

    const unsubscribe = feed.subscribe((ticks) => {
      queue.push(ticks);
      notify?.();
    });

    stream.onAbort(() => {
      aborted = true;
      unsubscribe();
      notify?.();
    });

    try {
      // Immediate hello so the client flips to "live" before the first batch.
      await stream.writeSSE({ event: "ping", data: "hello" });
      while (!aborted) {
        const batch = queue.shift();
        if (batch) {
          await stream.writeSSE({
            data: JSON.stringify(batch),
            event: "marks",
          });
          continue;
        }
        // Wait for the next batch OR a heartbeat tick, whichever comes first.
        let timer: ReturnType<typeof setTimeout> | null = null;
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            notify = null;
            if (timer) clearTimeout(timer);
            resolve();
          };
          notify = done;
          timer = setTimeout(done, FEED_HEARTBEAT_MS);
        });
        // No batch arrived within the window: keep the line warm so the client's
        // silence timer stays disarmed on a healthy-but-quiet connection.
        if (!aborted && queue.length === 0) {
          await stream.writeSSE({ event: "ping", data: "keepalive" });
        }
      }
    } catch (error) {
      console.error("[api/feed] stream error", error);
      unsubscribe();
    }
  });
});

app.get("/api/candles", async (c) => {
  const rawCoin = c.req.query("coin");
  if (!rawCoin) return c.json({ error: "missing coin" }, 400);
  const coin = rawCoin.includes(":")
    ? (rawCoin.split(":")[1] ?? rawCoin)
    : rawCoin;
  const interval = c.req.query("interval") ?? "1h";
  const now = Date.now();
  const end = Number(c.req.query("end")) || now;
  const start = Number(c.req.query("start")) || now - DEFAULT_HISTORY_MS;
  try {
    const candles = await fetchCandles(coin, interval, start, end);
    return c.json(candles);
  } catch (error) {
    console.error("[api/candles] candle fetch failed", error);
    return c.json({ error: "candle fetch failed" }, 500);
  }
});

/**
 * Minimal Node `http` ↔ Web `Request`/`Response` bridge so the Hono app listens
 * on a real port without the extra `@hono/node-server` dependency. Streaming
 * responses (SSE) are piped chunk-by-chunk; the abort signal fires when the
 * client disconnects so the feed subscription tears down.
 */
async function handle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = `http://${req.headers.host ?? `localhost:${PORT}`}${req.url ?? "/"}`;
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const response = await app.fetch(
    new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
      signal: controller.signal,
    }),
  );

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    // client disconnected mid-stream
  } finally {
    res.end();
  }
}

createServer((req, res) => {
  void handle(req, res).catch((error) => {
    console.error("[api-gateway] request failed", error);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
}).listen(PORT, () => {
  console.log(`[api-gateway] listening on http://localhost:${PORT}`);
});

export default app;
