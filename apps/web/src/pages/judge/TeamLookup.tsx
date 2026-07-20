import { FormEvent, useState } from "react";
import { QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { PageBackground } from "@/components/shared/PageBackground";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, JudgeTeam } from "@/lib/api";
import { QrScanner } from "./QrScanner";

export function TeamLookup({
  token,
  judgeName,
  onFound
}: {
  token: string;
  judgeName: string;
  onFound: (team: JudgeTeam) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const lookup = async (table: number) => {
    setBusy(true);
    try {
      const team = await api<JudgeTeam>(`/judge/teams/lookup?table=${table}`, { token });
      onFound(team);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't find that table.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const table = Number(new FormData(event.currentTarget).get("table"));
    if (table > 0) lookup(table);
  };

  return (
    <PageBackground>
      <BrandHeader title="Find a Table" subtitle={`Judging as ${judgeName}`} />
      <Card className="mt-8 w-full max-w-sm border-transparent bg-card shadow-xl">
        <CardContent className="flex flex-col gap-5 p-6">
          <Button size="lg" variant="accent" disabled={busy} onClick={() => setScannerOpen(true)}>
            <QrCode className="h-5 w-5" /> Scan Table QR Code
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or enter manually <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table">Table number</Label>
              <Input id="table" name="table" type="number" inputMode="numeric" min={1} placeholder="e.g. 7" required />
            </div>
            <Button type="submit" size="lg" variant="outline" disabled={busy}>
              <Search className="h-4 w-4" /> {busy ? "Looking up..." : "Find Table"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          {scannerOpen && (
            <QrScanner
              onResult={(table) => {
                setScannerOpen(false);
                lookup(table);
              }}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageBackground>
  );
}
