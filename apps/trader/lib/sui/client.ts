import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { publicSuiConfig } from "./config";

let cached: SuiClient | null = null;

/**
 * A shared read-only Sui client pointed at the configured network. Used on both
 * the client (to read a trader's account) and the server (to read tier pricing
 * and submit onboarding transactions).
 */
export function getSuiClient(): SuiClient {
  if (cached) return cached;
  const { network, rpcUrl } = publicSuiConfig();
  cached = new SuiClient({ url: rpcUrl ?? getFullnodeUrl(network) });
  return cached;
}
