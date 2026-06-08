"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { SuiWalletGate } from "@/components/auth/SuiWalletGate";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  );

  const app = (
    <QueryClientProvider client={client}>
      <SuiWalletGate />
      {children}
    </QueryClientProvider>
  );

  if (!PRIVY_APP_ID) {
    // Surfaced loudly in dev; auth actions will no-op until the id is set.
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "NEXT_PUBLIC_PRIVY_APP_ID is not set — auth is disabled. Add it to apps/trader/.env.local.",
      );
    }
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: {
          theme: "dark",
          accentColor: "#e5484d",
          walletChainType: "ethereum-and-solana",
        },
        // Sui wallets are provisioned explicitly via SuiWalletGate
        // (extended-chains), so suppress the default EVM/Solana creation.
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      {app}
    </PrivyProvider>
  );
}
