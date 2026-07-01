import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { type PublicSuiConfig, publicSuiConfig } from "./config";

type Network = PublicSuiConfig["network"];

/**
 * Default Mysten-hosted GraphQL RPC per network — the read path for both client
 * and server. (The older `sui-<network>.mystenlabs.com/graphql` alpha hosts are
 * decommissioned.) An operator can point at their own indexer / a provider via
 * `NEXT_PUBLIC_SUI_GRAPHQL_URL`.
 */
function defaultGraphqlUrl(network: Network): string {
  return `https://graphql.${network}.sui.io/graphql`;
}

/**
 * Default fullnode gRPC (gRPC-web) endpoint per network — the server-side
 * execution path. Overridable via `NEXT_PUBLIC_SUI_GRPC_URL`.
 */
function defaultGrpcUrl(network: Network): string {
  return `https://fullnode.${network}.sui.io:443`;
}

let cachedGraphql: SuiGraphQLClient | null = null;
let cachedGrpc: SuiGrpcClient | null = null;
let cachedJsonRpc: SuiJsonRpcClient | null = null;

/**
 * A shared GraphQL client pointed at the configured network. Works in both the
 * browser and node, and is the read path for everything — owned-cap lookups,
 * tier pricing, account tier, USDC coin reads, and payment-digest verification.
 */
export function getGraphQLClient(): SuiGraphQLClient {
  if (cachedGraphql) return cachedGraphql;
  const { network, graphqlUrl } = publicSuiConfig();
  cachedGraphql = new SuiGraphQLClient({
    network,
    url: graphqlUrl ?? defaultGraphqlUrl(network),
  });
  return cachedGraphql;
}

/**
 * A shared gRPC client for server-side transaction execution: the admin-signed
 * `open_account` / lifecycle calls and the user-signed Privy execute. Reads
 * should go through the GraphQL client instead.
 */
export function getGrpcClient(): SuiGrpcClient {
  if (cachedGrpc) return cachedGrpc;
  const { network, grpcUrl } = publicSuiConfig();
  cachedGrpc = new SuiGrpcClient({
    network,
    baseUrl: grpcUrl ?? defaultGrpcUrl(network),
  });
  return cachedGrpc;
}

/**
 * A shared JSON-RPC client, used solely for `queryEvents` — the one read the
 * GraphQL/gRPC clients don't expose. Reconstructing a trader's realized history
 * means paging the `TradeSettled` event log by type, which `suix_queryEvents`
 * does natively. Everything else stays on the GraphQL read path.
 */
export function getJsonRpcClient(): SuiJsonRpcClient {
  if (cachedJsonRpc) return cachedJsonRpc;
  const { network, rpcUrl } = publicSuiConfig();
  cachedJsonRpc = new SuiJsonRpcClient({
    network,
    url: rpcUrl ?? getJsonRpcFullnodeUrl(network),
  });
  return cachedJsonRpc;
}
