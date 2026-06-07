import { Badge, Card, CardContent, PixelBanner } from "@/components/ui";

/**
 * Shown when a connected wallet is not on the closed-beta allowlist.
 * Tasteful, non-punishing — positions this as exclusive, not a rejection.
 */
export function WaitlistState() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="overflow-hidden">
        <PixelBanner
          height={80}
          className="rounded-b-none rounded-t-[var(--radius)]"
        >
          <span className="font-bold text-xl tracking-tight text-brand-ink">
            v1 Genesis cohort
          </span>
        </PixelBanner>

        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <Badge variant="genesis">Invite only</Badge>

          <h2 className="text-xl font-semibold text-text">
            Closed beta — invite required
          </h2>

          <p className="text-sm text-text-muted leading-relaxed max-w-xs">
            The v1 Genesis cohort is an exclusive closed beta. Your account
            isn&apos;t on the current allowlist. Invites are distributed
            directly by the team.
          </p>

          <div className="w-full rounded-[var(--radius)] bg-surface-2 px-4 py-3 text-left">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">
              What to do
            </div>
            <ul className="space-y-1.5 text-sm text-text-muted">
              <li className="flex gap-2">
                <span className="text-violet shrink-0">→</span>
                Follow Ultraprop on X for cohort announcements
              </li>
              <li className="flex gap-2">
                <span className="text-violet shrink-0">→</span>
                Join the community to request an invite
              </li>
              <li className="flex gap-2">
                <span className="text-violet shrink-0">→</span>
                Check back — new invites are issued each cycle
              </li>
            </ul>
          </div>

          <p className="text-xs text-text-faint">
            Already have an invite? Make sure you&apos;re signed in with the
            correct account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
