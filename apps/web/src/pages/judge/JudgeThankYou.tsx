import { motion } from "framer-motion";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { PageBackground } from "@/components/shared/PageBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JudgeTeam } from "@/lib/api";

export function JudgeThankYou({ team, onNext }: { team: JudgeTeam; onNext: () => void }) {
  return (
    <PageBackground>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
        <Card className="border-transparent bg-card shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
            >
              <CheckCircle2 className="h-9 w-9" />
            </motion.div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Score saved!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your scores for <strong>{team.name}</strong> (Table {team.tableNumber}) are in.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={onNext}>
              <RotateCcw className="h-4 w-4" /> Score Another Team
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </PageBackground>
  );
}
