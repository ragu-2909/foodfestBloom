import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Users, X } from "lucide-react";
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

const legend = [
  { label: "Available", dot: "bg-emerald-500" },
  { label: "Held by another team", dot: "bg-amber-500" },
  { label: "Taken", dot: "bg-slate-400" }
];

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
  onReserve: (colorId: string) => void;
  onConfirm: () => void;
  onUnselect: () => void;
}) {
  const activeReservation = useMemo(
    () => colors.find((c) => c.status === "reserved" && c.reservedByTeamId === teamId) || null,
    [colors, teamId]
  );

  const [timeLeftSecs, setTimeLeftSecs] = useState(0);
  useEffect(() => {
    if (!activeReservation?.reservationExpiresAt) {
      setTimeLeftSecs(0);
      return;
    }
    const tick = () => {
      const expires = new Date(activeReservation.reservationExpiresAt!).getTime();
      setTimeLeftSecs(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [activeReservation]);

  return (
    <div className="bg-brand-gradient min-h-screen w-full px-4 py-8 text-white sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <BrandHeader title={`${teamName} — Choose Your Color`} subtitle="Tap a color to hold it for 2 minutes, then confirm to lock it in." light className="items-center" />

        {activeReservation && (
          <Card className="border-accent/40 bg-card shadow-xl">
            <CardContent className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-full border-2 border-card shadow" style={{ backgroundColor: activeReservation.hexCode }} />
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

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {legend.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-white/75">
              <span className={cn("h-2 w-2 rounded-full", item.dot)} /> {item.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colors.map((color) => {
            const isMine = activeReservation?.id === color.id;
            const isOtherReserved = color.status === "reserved" && !isMine;
            const isBooked = color.status === "booked";
            const isDisabled = isBooked || isOtherReserved || submitting;

            let statusLabel = "Available";
            if (isMine) statusLabel = "Your pick — confirm above";
            else if (isOtherReserved) statusLabel = `Held by ${color.reservedByTeamName ?? "another team"}`;
            else if (isBooked) statusLabel = `Taken by ${color.bookedByTeamName ?? "another team"}`;

            return (
              <button
                key={color.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onReserve(color.id)}
                className={cn(
                  "group flex flex-col items-center gap-3 rounded-2xl border-2 bg-card p-4 text-center shadow-sm transition-all",
                  isDisabled ? "cursor-not-allowed opacity-70" : "hover:-translate-y-1 hover:shadow-lg",
                  isMine ? "border-accent ring-2 ring-accent/40" : isDisabled ? "border-transparent" : "border-transparent hover:border-primary/30"
                )}
              >
                <div
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-card shadow-md transition-transform",
                    !isDisabled && "group-hover:scale-105",
                    isDisabled && "grayscale-[35%]"
                  )}
                  style={{ backgroundColor: color.hexCode }}
                >
                  {isBooked && (
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-white shadow">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {isOtherReserved && (
                    <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-card bg-amber-500 shadow" />
                  )}
                  {isMine && (
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="w-full">
                  <p className="text-sm font-semibold leading-tight text-foreground">{color.name}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-tight",
                      isMine ? "font-medium text-accent" : isDisabled ? "text-muted-foreground" : "text-emerald-600"
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
