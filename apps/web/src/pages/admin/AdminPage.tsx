import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { AdminDashboard, Team, api } from "@/lib/api";
import { useColorStream } from "@/hooks/useColorStream";
import { usePublicSettings } from "@/hooks/usePublicSettings";
import { AdminLoginPage } from "./AdminLoginPage";
import { StatusCards } from "./StatusCards";
import { KpiRow } from "./KpiRow";
import { OperationsPanel } from "./OperationsPanel";
import { ColorPaletteManager } from "./ColorPaletteManager";
import { ParticipantsTable } from "./ParticipantsTable";
import { ActivityFeed } from "./ActivityFeed";
import { JudgeScoresPanel } from "./JudgeScoresPanel";
import { ExportsPanel } from "./ExportsPanel";
import { EventSettingsPanel } from "./EventSettingsPanel";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("adminToken"));
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadTick, setLoadTick] = useState(0);

  const { colors } = useColorStream(token);
  const settings = usePublicSettings();

  const load = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    try {
      const [dash, teamRows] = await Promise.all([
        api<AdminDashboard>("/admin/dashboard", { token: activeToken }),
        api<Team[]>("/admin/teams", { token: activeToken })
      ]);
      setDashboard(dash);
      setTeams(teamRows);
      setLoadTick((t) => t + 1);
    } catch {
      logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const logout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
    setDashboard(null);
    setTeams([]);
  };

  if (!token) {
    return (
      <AdminLoginPage
        onLogin={(newToken) => {
          setToken(newToken);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-brand-gradient px-4 py-6 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandHeader
            title={typeof dashboard?.settings.event_name === "string" ? dashboard.settings.event_name : "Taste of Bloom"}
            subtitle="Admin Control Center"
            className="items-start text-left"
          />
          <Button variant="secondary" onClick={logout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
        <StatusCards settings={settings} />
        <KpiRow dashboard={dashboard} colors={colors} />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <OperationsPanel token={token} onChanged={() => load()} />
            <ColorPaletteManager token={token} colors={colors} onChanged={() => load()} />
            <EventSettingsPanel token={token} dashboard={dashboard} onChanged={() => load()} />
            <ExportsPanel token={token} />
          </div>
          <ActivityFeed activity={dashboard?.recentActivity ?? []} />
        </div>

        <ParticipantsTable token={token} teams={teams} colors={colors} onChanged={() => load()} />
        <JudgeScoresPanel token={token} refreshKey={loadTick} />
      </div>
    </div>
  );
}
