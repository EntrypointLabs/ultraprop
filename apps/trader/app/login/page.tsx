import type { Metadata } from "next";
import { LoginFlow } from "@/components/auth/LoginFlow";

export const metadata: Metadata = {
  title: "Log in · Ultraprop",
};

export default function LoginPage() {
  return <LoginFlow />;
}
