import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SuiNetwork } from "./config.js";

/**
 * Default Mysten-hosted GraphQL RPC per network — the read path. (The older
 * `sui-<network>.mystenlabs.com/graphql` alpha hosts are decommissioned.)
 */
export function defaultGraphqlUrl(network: SuiNetwork): string {
  return `https://graphql.${network}.sui.io/graphql`;
}

/** Default fullnode gRPC (gRPC-web) endpoint per network — the execution path. */
export function defaultGrpcUrl(network: SuiNetwork): string {
  return `https://fullnode.${network}.sui.io:443`;
}

/** A GraphQL read client for the given network, optionally pointed at a custom url. */
export function createGraphQLClient(
  network: SuiNetwork,
  url?: string | null,
): SuiGraphQLClient {
  return new SuiGraphQLClient({ network, url: url ?? defaultGraphqlUrl(network) });
}

/** A gRPC client for server-side transaction execution. */
export function createGrpcClient(
  network: SuiNetwork,
  baseUrl?: string | null,
): SuiGrpcClient {
  return new SuiGrpcClient({ network, baseUrl: baseUrl ?? defaultGrpcUrl(network) });
}
