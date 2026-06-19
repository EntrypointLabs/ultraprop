import { type RedirectType, redirect } from "next/navigation";

/**
 * Declarative render-time redirect. Render it conditionally instead of reaching
 * for `useEffect(() => router.replace(...))`: `redirect()` throws during render,
 * so nothing commits and there's no flash of the page being navigated away from.
 * For navigation from an event handler, use `useRouter().push/replace` instead —
 * `redirect()` only works during render.
 */
export function Redirect({
  href,
  type,
}: {
  href: string;
  type?: RedirectType;
}): never {
  redirect(href, type);
}
