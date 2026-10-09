import type { ReactNode } from "react";

/**
 * A slide's figure on glass, as on the landing page. `inset` is for figures that bring their own
 * white panel (a conversation): the glass is a thin frame around it. Otherwise the figure sits on
 * the glass itself (a chart).
 */
export function Glass({ inset = false, children }: { inset?: boolean; children: ReactNode }) {
  return <div className={inset ? "glass rounded-[24px] p-3" : "glass rounded-3xl p-6 sm:p-8"}>{children}</div>;
}
