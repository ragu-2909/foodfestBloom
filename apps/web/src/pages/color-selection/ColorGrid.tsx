import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Users, X } from "lucide-react";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ColorOption } from "@/lib/api";
import { cn } from "@/lib/utils";

const formatSecs = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

// Colors whose hex is too light to read against the white card background
// need an extra outline so the swatch itself stays visible.
const needsOutline = (hex: string) => hex.toLowerCase() === "#ffffff";

export function ColorGrid({
  teamName,
  teamId,
  colors,
  onlineTeams,
  submitting,
  onReserve,
  onConfirm,
  onUnselect
}: {
  teamName: string;
  teamId: string;
  colors: ColorOption[];
  onlineTeams: string[];
  submitting: boolean;
  onReserve: (colorId: string) => Promise<void> | void;
  onConfirm: () => void;
  onUnselect: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleReserveClick = async (colorId: string) => {
    setPendingId(colorId);
    try {
      await onReserve(colorId);
    } finally {
      setPendingId(null);
    }
  };

  const activeReservation = useMemo(
    () => colors.find((c) => c.bookings.some((b) => b.teamId === teamId && b.status === "reserved")) || null,
    [colors, teamId]
  );

  const [timeLeftSecs, setTimeLeftSecs] = useState(0);
  useEffect(() => {
    const myBooking = activeReservation?.bookings.find((b) => b.teamId === teamId);
    if (!myBooking?.reservationExpiresAt) {
      setTimeLeftSecs(0);
      return;
    }
    const tick = () => {
      const expires = new Date(myBooking.reservationExpiresAt!).getTime();
      setTimeLeftSecs(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [activeReservation, teamId]);

  return (
    <div className="bg-brand-gradient min-h-screen w-full px-4 py-8 text-white sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <BrandHeader title={`${teamName} — Choose Your Color`} subtitle="Tap a color to hold a slot for 2 minutes, then confirm to lock it in." light className="items-center" />

        {activeReservation && (
          <Card className="border-accent/40 bg-card shadow-xl">
            <CardContent className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-8 w-8 rounded-full border-2 border-card shadow",
                    needsOutline(activeReservation.hexCode) && "ring-2 ring-slate-300"
                  )}
                  style={{ backgroundColor: activeReservation.hexCode }}
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your hold</p>
                  <p className="font-display text-lg font-bold text-foreground">{activeReservation.name}</p>
                </div>
              </div>
              <div
                className={cn(
                  "font-display text-2xl font-bold tabular-nums",
                  timeLeftSecs <= 20 ? "animate-pulse text-destructive" : "text-primary"
                )}
              >
                {formatSecs(timeLeftSecs)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onUnselect} disabled={submitting}>
                  <X className="h-4 w-4" /> Unselect
                </Button>
                <Button onClick={onConfirm} disabled={submitting}>
                  <Check className="h-4 w-4" /> {submitting ? "Locking in..." : "Confirm & Lock"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {colors.map((color) => {
            const isMine = activeReservation?.id === color.id;
            const isFull = color.remaining <= 0;
            const isPending = pendingId === color.id;
            const isDisabled = (isFull && !isMine) || submitting || pendingId !== null;

            let statusLabel = "Available";
            if (isPending) statusLabel = "Holding...";
            else if (isMine) statusLabel = "Your pick — confirm above";
            else if (isFull) statusLabel = "Full";
            else if (color.remaining < color.capacity) statusLabel = `Only ${color.remaining} left`;

            return (
              <button
                key={color.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleReserveClick(color.id)}
                className={cn(
                  "group flex flex-col items-center gap-3 rounded-2xl border-2 bg-card p-4 text-center shadow-sm transition-all",
                  isDisabled ? "cursor-not-allowed opacity-70" : "hover:-translate-y-1 hover:shadow-lg",
                  isMine ? "border-accent ring-2 ring-accent/40" : isDisabled ? "border-transparent" : "border-transparent hover:border-primary/30"
                )}
              >
                <div
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-card shadow-md transition-transform",
                    needsOutline(color.hexCode) && "ring-2 ring-slate-300",
                    !isDisabled && "group-hover:scale-105",
                    isDisabled && "grayscale-[35%]"
                  )}
                  style={{ backgroundColor: color.hexCode }}
                >
                  {isPending && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </span>
                  )}
                  {isMine && !isPending && (
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="w-full">
                  <p className="text-sm font-semibold leading-tight text-foreground">{color.name}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] font-medium leading-tight",
                      isPending
                        ? "text-muted-foreground"
                        : isMine
                          ? "text-accent"
                          : isFull
                            ? "text-muted-foreground"
                            : color.remaining < color.capacity
                              ? "text-amber-600"
                              : "text-emerald-600"
                    )}
                  >
                    {statusLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {onlineTeams.length > 0 && (
          <div className="flex items-center gap-2 self-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/80">
            <Users className="h-3.5 w-3.5" /> {onlineTeams.length} team{onlineTeams.length === 1 ? "" : "s"} online now
          </div>
        )}
      </div>
    </div>
  );
}
