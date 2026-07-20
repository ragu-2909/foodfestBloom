import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Ban, Lock } from "lucide-react";
import { toast } from "sonner";
import { Loader } from "@/components/shared/Loader";
import { PageBackground } from "@/components/shared/PageBackground";
import { api, ApiError, TeamInvite } from "@/lib/api";
import { useColorStream } from "@/hooks/useColorStream";
import { WelcomeIntro } from "./WelcomeIntro";
import { ColorGrid } from "./ColorGrid";
import { ThankYouReveal } from "./ThankYouReveal";
import { ClosedOrInvalid } from "./ClosedOrInvalid";

type ValidateResponse = {
  valid: boolean;
  team: TeamInvite;
  colorSelectionOpen: boolean;
  message?: string;
};

export default function ColorSelectionRoute() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [team, setTeam] = useState<TeamInvite | null>(null);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  const { colors, onlineTeams, closed } = useColorStream(team ? token : null);

  const refreshTeam = async () => {
    try {
      const data = await api<ValidateResponse>(`/colors/validate-token?token=${encodeURIComponent(token)}`);
      if (!data.valid) {
        setErrorMsg("Invalid invitation link. Please check your URL or contact the event organizers.");
        return;
      }
      setTeam(data.team);
      setSelectionOpen(data.colorSelectionOpen);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Couldn't verify your invitation. Please try again.");
    }
  };

  useEffect(() => {
    if (!token) {
      setErrorMsg("Invalid invitation link. Please check your URL or contact the event organizers.");
      setLoading(false);
      return;
    }
    refreshTeam().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (closed) setSelectionOpen(false);
  }, [closed]);

  // Once the color grid reports our team as booked, pull the full record
  // (color name/hex) to render the thank-you reveal.
  useEffect(() => {
    if (!team || team.selectionCompleted) return;
    const nowBooked = colors.some((c) => c.status === "booked" && c.bookedByTeamId === team.id);
    if (nowBooked) refreshTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, team]);

  const activeReservation = useMemo(
    () => (team ? colors.find((c) => c.status === "reserved" && c.reservedByTeamId === team.id) ?? null : null),
    [colors, team]
  );

  const handleReserve = async (colorId: string) => {
    try {
      await api("/colors/reserve", { method: "POST", body: JSON.stringify({ token, colorId }) });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reserve that color. Please try again.");
    }
  };

  const handleConfirm = async () => {
    if (!activeReservation) return;
    setSubmitting(true);
    try {
      await api("/colors/confirm", {
        method: "POST",
        body: JSON.stringify({ token, colorId: activeReservation.id })
      });
      await refreshTeam();
      toast.success("Color locked in!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't confirm your selection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnselect = async () => {
    setSubmitting(true);
    try {
      await api("/colors/release", { method: "POST", body: JSON.stringify({ token }) });
      toast.info("Reservation cancelled — pick another color anytime.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't cancel your hold. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageBackground>
        <Loader label="Verifying your invitation..." />
      </PageBackground>
    );
  }

  if (errorMsg) {
    return <ClosedOrInvalid icon={Ban} title="Invalid Link" message={errorMsg} />;
  }

  if (!team) return null;

  if (team.selectionCompleted) {
    return <ThankYouReveal team={team} />;
  }

  if (!selectionOpen) {
    return (
      <ClosedOrInvalid
        icon={Lock}
        title="Color Selection Isn't Open Yet"
        message="The color-selection window isn't currently active. Please check back once the organizers open it, or contact them for details."
      />
    );
  }

  if (welcomeStep === 1 || welcomeStep === 2) {
    return <WelcomeIntro step={welcomeStep} team={team} onNext={() => setWelcomeStep((s) => (s + 1) as 1 | 2 | 3)} />;
  }

  return (
    <ColorGrid
      teamName={team.name}
      teamId={team.id}
      colors={colors}
      onlineTeams={onlineTeams}
      submitting={submitting}
      onReserve={handleReserve}
      onConfirm={handleConfirm}
      onUnselect={handleUnselect}
    />
  );
}
