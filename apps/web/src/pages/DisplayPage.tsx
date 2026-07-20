import { useMemo } from "react";
import { Clock, Trophy } from "lucide-react";
import { BrandHeader } from "@/components/shared/BrandHeader";
import { useResults } from "@/hooks/useResults";
import { formatRemaining } from "@/lib/format";

export default function DisplayPage() {
  const { results } = useResults();
  const ranked = useMemo(
    () => [...results.teams].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)),
    [results.teams]
  );
  const hidden = !results.showLiveResults && !results.voting.hasEnded;

  return (
    <div className="bg-brand-gradient min-h-screen w-full px-6 py-10 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <BrandHeader title="Taste of Bloom — Season 3" subtitle="Live voting results" className="items-start text-left sm:items-start" />
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
            <Clock className="h-5 w-5" />
            <span className="font-display text-2xl font-bold tabular-nums">{formatRemaining(results.voting.remainingMs)}</span>
          </div>
        </div>

        {hidden ? (
          <div className="rounded-2xl border border-white/15 bg-white/5 py-24 text-center text-lg text-white/80">
            Results are under wraps until voting ends — stay tuned!
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center">
                <p className="text-xs uppercase tracking-widest text-white/70">Total Votes</p>
                <p className="mt-1 font-display text-3xl font-bold">{results.totalVotes}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center">
                <p className="text-xs uppercase tracking-widest text-white/70">Leading Team</p>
                <p className="mt-1 font-display text-2xl font-bold">{results.leadingTeam?.name ?? "Waiting for votes"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {ranked.map((team, index) => {
                const percent = results.totalVotes ? Math.round(((team.votes ?? 0) / results.totalVotes) * 100) : 0;
                return (
                  <div key={team.id} className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-accent-foreground">
                      {index === 0 ? <Trophy className="h-5 w-5" /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <strong className="font-display">{team.name}</strong>
                        <span className="text-sm text-white/80">{team.votes ?? 0} votes</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <b className="w-12 text-right font-display text-lg">{percent}%</b>
                  </div>
                );
              })}
              {ranked.length === 0 && (
                <p className="py-12 text-center text-white/70">No teams to display yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
