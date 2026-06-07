import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return <ProfilePageClient wallet={wallet} />;
}
