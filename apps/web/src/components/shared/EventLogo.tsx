import { useState } from "react";
import { ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Company logo slot. Drop a logo file at `apps/web/public/company-logo.png`
 * (or .svg) and it renders here automatically, scaled to fit within the
 * frame — no code changes needed. Until that file exists, this falls back
 * to a chef-hat placeholder so the layout never breaks.
 */
export function EventLogo({ light = true, className }: { light?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-sm",
        light ? "border-white/20 bg-white/10 text-white" : "border-border bg-card text-primary",
        className
      )}
    >
      {failed ? (
        <ChefHat className="h-7 w-7" />
      ) : (
        <img
          src="/company-logo.png"
          alt="Company logo"
          className="h-full w-full object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
