"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { SuiWalletGate } from "@/components/auth/SuiWalletGate";
import { type Theme, ThemeProvider, useTheme } from "@/lib/theme";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <ProvidersInner>{children}</ProvidersInner>
    </ThemeProvider>
  );
}

function ProvidersInner({ children }: { children: React.ReactNode }) {
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

  const { resolvedTheme } = useTheme();

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

  const privyTheme = resolvedTheme === "dark" ? "dark" : "light";
  // White-on-#e5484d is 3.91:1 — an AA fail inside Privy's light dialog; #dc3d42 is 4.38:1.
  const accentColor: `#${string}` =
    resolvedTheme === "dark" ? "#e5484d" : "#dc3d42";

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: {
          theme: privyTheme,
          accentColor,
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
