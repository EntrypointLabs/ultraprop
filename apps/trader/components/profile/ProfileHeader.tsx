"use client";

import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/mock/types";
import { shortAddress } from "@/lib/utils";

interface ProfileHeaderProps {
  profile: Profile;
  wallet: string;
}

function SuiExplorerLink({ address }: { address: string }) {
  const url = `https://suiexplorer.com/address/${address}?network=mainnet`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-violet transition-colors"
      aria-label="Verify on the public ledger"
    >
      <span>Verify</span>
      <ExternalLink size={12} />
    </a>
  );
}

export function ProfileHeader({ profile, wallet }: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(wallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      navigator.share({ title: "Trader Profile", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      });
    }
  }

  const displayName = profile.displayName;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {/* Left: avatar + identity */}
      <div className="flex items-start gap-4">
        <Avatar
          address={wallet}
          size={56}
          className="rounded-[var(--radius)] shrink-0"
        />
        <div className="min-w-0">
          {displayName && (
            <div className="text-xl font-semibold text-text truncate">
              {displayName}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="tabular text-sm text-text-muted font-mono">
              {shortAddress(wallet, 8, 6)}
            </span>
            <button
              onClick={handleCopy}
              className="text-text-faint hover:text-text-muted transition-colors"
              aria-label="Copy address"
            >
              {copied ? (
                <Check size={12} className="text-up" />
              ) : (
                <Copy size={12} />
              )}
            </button>
            <SuiExplorerLink address={wallet} />
          </div>
          {/* Joined date */}
          <div className="text-xs text-text-faint mt-1 tabular">
            Joined{" "}
            {new Date(profile.joinedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
          aria-label="Share profile"
        >
          {shared ? (
            <Check size={12} className="text-up" />
          ) : (
            <Share2 size={12} />
          )}
          <span>{shared ? "Copied link" : "Share"}</span>
        </button>
      </div>
    </div>
  );
}
