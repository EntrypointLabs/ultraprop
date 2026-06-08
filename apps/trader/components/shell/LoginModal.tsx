"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  EmailAuthButton,
  SocialAuthButtons,
} from "@/components/auth/social";
import { Modal } from "@/components/ui/Modal";
import { useMockStore } from "@/lib/mock/store";

/**
 * Entry point to auth. Social providers sign in instantly (mock OAuth); the
 * email option leaves the modal for the full-page `/signup` flow.
 */
export function LoginModal() {
  const router = useRouter();
  const open = useMockStore((s) => s.loginOpen);
  const close = useMockStore((s) => s.closeLogin);
  const signIn = useMockStore((s) => s.signIn);

  const firstButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) firstButtonRef.current?.focus();
  }, [open]);

  function goToSignup() {
    close();
    router.push("/signup");
  }

  function goToLogin() {
    close();
    router.push("/login");
  }

  return (
    <Modal open={open} onClose={close} hideClose className="max-w-[400px]">
      <div className="flex flex-col">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-sm p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-text">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Join the v1 Genesis cohort. It takes a minute.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <SocialAuthButtons onSelect={signIn} firstRef={firstButtonRef} />
          <EmailAuthButton onClick={goToSignup}>
            Sign up with Email
          </EmailAuthButton>
        </div>


        <p className="mt-5 text-center text-[11px] leading-relaxed text-text-faint">
          By continuing you agree to the{" "}
          <span className="text-text-muted">Terms</span> and{" "}
          <span className="text-text-muted">Privacy Policy</span>.
        </p>

        <p className="mt-5 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <button
            type="button"
            onClick={goToLogin}
            className="font-medium text-brand transition-colors hover:text-violet-hover"
          >
            Log in
          </button>
        </p>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-text-faint"> Secured by{" "}
          <span className="text-text-muted">Privy</span>.</p>
      </div>
    </Modal>
  );
}
