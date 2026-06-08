import type { Metadata } from "next";
import { SignupFlow } from "@/components/auth/SignupFlow";

export const metadata: Metadata = {
  title: "Create your account · Ultraprop",
};

export default function SignupPage() {
  return <SignupFlow />;
}
