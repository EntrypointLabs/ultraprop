import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Principle {
  number: string;
  title: string;
  body: string;
}

const PRINCIPLES: Principle[] = [
  {
    number: "01",
    title: "Credentials are earned, not assigned",
    body: "Future credentialing will follow the same pattern: a trader earns their level by meeting measurable, automatically-enforced criteria. Cohort membership, social connections, and time-in-protocol are not criteria.",
  },
  {
    number: "02",
    title: "Rules are public and immutable after issuance",
    body: "The parameters governing any active evaluation cannot change once it is open. This applies to all future cohorts. The rules a trader accepts at the start are the rules that determine the outcome.",
  },
  {
    number: "03",
    title: "The credential outlives the evaluation",
    body: "A credential is a permanent, non-expiring record. A trader who earned a level retains that record regardless of future activity. There is no decay mechanic.",
  },
  {
    number: "04",
    title: "No promise of future value",
    body: "The credential proves trading discipline. It does not carry a claim on any protocol, entity, or future event. No representation is made or implied about what the credential enables in any future system.",
  },
  {
    number: "05",
    title: "Transparency over opacity",
    body: "Every rule, every parameter, and every pass/fail event is permanently recorded and publicly accessible. The slippage model is deterministic and disclosed pre-trade. There are no hidden mechanics.",
  },
  {
    number: "06",
    title: "Failure is data, not punishment",
    body: "A failed evaluation is a verifiable record that the rules were not met under the given conditions. It is not hidden or penalized. Traders may retry within the closed-beta framework.",
  },
];

interface PrincipleCardProps {
  principle: Principle;
  index: number;
}

function PrincipleCard({ principle, index }: PrincipleCardProps) {
  return (
    <div
      className={cn(
        "flex gap-4 py-5",
        index < PRINCIPLES.length - 1 && "border-b border-border",
      )}
    >
      <span className="tabular shrink-0 text-xs font-semibold text-text-faint pt-0.5 w-6">
        {principle.number}
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text">{principle.title}</h3>
        <p className="text-xs leading-relaxed text-text-muted">
          {principle.body}
        </p>
      </div>
    </div>
  );
}

export function DesignPrinciples() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Badge variant="info" className="text-xs">
          Design Principles
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Governing principles for future credentialing
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
          The v1 Genesis cohort establishes a credentialing model that
          subsequent cohorts will follow. The principles below are not
          aspirational — they describe observable properties of the current
          system and the constraints future systems must satisfy to remain
          consistent.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface px-5 sm:px-6">
        {PRINCIPLES.map((p, i) => (
          <PrincipleCard key={p.number} principle={p} index={i} />
        ))}
      </div>
    </section>
  );
}
