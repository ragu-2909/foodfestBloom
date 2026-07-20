import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, AdminDashboard } from "@/lib/api";

export function EventSettingsPanel({
  token,
  dashboard,
  onChanged
}: {
  token: string;
  dashboard: AdminDashboard | null;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/admin/settings", {
        method: "PUT",
        token,
        body: JSON.stringify({
          eventName: form.get("eventName"),
          judgePasscode: form.get("judgePasscode")
        })
      });
      await onChanged();
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eventName">Event display name</Label>
            <Input
              id="eventName"
              name="eventName"
              defaultValue={typeof dashboard?.settings.event_name === "string" ? dashboard.settings.event_name : ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="judgePasscode">Judge access passcode</Label>
            <Input
              id="judgePasscode"
              name="judgePasscode"
              defaultValue={typeof dashboard?.settings.judge_passcode === "string" ? dashboard.settings.judge_passcode : ""}
            />
            <p className="text-xs text-muted-foreground">Share this with judges — they enter it once at /judge.</p>
          </div>
          <Button type="submit" disabled={busy} className="self-start">
            <Save className="h-4 w-4" /> {busy ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
