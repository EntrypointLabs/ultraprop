"use client";

import { Bug, FileText } from "lucide-react";
import { ConnectionDot } from "@/components/ui/ConnectionDot";
import { useConnection } from "@/lib/mock/hooks";

function DiscordIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.27 5.33A16.6 16.6 0 0015.16 4l-.2.4a14.6 14.6 0 014 1.92 13 13 0 00-11.94 0A14.6 14.6 0 019 4.4L8.84 4a16.6 16.6 0 00-4.1 1.33C2.13 9.18 1.4 13 1.78 16.8a16.7 16.7 0 005.05 2.55l.43-.7c-.66-.25-1.3-.55-1.9-.92l.16-.12a11.6 11.6 0 0010 0l.16.12c-.6.37-1.24.67-1.9.92l.42.7a16.6 16.6 0 005.06-2.56c.44-4.39-.74-8.18-3.27-11.46zM8.9 14.5c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.78.9 1.76 2c0 1.1-.78 2-1.76 2zm6.2 0c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.78.9 1.76 2c0 1.1-.78 2-1.76 2z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.69l7.73-8.84L1.27 2.25h6.82l4.71 6.23 5.44-6.23zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64z" />
    </svg>
  );
}

const ICON_LINK =
  "rounded-sm p-1.5 text-text-faint transition-colors hover:bg-surface-2 hover:text-text";
const TEXT_LINK = "text-text-faint transition-colors hover:text-text";

export function Footer() {
  const connection = useConnection();
  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 py-4 text-xs sm:flex-row sm:px-6">
        <ConnectionDot status={connection} />
        <div className="flex items-center gap-4">
          <a href="#" className={`inline-flex items-center gap-1 ${TEXT_LINK}`}>
            <Bug className="h-3.5 w-3.5" />
            Report a bug
          </a>
          <a href="#" className={TEXT_LINK}>
            Terms
          </a>
          <a href="#" className={TEXT_LINK}>
            Privacy
          </a>
          <span className="h-3 w-px bg-border" />
          <a href="#" aria-label="Discord" className={ICON_LINK}>
            <DiscordIcon />
          </a>
          <a href="#" aria-label="X" className={ICON_LINK}>
            <XIcon />
          </a>
          <a href="#" aria-label="Docs" className={ICON_LINK}>
            <FileText className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
