import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicSettings } from "@/lib/api";
import { formatRemaining } from "@/lib/format";

export function StatusCards({ settings }: { settings: PublicSettings | null }) {
  const voting = settings?.voting;
  const colorSelection = settings?.colorSelection;

  const votingLive = Boolean(voting?.hasStarted && !voting?.hasEnded);
  const colorLive = Boolean(colorSelection?.hasStarted && !colorSelection?.hasEnded);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Voting Session</CardTitle>
          <Badge variant={votingLive ? "success" : "muted"}>{votingLive ? "Live" : "Inactive"}</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {votingLive
              ? `Voting is live. Time remaining: ${formatRemaining(voting!.remainingMs)}`
              : "Voting is closed. Start a session from Operations below."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Color Selection</CardTitle>
          <Badge variant={colorLive ? "success" : "muted"}>{colorLive ? "Live" : "Inactive"}</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {colorLive
              ? `Teams can pick colors now. Time remaining: ${formatRemaining(colorSelection!.remainingMs)}`
              : "Color selection isn't open. Start a session from Operations below."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
