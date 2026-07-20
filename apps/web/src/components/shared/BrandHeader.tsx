import { cn } from "@/lib/utils";
import { EventLogo } from "./EventLogo";

export function BrandHeader({
  title,
  subtitle,
  className,
  light = true
}: {
  title: string;
  subtitle?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
      <EventLogo light={light} />
      <div>
        <p className={cn("text-xs font-semibold uppercase tracking-[0.25em]", light ? "text-white/70" : "text-muted-foreground")}>
          Bloom Energy
        </p>
        <h1
          className={cn(
            "font-display text-2xl font-bold sm:text-3xl",
            light ? "text-white text-shadow-soft" : "text-foreground"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className={cn("mt-1 text-sm", light ? "text-white/80" : "text-muted-foreground")}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
