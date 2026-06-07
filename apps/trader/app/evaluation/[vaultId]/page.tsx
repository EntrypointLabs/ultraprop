import { EvaluationCockpit } from "@/components/evaluation/EvaluationCockpit";

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = await params;
  return <EvaluationCockpit vaultId={vaultId} />;
}
