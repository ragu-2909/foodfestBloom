import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { PageBackground } from "@/components/shared/PageBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiError, JudgeTeam, ScoreCategories } from "@/lib/api";
import { cn } from "@/lib/utils";
import { categories } from "./categories";

const emptyScores: Partial<ScoreCategories> = {};

export function ScoringFlow({
  token,
  judgeName,
  team,
  onDone,
  onCancel
}: {
  token: string;
  judgeName: string;
  team: JudgeTeam;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Partial<ScoreCategories>>(emptyScores);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setStep(0);
    setScores({});
    api<ScoreCategories | null>(`/judge/scores/existing?teamId=${team.id}&judgeName=${encodeURIComponent(judgeName)}`, {
      token
    })
      .then((existing) => {
        if (existing) setScores(existing);
      })
      .catch(() => {});
  }, [team.id, judgeName, token]);

  const current = categories[step];
  const isLast = step === categories.length - 1;
  const currentValue = scores[current.key];

  const selectScore = (value: number) => {
    setScores((prev) => ({ ...prev, [current.key]: value }));
  };

  const goNext = async () => {
    if (currentValue === undefined) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }

    setSubmitting(true);
    try {
      await api("/judge/scores", {
        method: "POST",
        token,
        body: JSON.stringify({ teamId: team.id, judgeName, ...scores })
      });
      onDone();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't submit the score. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = current.icon;

  return (
    <PageBackground>
      <div className="mb-2 flex w-full max-w-sm items-center justify-between text-white">
        <button onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm text-white/80">
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Change table" : "Back"}
        </button>
        <span className="text-sm font-medium text-white/80">
          {step + 1} / {categories.length}
        </span>
      </div>

      <div className="mb-5 flex w-full max-w-sm gap-1.5">
        {categories.map((c, i) => (
          <div key={c.key} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-white/20")} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <Card className="border-transparent bg-card shadow-xl">
            <CardContent className="flex flex-col items-center gap-5 p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">{team.name} · Table {team.tableNumber}</p>
                <h2 className="mt-1 font-display text-xl font-bold text-foreground">{current.question}</h2>
              </div>

              <div className="grid w-full grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectScore(value)}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-xl border-2 text-lg font-bold transition-all",
                      currentValue === value
                        ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                        : "border-border text-foreground hover:border-primary/40"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <Button size="lg" className="w-full" disabled={currentValue === undefined || submitting} onClick={goNext}>
                {isLast ? (
                  <>
                    <Check className="h-4 w-4" /> {submitting ? "Submitting..." : "Submit Score"}
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </PageBackground>
  );
}
