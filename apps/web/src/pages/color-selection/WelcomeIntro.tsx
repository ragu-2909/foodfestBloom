import { motion } from "framer-motion";
import { ChefHat, PartyPopper, Sparkles, Timer } from "lucide-react";
import { PageBackground } from "@/components/shared/PageBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeamInvite } from "@/lib/api";

export function WelcomeIntro({
  step,
  team,
  onNext
}: {
  step: 1 | 2;
  team: TeamInvite;
  onNext: () => void;
}) {
  const memberList = team.members ? team.members.split(",").map((m) => m.trim()).filter(Boolean) : [];

  return (
    <PageBackground>
      <div className="mb-6 flex items-center gap-2">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                step >= n ? "bg-accent text-accent-foreground" : "bg-white/15 text-white/60"
              }`}
            >
              {n}
            </div>
            {n < 2 && <div className={`h-0.5 w-10 ${step > n ? "bg-accent" : "bg-white/15"}`} />}
          </div>
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full"
      >
        <Card className="w-full border-transparent bg-card shadow-xl">
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
            {step === 1 && (
              <>
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <PartyPopper className="h-10 w-10" />
                </motion.div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground">Welcome, {team.name}!</h2>
                  <p className="mt-1 text-muted-foreground">
                    Thank you for registering for <strong className="text-foreground">Taste of Bloom, Season 3</strong>.
                    We're thrilled to have you cooking with us.
                  </p>
                </div>
                {memberList.length > 0 && (
                  <div className="w-full rounded-xl border bg-muted/50 p-4 text-left text-sm">
                    <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Team Roster</p>
                    <p className="text-foreground">{memberList.join(", ")}</p>
                  </div>
                )}
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ChefHat className="h-4 w-4 text-accent" />
                  Next up — let's lock in the color that represents your team on the big day.
                </p>
                <Button size="lg" className="w-full" onClick={onNext}>
                  Continue
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <Sparkles className="h-10 w-10" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">"Book your color fast and cook peacefully!"</h2>
                <ul className="w-full space-y-2 text-left text-sm text-foreground">
                  <li className="flex items-start gap-2">
                    <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    Selecting a color places a <strong>2-minute hold</strong> on it — nobody else can take it while you decide.
                  </li>
                  <li className="flex items-start gap-2">
                    <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    Confirm within those 2 minutes to lock it in — or hit <strong>Unselect</strong> any time to cancel and choose again.
                  </li>
                  <li className="flex items-start gap-2">
                    <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    If time runs out, the hold is released automatically and the color returns to the pool.
                  </li>
                  <li className="flex items-start gap-2">
                    <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    Once confirmed, your color choice is <strong>final and locked</strong>.
                  </li>
                </ul>
                <Button size="lg" className="w-full" onClick={onNext}>
                  Enter Color Selection
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </PageBackground>
  );
}
