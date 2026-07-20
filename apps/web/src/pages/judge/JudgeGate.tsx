import { FormEvent, useState } from "react";
import { Gavel } from "lucide-react";
import { toast } from "sonner";
import { PageBackground } from "@/components/shared/PageBackground";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export function JudgeGate({ onReady }: { onReady: (token: string, judgeName: string) => void }) {
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget)) as { judgeName: string; passcode: string };
    try {
      const response = await api<{ token: string; judgeName: string }>("/judge/login", {
        method: "POST",
        body: JSON.stringify(form)
      });
      onReady(response.token, response.judgeName);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBackground>
      <BrandHeader title="Judge Panel" subtitle="Taste of Bloom — Season 3" />
      <Card className="mt-8 w-full max-w-sm border-transparent bg-card shadow-xl">
        <CardContent className="p-6">
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="judgeName">Your name</Label>
              <Input id="judgeName" name="judgeName" placeholder="e.g. Priya" autoComplete="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passcode">Judging passcode</Label>
              <Input id="passcode" name="passcode" type="password" inputMode="numeric" placeholder="Ask the organizers" required />
            </div>
            <Button size="lg" disabled={busy} className="mt-1">
              <Gavel className="h-4 w-4" />
              {busy ? "Signing in..." : "Start Judging"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageBackground>
  );
}
