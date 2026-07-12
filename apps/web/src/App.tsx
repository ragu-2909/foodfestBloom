import {
  Activity,
  BarChart3,
  Download,
  LogIn,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Square,
  Trash2,
  UserCheck,
  Vote
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_URL, ApiError, Results, Team, api, downloadReport } from "./api";

type Notice = { tone: "success" | "error" | "info"; text: string };

const initialResults: Results = {
  generatedAt: new Date().toISOString(),
  totalVotes: 0,
  leadingTeam: null,
  teams: [],
  voting: {
    votingOpen: false,
    hasStarted: false,
    hasEnded: true,
    serverTime: new Date().toISOString(),
    startTime: null,
    endTime: null,
    remainingMs: 0
  },
  showLiveResults: true
};

const useResults = () => {
  const [results, setResults] = useState<Results>(initialResults);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let polling: number | undefined;
    const source = new EventSource(`${API_URL}/events/stream`);

    source.addEventListener("results", (event) => {
      setConnected(true);
      setResults(JSON.parse((event as MessageEvent).data));
    });

    source.onerror = () => {
      setConnected(false);
      if (!polling) {
        polling = window.setInterval(async () => {
          try {
            setResults(await api<Results>("/results"));
          } catch {
            setConnected(false);
          }
        }, 4000);
      }
    };

    return () => {
      source.close();
      if (polling) window.clearInterval(polling);
    };
  }, []);

  return { results, connected };
};

const formatRemaining = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const NoticeView = ({ notice }: { notice: Notice | null }) =>
  notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null;

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="shell">
    <nav className="topbar">
      <a href="/register">Register</a>
      <a href="/vote">Vote</a>
      <a href="/display">Display</a>
      <a href="/admin">Admin</a>
    </nav>
    {children}
  </main>
);

const Hero = ({ title, kicker }: { title: string; kicker: string }) => (
  <section className="hero">
    <div>
      <p>{kicker}</p>
      <h1>{title}</h1>
    </div>
  </section>
);

function RegisterPage() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);

    try {
      await api("/register", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form))
      });
      event.currentTarget.reset();
      setNotice({ tone: "success", text: "Registration submitted successfully." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Submission failed. Please try again."
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Hero title="Food Fest Registration" kicker="Company Event" />
      <form className="panel form-grid" onSubmit={submit}>
        <label>
          Company Email
          <input name="email" type="email" required />
        </label>
        <label>
          Employee Name
          <input name="employeeName" required />
        </label>
        <label>
          Team Name
          <input name="teamName" required />
        </label>
        <label>
          Food Category
          <input name="foodCategory" required />
        </label>
        <label>
          Contact Number
          <input name="contactNumber" required />
        </label>
        <label className="wide">
          Team Members
          <textarea name="teamMembers" required rows={3} />
        </label>
        <label className="wide">
          Optional Description
          <textarea name="description" rows={3} />
        </label>
        <button className="primary wide" disabled={busy}>
          <UserCheck size={18} />
          {busy ? "Submitting" : "Submit Registration"}
        </button>
        <NoticeView notice={notice} />
      </form>
    </Shell>
  );
}

function VotePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const { results } = useResults();
  const localVoted = localStorage.getItem("voted") === "true";

  useEffect(() => {
    api<Team[]>("/teams").then(setTeams).catch(() => setTeams([]));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (localStorage.getItem("voted") === "true") {
      setNotice({ tone: "info", text: "You have already voted." });
      return;
    }

    setBusy(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);

    try {
      await api("/vote", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), teamId: selected })
      });
      localStorage.setItem("voted", "true");
      setNotice({ tone: "success", text: "Vote submitted successfully." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Submission failed. Please try again."
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Hero title="Cast Your Vote" kicker={formatRemaining(results.voting.remainingMs)} />
      <form className="panel vote-flow" onSubmit={submit}>
        <label>
          Company Email
          <input name="email" type="email" required disabled={localVoted} />
        </label>
        <div className="team-grid">
          {teams.map((team) => (
            <button
              type="button"
              className={`team-choice ${selected === team.id ? "selected" : ""}`}
              key={team.id}
              onClick={() => setSelected(team.id)}
              disabled={localVoted}
            >
              <span>{team.category}</span>
              <strong>{team.name}</strong>
              <small>{team.description}</small>
            </button>
          ))}
        </div>
        <button className="primary" disabled={busy || !selected || localVoted}>
          <Vote size={18} />
          {busy ? "Submitting" : localVoted ? "Already Voted" : "Submit Vote"}
        </button>
        <NoticeView notice={notice} />
      </form>
    </Shell>
  );
}

function ResultsBoard({ fullscreen = false }: { fullscreen?: boolean }) {
  const { results, connected } = useResults();
  const ranked = useMemo(() => [...results.teams].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)), [
    results.teams
  ]);
  const hidden = !results.showLiveResults && !results.voting.hasEnded;

  return (
    <section className={fullscreen ? "display-board" : "panel"}>
      <div className="board-head">
        <div>
          <p>{connected ? "Live" : "Polling"}</p>
          <h1>FOOD FEST LIVE</h1>
        </div>
        <div className="timer">{formatRemaining(results.voting.remainingMs)}</div>
      </div>
      {hidden ? (
        <div className="hidden-results">Results hidden</div>
      ) : (
        <>
          <div className="stat-strip">
            <div>
              <span>Votes</span>
              <strong>{results.totalVotes}</strong>
            </div>
            <div>
              <span>Leader</span>
              <strong>{results.leadingTeam?.name ?? "Waiting"}</strong>
            </div>
          </div>
          <div className="leaderboard">
            {ranked.map((team, index) => {
              const percent = results.totalVotes
                ? Math.round(((team.votes ?? 0) / results.totalVotes) * 100)
                : 0;
              return (
                <article className="rank-row" key={team.id}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <div className="rank-label">
                      <strong>{team.name}</strong>
                      <span>{team.votes ?? 0} votes</span>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <b>{percent}%</b>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

type Dashboard = {
  metrics: { registrations: number; votes: number; teams: number };
  settings: Record<string, unknown>;
  recentActivity: { action: string; email: string | null; status: number; createdAt: string }[];
};

function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem("adminToken"));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [registrations, setRegistrations] = useState<Record<string, string>[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const load = async (activeToken = token) => {
    if (!activeToken) return;
    const [dash, regs, teamRows] = await Promise.all([
      api<Dashboard>("/admin/dashboard", { token: activeToken }),
      api<Record<string, string>[]>("/admin/registrations", { token: activeToken }),
      api<Team[]>("/admin/teams", { token: activeToken })
    ]);
    setDashboard(dash);
    setRegistrations(regs);
    setTeams(teamRows);
  };

  useEffect(() => {
    load().catch(() => setToken(null));
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await api<{ token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form))
      });
      localStorage.setItem("adminToken", response.token);
      setToken(response.token);
      await load(response.token);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Login failed."
      });
    }
  };

  const command = async (path: string, body?: unknown) => {
    if (!token) return;
    try {
      await api(path, {
        method: "POST",
        token,
        body: body ? JSON.stringify(body) : undefined
      });
      await load();
      setNotice({ tone: "success", text: "Saved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof ApiError ? error.message : "Action failed." });
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    await api("/admin/settings", {
      method: "PUT",
      token,
      body: JSON.stringify({
        eventName: form.get("eventName"),
        registrationOpen: form.get("registrationOpen") === "on",
        showLiveResults: form.get("showLiveResults") === "on"
      })
    });
    await load();
    setNotice({ tone: "success", text: "Settings saved." });
  };

  const addTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    await api("/admin/addTeam", {
      method: "POST",
      token,
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
    });
    event.currentTarget.reset();
    await load();
    setNotice({ tone: "success", text: "Team added." });
  };

  if (!token) {
    return (
      <Shell>
        <Hero title="Admin Login" kicker="Event Control" />
        <form className="panel form-grid compact" onSubmit={login}>
          <label>
            Admin Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button className="primary wide">
            <LogIn size={18} />
            Log In
          </button>
          <NoticeView notice={notice} />
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <Hero title="Admin Dashboard" kicker="Live Operations" />
      <section className="dashboard">
        <div className="metric">
          <Activity />
          <span>Registrations</span>
          <strong>{dashboard?.metrics.registrations ?? 0}</strong>
        </div>
        <div className="metric">
          <Vote />
          <span>Votes</span>
          <strong>{dashboard?.metrics.votes ?? 0}</strong>
        </div>
        <div className="metric">
          <BarChart3 />
          <span>Teams</span>
          <strong>{dashboard?.metrics.teams ?? 0}</strong>
        </div>
      </section>

      <section className="panel admin-grid">
        <button onClick={() => command("/admin/startRegistration")}><Play size={16} /> Start Registration</button>
        <button onClick={() => command("/admin/stopRegistration")}><Square size={16} /> Stop Registration</button>
        <button onClick={() => command("/admin/startVoting", { durationMinutes: 10 })}><Play size={16} /> Start Voting</button>
        <button onClick={() => command("/admin/stopVoting")}><Square size={16} /> Stop Voting</button>
        <button onClick={() => load()}><RefreshCcw size={16} /> Refresh</button>
        <button className="danger" onClick={() => command("/admin/resetEvent")}><Trash2 size={16} /> Reset Event</button>
      </section>

      <form className="panel form-grid" onSubmit={saveSettings}>
        <label className="wide">
          Event Name
          <input name="eventName" defaultValue={String(dashboard?.settings.event_name ?? "Food Fest Live")} />
        </label>
        <label className="toggle">
          <input name="registrationOpen" type="checkbox" defaultChecked={dashboard?.settings.registration_open === true} />
          Registration Open
        </label>
        <label className="toggle">
          <input name="showLiveResults" type="checkbox" defaultChecked={dashboard?.settings.show_live_results !== false} />
          Show Live Results
        </label>
        <button className="primary wide"><Save size={18} /> Save Settings</button>
      </form>

      <form className="panel form-grid" onSubmit={addTeam}>
        <h2 className="wide">Team Management</h2>
        <input name="name" placeholder="Team name" required />
        <input name="category" placeholder="Category" required />
        <input name="imageUrl" placeholder="Image URL" />
        <input name="members" placeholder="Team members" />
        <textarea className="wide" name="description" placeholder="Description" rows={2} />
        <button className="primary wide"><Plus size={18} /> Add Team</button>
      </form>

      <section className="panel table-panel">
        <div className="section-head">
          <h2>Reports</h2>
          <div>
            <button onClick={() => downloadReport("/export/csv", token, "foodfest-report.csv")}><Download size={16} /> CSV</button>
            <button onClick={() => downloadReport("/export/excel", token, "foodfest-report.xls")}><Download size={16} /> Excel</button>
            <button onClick={() => downloadReport("/export/pdf", token, "foodfest-report.pdf")}><Download size={16} /> PDF</button>
          </div>
        </div>
        <NoticeView notice={notice} />
      </section>

      <section className="panel table-panel">
        <h2>Teams</h2>
        {teams.map((team) => (
          <div className="list-row" key={team.id}>
            <strong>{team.name}</strong>
            <span>{team.category}</span>
          </div>
        ))}
      </section>

      <section className="panel table-panel">
        <h2>Registrations</h2>
        {registrations.slice(0, 12).map((registration) => (
          <div className="list-row" key={registration.id}>
            <strong>{registration.employeeName}</strong>
            <span>{registration.email}</span>
          </div>
        ))}
      </section>
    </Shell>
  );
}

export default function App() {
  const page = window.location.pathname.split("/")[1] || "register";

  if (page === "vote") return <VotePage />;
  if (page === "display") return <ResultsBoard fullscreen />;
  if (page === "admin") return <AdminPage />;
  return <RegisterPage />;
}
