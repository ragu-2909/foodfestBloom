import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminDashboard } from "@/lib/api";
import { formatClock } from "@/lib/format";

export function ActivityFeed({ activity }: { activity: AdminDashboard["recentActivity"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {activity.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
              <div>
                <p className="font-medium">{entry.action.replace(/_/g, " ")}</p>
                {entry.performedBy && <p className="text-xs text-muted-foreground">{entry.performedBy}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatClock(entry.createdAt)}</span>
            </div>
          ))}
          {activity.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No activity yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
