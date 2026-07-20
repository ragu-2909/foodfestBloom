import { useState } from "react";
import { Copy, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { api, ApiError, ColorOption, Team } from "@/lib/api";
import { formatRemaining } from "@/lib/format";

const NO_COLOR = "__none__";

function TableNumberCell({ team, token, onChanged }: { team: Team; token: string; onChanged: () => Promise<void> }) {
  const [value, setValue] = useState(team.tableNumber != null ? String(team.tableNumber) : "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const tableNumber = value.trim() === "" ? null : Number(value);
    if (tableNumber === (team.tableNumber ?? null)) return;
    setBusy(true);
    try {
      await api(`/admin/teams/${team.id}/table`, { method: "PUT", token, body: JSON.stringify({ tableNumber }) });
      await onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to update table number.");
      setValue(team.tableNumber != null ? String(team.tableNumber) : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Input
      type="number"
      min={1}
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      placeholder="—"
      className="h-8 w-16 text-center"
    />
  );
}

function ManageColorDialog({
  team,
  colors,
  token,
  onChanged
}: {
  team: Team;
  colors: ColorOption[];
  token: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(team.selectedColorId ?? NO_COLOR);
  const [busy, setBusy] = useState(false);

  const assignable = colors.filter((c) => c.status === "available" || c.id === team.selectedColorId);

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/admin/teams/${team.id}/color`, {
        method: "PUT",
        token,
        body: JSON.stringify({ colorId: value === NO_COLOR ? null : value })
      });
      setOpen(false);
      await onChanged();
      toast.success("Team color updated.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to update team color.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(team.selectedColorId ?? NO_COLOR);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Manage color">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage color for {team.name}</DialogTitle>
        </DialogHeader>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_COLOR}>No color / clear selection</SelectItem>
            {assignable.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ParticipantsTable({
  token,
  teams,
  colors,
  onChanged
}: {
  token: string;
  teams: Team[];
  colors: ColorOption[];
  onChanged: () => Promise<void>;
}) {
  const deleteTeam = async (id: string) => {
    try {
      await api(`/admin/deleteTeam/${id}`, { method: "DELETE", token });
      await onChanged();
      toast.success("Team deleted.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete team.");
    }
  };

  const copyLink = (invitationToken?: string) => {
    if (!invitationToken) return;
    const link = `${window.location.origin}/select-color/${invitationToken}`;
    navigator.clipboard.writeText(link);
    toast.success("Invitation link copied.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants & Color Assignments ({teams.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Table #</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time Left</TableHead>
              <TableHead>Invite</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => {
              const activeColor = colors.find((c) => c.bookedByTeamId === team.id || c.reservedByTeamId === team.id);
              let statusLabel = "Pending";
              let statusVariant: "muted" | "accent" | "success" = "muted";
              let timeLeft = "—";
              if (team.selectionCompleted) {
                statusLabel = "Booked";
                statusVariant = "success";
              } else if (activeColor?.status === "reserved") {
                statusLabel = "Reserved";
                statusVariant = "accent";
                timeLeft = activeColor.remainingMs > 0 ? formatRemaining(activeColor.remainingMs) : "Expired";
              }

              return (
                <TableRow key={team.id}>
                  <TableCell>
                    <p className="font-medium">{team.name}</p>
                    {team.members && <p className="text-xs text-muted-foreground">{team.members}</p>}
                  </TableCell>
                  <TableCell>
                    <TableNumberCell team={team} token={token} onChanged={onChanged} />
                  </TableCell>
                  <TableCell>{team.category}</TableCell>
                  <TableCell>
                    {activeColor ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: activeColor.hexCode }} />
                        {activeColor.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  </TableCell>
                  <TableCell>{timeLeft}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => copyLink(team.invitationToken)} title="Copy invite link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ManageColorDialog team={team} colors={colors} token={token} onChanged={onChanged} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Delete team">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {team.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes the team, its votes, and its color reservation. This can't be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTeam(team.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  No teams yet. Run the participant seed script to import them.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
