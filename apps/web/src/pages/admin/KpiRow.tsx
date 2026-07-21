import { Gavel, Palette, Users, Vote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDashboard, ColorOption } from "@/lib/api";

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiRow({ dashboard, colors }: { dashboard: AdminDashboard | null; colors: ColorOption[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat icon={Users} label="Teams" value={dashboard?.metrics.teams ?? 0} />
      <Stat icon={Vote} label="Votes" value={dashboard?.metrics.votes ?? 0} />
      <Stat
        icon={Palette}
        label="Teams Booked"
        value={colors.reduce((count, c) => count + c.bookings.filter((b) => b.status === "booked").length, 0)}
      />
      <Stat icon={Gavel} label="Judge Entries" value={dashboard?.metrics.judgeEntries ?? 0} />
    </div>
  );
}
