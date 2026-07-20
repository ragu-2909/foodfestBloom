import { motion } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { PageBackground } from "@/components/shared/PageBackground";
import { Card, CardContent } from "@/components/ui/card";
import { TeamInvite } from "@/lib/api";

export function ThankYouReveal({ team }: { team: TeamInvite }) {
  const memberList = team.members ? team.members.split(",").map((m) => m.trim()).filter(Boolean) : [];

  return (
    <PageBackground>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full">
        <Card className="w-full border-transparent bg-card shadow-xl">
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
            <motion.div
              initial={{ rotate: -15, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent"
            >
              <PartyPopper className="h-8 w-8" />
            </motion.div>

            <div>
              <h1 className="font-display text-2xl font-bold">You're all set, {team.name}!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your color is locked in. See you at the stove — let's make Taste of Bloom Season 3 unforgettable.
              </p>
            </div>

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 180 }}
              className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/40 p-6"
            >
              <div
                className="h-24 w-24 rounded-full border-4 border-white shadow-lg"
                style={{ backgroundColor: team.selectedColorHex ?? "#ccc" }}
              />
              <div>
                <p className="font-display text-lg font-bold">{team.selectedColorName ?? "Your color"}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{team.selectedColorHex}</p>
              </div>
            </motion.div>

            {memberList.length > 0 && (
              <div className="w-full rounded-xl border bg-muted/30 p-4 text-left text-sm">
                <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Team Roster</p>
                <p>{memberList.join(", ")}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Get your apron ready — we'll see you at the event!</p>
          </CardContent>
        </Card>
      </motion.div>
    </PageBackground>
  );
}
