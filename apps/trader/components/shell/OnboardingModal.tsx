"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PixelBanner } from "@/components/ui/PixelBanner";
import { useMockStore } from "@/lib/mock/store";

const BRAND = "Ultraprop";

export function OnboardingModal() {
  const hydrated = useMockStore((s) => s.hydrated);
  const dismissed = useMockStore((s) => s.onboardingDismissed);
  const dismiss = useMockStore((s) => s.dismissOnboarding);
  const openLogin = useMockStore((s) => s.openLogin);

  const getStarted = () => {
    dismiss();
    openLogin();
  };

  // Only show after rehydration so the persisted dismissal is respected and the
  // server/client first paint match (modal is never rendered on the server).
  const open = hydrated && !dismissed;

  return (
    <Modal open={open} onClose={dismiss} hideClose>
      <PixelBanner height={120} className="mb-5">
        <span className="text-2xl font-bold tracking-tight">GENESIS</span>
      </PixelBanner>
      <h2 className="text-xl font-semibold text-text">Welcome to {BRAND}</h2>
      <p className="mt-2 text-sm text-text-muted">
        A proprietary trading firm. Trade BTC, ETH and SOL in simulation
        against live market prices, with the fill math shown before you submit.
      </p>
      <p className="mt-1 text-sm text-text-muted">
        Pass an evaluation to earn a non-transferable proof of trading skill in
        the v1 Genesis cohort.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button variant="primary" onClick={getStarted}>
          Get started
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          Learn more
        </Button>
      </div>
    </Modal>
  );
}
