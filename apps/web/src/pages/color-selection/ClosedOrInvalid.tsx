import { LucideIcon } from "lucide-react";
import { PageBackground } from "@/components/shared/PageBackground";
import { Card, CardContent } from "@/components/ui/card";

export function ClosedOrInvalid({
  icon: Icon,
  title,
  message
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <PageBackground>
      <Card className="w-full max-w-md border-transparent bg-card shadow-xl">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="font-display text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </PageBackground>
  );
}
