"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import {
  HelpCircle,
  History,
  LogOut,
  Mail,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import * as React from "react";
import { EvaluationHistory } from "@/components/profile/EvaluationHistory";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSection } from "@/components/profile/ProfileSection";
import {
  type ProfileTab,
  ProfileTabNav,
} from "@/components/profile/ProfileTabNav";
import { SbtCard } from "@/components/profile/SbtCard";
import { SettingRow, SettingsList } from "@/components/profile/SettingsList";
import { StatGrid } from "@/components/profile/StatGrid";
import { TradingAccountSection } from "@/components/profile/TradingAccountSection";
import { Tabs } from "@/components/ui/Tabs";
import { suiWalletAddress } from "@/lib/auth";
import { accountHandle } from "@/lib/identity";
import { useProfile } from "@/lib/mock/hooks";
import { useMockStore } from "@/lib/mock/store";
import type { Profile, SbtLevel, SbtState } from "@/lib/mock/types";
import { statusFromCode } from "@/lib/sui/onchainRules";
import { usdcToUsd } from "@/lib/sui/propfirm";
import {
  useAccountSetup,
  useOnchainAccountSummaryFor,
} from "@/lib/sui/useTradingAccount";

interface ProfilePageClientProps {
  wallet: string;
}

export function ProfilePageClient({ wallet }: ProfilePageClientProps) {
  const { authenticated, user } = usePrivy();
  const { logout } = useLogout();
  const resetOnboarding = useMockStore((s) => s.resetOnboarding);
  const setup = useAccountSetup();

  const myAddress = suiWalletAddress(user);
  const isOwn = Boolean(
    authenticated &&
      myAddress &&
      wallet.toLowerCase() === myAddress.toLowerCase(),
  );
  const email = (user as { email?: { address?: string } } | null)?.email
    ?.address;

  const baseProfile = useProfile(wallet);

  // Overlay the wallet's verifiable on-chain account on top of the seeded
  // profile: realized P&L (equity − funded), pass/fail and tier from the live
  // status, and a credential derived from an actual on-chain pass (the account
  // object is its verifiable reference). Fields with no on-chain source — the
  // join date, eval history dates, consistency — are left empty, never invented.
  const onchain = useOnchainAccountSummaryFor(wallet);
  const profile = React.useMemo<Profile>(() => {
    const summary = onchain.summary;
    if (!summary) return baseProfile;
    const status = statusFromCode(summary.statusCode);
    const fundedUsd = usdcToUsd(summary.fundedSize);
    const realizedPnl = usdcToUsd(summary.equity) - fundedUsd;
    const tierLabel = summary.tier
      ? summary.tier.charAt(0).toUpperCase() + summary.tier.slice(1)
      : baseProfile.highestTier;
    const passed = status === "passed";
    const level: SbtLevel = !passed
      ? 0
      : summary.tier === "starter"
        ? 1
        : summary.tier === "basic"
          ? 2
          : 3;
    const sbt: SbtState = {
      owner: wallet,
      level,
      passedTiers: passed ? [tierLabel] : [],
      lastLevelUpAt: null,
      objectId: passed ? onchain.accountId : null,
      cohort: "v1 Genesis",
    };
    return {
      ...baseProfile,
      shadowPnl: realizedPnl,
      passes: passed ? 1 : 0,
      fails: status === "failed" ? 1 : 0,
      highestTier: tierLabel,
      sbt,
    };
  }, [baseProfile, onchain.summary, onchain.accountId, wallet]);

  const tabs: ProfileTab[] = [
    { value: "overview", label: "Overview", icon: TrendingUp },
    { value: "activity", label: "Activity", icon: History },
    ...(isOwn
      ? [
          {
            value: "account",
            label: "Account",
            icon: Wallet,
            dot: setup.needsSetup,
          },
          { value: "settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  const [tab, setTab] = React.useState("overview");
  const active = tabs.some((t) => t.value === tab) ? tab : tabs[0].value;

  function panel() {
    switch (active) {
      case "activity":
        return <EvaluationHistory evaluations={profile.evaluations} />;
      case "account":
        return (
          <div className="space-y-8">
            <TradingAccountSection />
            <ProfileSection title="Wallet & email">
              <SettingsList>
                <SettingRow
                  icon={Wallet}
                  label="Account"
                  value={accountHandle(wallet)}
                />
                <SettingRow
                  icon={Mail}
                  label="Email"
                  value={email ?? "Not linked"}
                />
              </SettingsList>
            </ProfileSection>
          </div>
        );
      case "settings":
        return (
          <SettingsList>
            <SettingRow
              icon={HelpCircle}
              label="How it works"
              onClick={resetOnboarding}
            />
            <SettingRow
              icon={LogOut}
              label="Sign out"
              onClick={logout}
              danger
            />
          </SettingsList>
        );
      default:
        return (
          <div className="space-y-8">
            <ProfileSection title="Performance">
              <StatGrid profile={profile} />
            </ProfileSection>
            <SbtCard
              sbt={profile.sbt}
              shadowPnl={profile.shadowPnl}
              passes={profile.passes}
            />
          </div>
        );
    }
  }

  const mobileItems = tabs.map((t) => ({
    value: t.value,
    label: t.dot ? (
      <span className="inline-flex items-center gap-1.5">
        {t.label}
        <span
          role="img"
          aria-label="Setup incomplete"
          className="h-1.5 w-1.5 rounded-full bg-warn"
        />
      </span>
    ) : (
      t.label
    ),
  }));

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 space-y-6">
      {/* Header */}
      <ProfileHeader profile={profile} wallet={wallet} />

      <div className="mt-6 lg:hidden">
        <Tabs
          items={mobileItems}
          value={active}
          onValueChange={setTab}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_180px] lg:gap-8">
        <div className="min-w-0">{panel()}</div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <ProfileTabNav tabs={tabs} value={active} onValueChange={setTab} />
          </div>
        </aside>
      </div>
    </div>
  );
}
