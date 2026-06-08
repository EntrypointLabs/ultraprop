import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rule {
  label: string;
  test: (password: string) => boolean;
}

const RULES: Rule[] = [
  { label: "8 to 72 characters", test: (p) => p.length >= 8 && p.length <= 72 },
  { label: "A number", test: (p) => /\d/.test(p) },
  {
    label: "Uppercase and lowercase letters",
    test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  { label: "A special character such as ! @ #", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}

export function PasswordChecklist({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                met ? "bg-up/15 text-up" : "bg-surface-2 text-text-faint",
              )}
            >
              <Check className="h-3 w-3" aria-hidden strokeWidth={3} />
            </span>
            <span className={met ? "text-text" : "text-text-muted"}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
