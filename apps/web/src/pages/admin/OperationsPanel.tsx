import { FormEvent, useState } from "react";
import { Play, RefreshCcw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

function DurationDialog({
  label,
  icon: Icon,
  defaultMinutes,
  onStart
}: {
  label: string;
  icon: typeof Play;
  defaultMinutes: number;
  onStart: (minutes: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minutes = Number(new FormData(event.currentTarget).get("minutes"));
    setBusy(true);
    try {
      await onStart(minutes);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="justify-start">
          <Icon className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minutes">Duration (minutes)</Label>
            <Input id="minutes" name="minutes" type="number" min={1} max={240} defaultValue={defaultMinutes} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Starting..." : "Start"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OperationsPanel({ token, onChanged }: { token: string; onChanged: () => Promise<void> }) {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const run = async (action: string, path: string, body?: unknown) => {
    setBusyAction(action);
    try {
      await api(path, { method: "POST", token, body: body ? JSON.stringify(body) : undefined });
      await onChanged();
      toast.success("Operation completed.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operations Control</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        <DurationDialog
          label="Start Voting"
          icon={Play}
          defaultMinutes={10}
          onStart={(minutes) => run("startVoting", "/admin/startVoting", { durationMinutes: minutes })}
        />
        <Button variant="outline" className="justify-start" disabled={busyAction !== null} onClick={() => run("stopVoting", "/admin/stopVoting")}>
          <Square className="h-4 w-4" /> Stop Voting
        </Button>

        <DurationDialog
          label="Start Color Selection"
          icon={Play}
          defaultMinutes={15}
          onStart={(minutes) => run("startColorSelection", "/admin/startColorSelection", { durationMinutes: minutes })}
        />
        <Button
          variant="outline"
          className="justify-start"
          disabled={busyAction !== null}
          onClick={() => run("stopColorSelection", "/admin/stopColorSelection")}
        >
          <Square className="h-4 w-4" /> Stop Color Selection
        </Button>

        <Button variant="ghost" className="justify-start" disabled={busyAction !== null} onClick={onChanged}>
          <RefreshCcw className="h-4 w-4" /> Refresh Data
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="justify-start" disabled={busyAction !== null}>
              <Trash2 className="h-4 w-4" /> Reset Event
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset the entire event?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears all votes and the activity log, stops voting and color selection, and releases every
                team's color back to available (including already-confirmed picks). Team roster data is kept intact.
                This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run("resetEvent", "/admin/resetEvent")}>Reset Event</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
