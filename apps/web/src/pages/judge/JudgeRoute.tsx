import { useState } from "react";
import { JudgeTeam } from "@/lib/api";
import { JudgeGate } from "./JudgeGate";
import { TeamLookup } from "./TeamLookup";
import { ScoringFlow } from "./ScoringFlow";
import { JudgeThankYou } from "./JudgeThankYou";

const TOKEN_KEY = "foodfest_judge_token";
const NAME_KEY = "foodfest_judge_name";

type Stage = "lookup" | "scoring" | "done";

export default function JudgeRoute() {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [judgeName, setJudgeName] = useState<string | null>(localStorage.getItem(NAME_KEY));
  const [stage, setStage] = useState<Stage>("lookup");
  const [activeTeam, setActiveTeam] = useState<JudgeTeam | null>(null);

  if (!token || !judgeName) {
    return (
      <JudgeGate
        onReady={(newToken, newName) => {
          localStorage.setItem(TOKEN_KEY, newToken);
          localStorage.setItem(NAME_KEY, newName);
          setToken(newToken);
          setJudgeName(newName);
        }}
      />
    );
  }

  if (stage === "scoring" && activeTeam) {
    return (
      <ScoringFlow
        token={token}
        judgeName={judgeName}
        team={activeTeam}
        onDone={() => setStage("done")}
        onCancel={() => setStage("lookup")}
      />
    );
  }

  if (stage === "done" && activeTeam) {
    return (
      <JudgeThankYou
        team={activeTeam}
        onNext={() => {
          setActiveTeam(null);
          setStage("lookup");
        }}
      />
    );
  }

  return (
    <TeamLookup
      token={token}
      judgeName={judgeName}
      onFound={(team) => {
        setActiveTeam(team);
        setStage("scoring");
      }}
    />
  );
}
