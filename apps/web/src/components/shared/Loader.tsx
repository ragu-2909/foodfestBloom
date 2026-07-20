import { Loader2 } from "lucide-react";

export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-white">
      <Loader2 className="h-10 w-10 animate-spin" />
      {label && <p className="text-sm text-white/80">{label}</p>}
    </div>
  );
}
