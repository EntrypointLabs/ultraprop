"use client";

import { BadgeCheck, Check, ExternalLink, Loader2, X } from "lucide-react";
import * as React from "react";
import { Button, Card } from "@/components/ui";
import { suiObjectUrl } from "@/lib/sui/explorer";
import {
  useClaimUsername,
  useUsernameAvailability,
} from "@/lib/sui/useUsername";
import { cn } from "@/lib/utils";

interface UsernameSettingProps {
  /** The owner who'll receive the minted subname — always the signed-in trader. */
  suiAddress: string;
  /** The currently minted username (full subname), or null when none is set. */
  currentName: string | null;
  /** The NFT object id backing `currentName`, for the on-chain verify link. */
  currentNftId: string | null;
  /** The firm's parent domain, shown as the fixed suffix (e.g. `ultraprop.sui`). */
  parentName: string;
  /** The generated handle shown when no username is claimed. */
  handle: string;
}

const ALLOWED = /[^a-z0-9-]/g;

/**
 * Lets a trader claim a username by minting a subname of the firm's SuiNS domain
 * (`label.<parent>`) to their wallet as an NFT. We check availability live as
 * they type, and the firm signs + pays for the mint on claim. They can re-claim a
 * different label later; the prior NFT simply stays in their wallet.
 */
export function UsernameSetting({
  suiAddress,
  currentName,
  currentNftId,
  parentName,
  handle,
}: UsernameSettingProps) {
  const [label, setLabel] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const claim = useClaimUsername();

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(label), 400);
    return () => window.clearTimeout(id);
  }, [label]);

  const availability = useUsernameAvailability(debounced);
  const settled = debounced === label && !availability.isFetching;
  const checking = label.length >= 3 && !settled;
  const result = settled && label.length >= 3 ? availability.data : undefined;
  const availabilityFailed =
    settled && label.length >= 3 && availability.isError;
  const canClaim = Boolean(result?.available) && !claim.isPending;

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    setLabel(event.target.value.toLowerCase().replace(ALLOWED, ""));
    if (claim.isError) claim.reset();
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (canClaim) {
      claim.mutate({ suiAddress, label }, { onSuccess: () => setLabel("") });
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs text-text-muted">
        Claim a username on{" "}
        <span className="font-mono text-text">{parentName}</span>. It replaces{" "}
        <span className="font-mono text-text-muted">{handle}</span> across the
        app.
      </p>

      {currentName && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-up/30 bg-up/10 px-3 py-2">
          <BadgeCheck className="h-4 w-4 shrink-0 text-up" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-text">
            {currentName}
          </span>
          {suiObjectUrl(currentNftId) && (
            <a
              href={suiObjectUrl(currentNftId) as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs text-text-muted hover:text-violet transition-colors"
            >
              NFT
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="username-input" className="sr-only">
            Username
          </label>
          <div className="flex h-9 min-w-0 flex-1 items-center rounded-[var(--radius)] border border-border bg-surface-2 pl-3 pr-2 text-sm transition-colors focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/40">
            <input
              id="username-input"
              value={label}
              onChange={onChange}
              placeholder={currentName ? "pick a new name" : "yourname"}
              className="min-w-0 flex-1 bg-transparent font-mono text-text placeholder:text-text-faint focus:outline-none"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={63}
              aria-invalid={result && !result.available ? true : undefined}
            />
            <span className="shrink-0 font-mono text-text-faint">
              .{parentName}
            </span>
          </div>
          <Button
            type="submit"
            disabled={!canClaim}
            className="shrink-0 sm:w-auto"
          >
            {claim.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {claim.isPending ? "Claiming…" : currentName ? "Change" : "Claim"}
          </Button>
        </div>

        <div className="min-h-[1.25rem]" aria-live="polite" aria-atomic="true">
          <Feedback
            label={label}
            checking={checking}
            availabilityFailed={availabilityFailed}
            result={result}
            claimError={
              claim.isError
                ? claim.error instanceof Error
                  ? claim.error.message
                  : "We couldn't claim your username."
                : null
            }
          />
        </div>
      </form>
    </Card>
  );
}

function Feedback({
  label,
  checking,
  availabilityFailed,
  result,
  claimError,
}: {
  label: string;
  checking: boolean;
  availabilityFailed: boolean;
  result:
    | { available: boolean; name?: string; reason?: string | null }
    | undefined;
  claimError: string | null;
}) {
  if (claimError) {
    return <Line tone="bad" text={claimError} />;
  }
  if (label.length > 0 && label.length < 3) {
    return <Line tone="muted" text="At least 3 characters." />;
  }
  if (checking) {
    return (
      <Line
        tone="muted"
        icon={<Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        text="Checking availability…"
      />
    );
  }
  if (availabilityFailed) {
    return (
      <Line
        tone="bad"
        icon={<X className="h-3 w-3" aria-hidden="true" />}
        text="Couldn't check that name. Try again."
      />
    );
  }
  if (result?.available) {
    return (
      <Line
        tone="good"
        icon={<Check className="h-3 w-3" aria-hidden="true" />}
        text={`${result.name} is available`}
      />
    );
  }
  if (result && !result.available) {
    return (
      <Line
        tone="bad"
        icon={<X className="h-3 w-3" aria-hidden="true" />}
        text={result.reason ?? "That username is taken."}
      />
    );
  }
  return null;
}

function Line({
  tone,
  icon,
  text,
}: {
  tone: "good" | "bad" | "muted";
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs",
        tone === "good" && "text-up",
        tone === "bad" && "text-down",
        tone === "muted" && "text-text-muted",
      )}
    >
      {icon}
      <span className="font-mono">{text}</span>
    </p>
  );
}
