import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Full-viewport teal/orange event backdrop used on public-facing screens. */
export function PageBackground({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-brand-gradient min-h-screen w-full text-white", className)}>
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
