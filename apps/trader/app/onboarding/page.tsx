import type { Metadata } from "next";
import { CreateAccountFlow } from "@/components/onboarding/CreateAccountFlow";

export const metadata: Metadata = {
  title: "Set up your account · Ultraprop",
};

export default function OnboardingPage() {
  return <CreateAccountFlow />;
}
