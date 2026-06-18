import type * as React from "react";

interface ProfileSectionProps {
  title: string;
  /** Optional right-aligned element on the section header row (e.g. a badge). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** A labelled sector on the profile/account page — a quiet uppercase header
 * over its content, the way Kalshi groups account settings. */
export function ProfileSection({
  title,
  action,
  children,
}: ProfileSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
