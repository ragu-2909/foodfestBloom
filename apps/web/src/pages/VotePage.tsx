import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Vote as VoteIcon } from "lucide-react";
import { toast } from "sonner";
import { PageBackground } from "@/components/shared/PageBackground";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { PublicNav } from "@/components/shared/PublicNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useResults } from "@/hooks/useResults";
import { api, ApiError, Team, getOrCreateVoterId } from "@/lib/api";
import { formatRemaining } from "@/lib/format";

const VOTED_KEY = "foodfest_has_voted";

export default function VotePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [voted, setVoted] = useState(localStorage.getItem(VOTED_KEY) === "true");
  const { results } = useResults();

  useEffect(() => {
    api<Team[]>("/teams").then(setTeams).catch(() => setTeams([]));
  }, []);

  const voting = results.voting;
  const canVote = voting.hasStarted && !voting.hasEnded && !voted;

  const submit = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await api("/vote", {
        method: "POST",
        body: JSON.stringify({ email: getOrCreateVoterId(), teamId: selected })
      });
      localStorage.setItem(VOTED_KEY, "true");
      setVoted(true);
      toast.success("Your vote is in — thank you for tasting responsibly!");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        localStorage.setItem(VOTED_KEY, "true");
        setVoted(true);
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't submit your vote. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (voted) return { label: "Vote recorded", tone: "success" as const };
    if (!voting.hasStarted) return { label: "Voting opens soon", tone: "muted" as const };
    if (voting.hasEnded) return { label: "Voting closed", tone: "muted" as const };
    return { label: "Live now", tone: "accent" as const };
  }, [voted, voting.hasStarted, voting.hasEnded]);

  return (
    <PageBackground className="!max-w-none">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <PublicNav />
        <BrandHeader
          title="Cast Your Vote"
          subtitle="Where Bloom's best cooks turn up the flavor — pick the plate that stole the show."
        />

        <div className="mt-6 flex items-center gap-3">
          <Badge variant={statusBadge.tone === "success" ? "success" : statusBadge.tone === "accent" ? "accent" : "muted"}>
            {statusBadge.label}
          </Badge>
          {voting.hasStarted && !voting.hasEnded && (
            <span className="flex items-center gap-1.5 text-sm text-white/85">
              <Clock className="h-4 w-4" /> {formatRemaining(voting.remainingMs)} remaining
            </span>
          )}
        </div>

        <Card className="mt-8 w-full border-transparent bg-card shadow-xl">
          <CardContent className="p-5 sm:p-6">
            {voted ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <h2 className="font-display text-xl font-semibold">Thanks for voting!</h2>
                <p className="text-sm text-muted-foreground">
                  Your vote has been counted. Check the live results board for updates.
                </p>
              </div>
            ) : !voting.hasStarted ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Voting hasn't opened yet — hang tight, the flavors are still being judged.
              </div>
            ) : voting.hasEnded ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Voting has closed. Thanks for being part of Taste of Bloom!
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {teams.map((team) => {
                    const isSelected = selected === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelected(team.id)}
                        className={`relative flex flex-col items-start gap-1.5 rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/80 hover:border-primary/40"
                        }`}
                      >
                        {isSelected && (
                          <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wide text-accent">{team.category}</span>
                        <span className="font-display text-lg font-semibold text-foreground">{team.name}</span>
                        {team.description && <span className="text-xs text-muted-foreground">{team.description}</span>}
                      </button>
                    );
                  })}
                  {teams.length === 0 && (
                    <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">
                      No teams available to vote for yet.
                    </p>
                  )}
                </div>
                <Button size="lg" disabled={!selected || busy || !canVote} onClick={submit} className="w-full">
                  <VoteIcon className="h-4 w-4" />
                  {busy ? "Submitting..." : "Submit Vote"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageBackground>
  );
}
