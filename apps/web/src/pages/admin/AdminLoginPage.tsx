import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { PageBackground } from "@/components/shared/PageBackground";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export function AdminLoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await api<{ token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form))
      });
      localStorage.setItem("adminToken", response.token);
      onLogin(response.token);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBackground>
      <BrandHeader title="Admin Access" subtitle="Taste of Bloom — Event Control" />
      <Card className="mt-8 w-full max-w-sm border-transparent bg-card shadow-xl">
        <CardContent className="p-6">
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button size="lg" disabled={busy} className="mt-1">
              <LogIn className="h-4 w-4" />
              {busy ? "Signing in..." : "Log In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageBackground>
  );
}
