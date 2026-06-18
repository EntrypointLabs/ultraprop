import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";

export interface PagePlaceholderProps {
  title: string;
  subtitle?: string;
  route: string;
  badge?: string;
}

/** Centered placeholder used by route stubs — proves shell + primitive wiring. */
export function PagePlaceholder({
  title,
  subtitle,
  route,
  badge,
}: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-[1440px] items-center justify-center px-4 py-24 sm:px-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          {badge && <Badge variant="tier">{badge}</Badge>}
          <h1 className="text-2xl font-semibold text-text">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
          <code className="tabular mt-2 rounded-sm bg-surface-2 px-2 py-1 text-xs text-text-faint">
            {route}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
