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
  Upload,
  UserCheck,
  Vote,
  Copy,
  Palette,
  Lock,
  Unlock,
  CheckCircle2,
  Video,
  Check
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

const Shell = ({ children, showNav = true }: { children: React.ReactNode; showNav?: boolean }) => (
  <main className="shell">
    {showNav && (
      <nav className="topbar">
        <a href="/vote">Vote</a>
        <a href="/display">Display</a>
        <a href="/admin">Admin</a>
      </nav>
    )}
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
    <Shell showNav={false}>
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
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamFormNotice, setTeamFormNotice] = useState<Notice | null>(null);
  const [excelNotice, setExcelNotice] = useState<Notice | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const { results } = useResults();
  const [colors, setColors] = useState<any[]>([]);

  const load = async (activeToken = token) => {
    if (!activeToken) return;
    const [dash, regs, teamRows, colorRows] = await Promise.all([
      api<Dashboard>("/admin/dashboard", { token: activeToken }),
      api<Record<string, string>[]>("/admin/registrations", { token: activeToken }),
      api<Team[]>("/admin/teams", { token: activeToken }),
      api<any[]>("/colors/state")
    ]);
    setDashboard(dash);
    setRegistrations(regs);
    setTeams(teamRows);
    setColors(colorRows);
  };

  useEffect(() => {
    load().catch(() => setToken(null));
  }, []);

  // Connect to colors stream for live admin updates
  useEffect(() => {
    if (!token) return;
    const source = new EventSource(`${API_URL}/colors/stream?token=${token}`);
    
    source.addEventListener("color_event", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      if (payload.colors) {
        setColors(payload.colors);
      }
    });
    
    return () => {
      source.close();
    };
  }, [token]);

  const addColor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    try {
      await api("/admin/colors", {
        method: "POST",
        token,
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      form.reset();
      await load();
      setNotice({ tone: "success", text: "New color option added." });
      setTimeout(() => setNotice(null), 3000);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof ApiError ? error.message : "Failed to add color." });
    }
  };

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
    setRunningCommand(path);
    try {
      await api(path, {
        method: "POST",
        token,
        body: body ? JSON.stringify(body) : undefined
      });
      await load();
      setNotice({ tone: "success", text: "Operation completed successfully." });
      setTimeout(() => setNotice(null), 3000);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof ApiError ? error.message : "Action failed." });
    } finally {
      setRunningCommand(null);
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

  const submitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setTeamFormNotice(null);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const imageUrl = formData.get("imageUrl") as string;
    const description = formData.get("description") as string;

    const m1 = formData.get("member1") as string;
    const m2 = formData.get("member2") as string;
    const m3 = formData.get("member3") as string;

    const members = [m1, m2, m3].map(m => m?.trim()).filter(Boolean).join(", ");

    const payload = {
      name,
      category,
      imageUrl,
      description,
      members
    };

    try {
      if (editingTeam) {
        await api(`/admin/editTeam/${editingTeam.id}`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload)
        });
        setTeamFormNotice({ tone: "success", text: "Team updated successfully." });
      } else {
        await api("/admin/addTeam", {
          method: "POST",
          token,
          body: JSON.stringify(payload)
        });
        setTeamFormNotice({ tone: "success", text: "Team added successfully." });
      }
      setEditingTeam(null);
      event.currentTarget.reset();
      await load();
    } catch (error) {
      setTeamFormNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to save team."
      });
    }
  };

  const deleteTeam = async (id: string) => {
    if (!token) return;
    if (!window.confirm("Are you sure you want to delete this team? All associated votes will be deleted.")) return;

    try {
      await api(`/admin/deleteTeam/${id}`, {
        method: "DELETE",
        token
      });
      await load();
      setNotice({ tone: "success", text: "Team deleted successfully." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof ApiError ? error.message : "Failed to delete team."
      });
    }
  };

  const uploadExcel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setExcelNotice({ tone: "error", text: "Please select a file first." });
      return;
    }

    setExcelBusy(true);
    setExcelNotice(null);
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
      const data = await api<{ message: string }>("/admin/import-excel", {
        method: "POST",
        token,
        body: formData
      });
      setExcelNotice({ tone: "success", text: data.message });
      form.reset();
      await load();
    } catch (error: any) {
      setExcelNotice({ tone: "error", text: error.message || "Upload failed." });
    } finally {
      setExcelBusy(false);
    }
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
      <Hero title="Admin Panel" kicker={dashboard?.settings.event_name ? String(dashboard.settings.event_name) : "Food Fest Live"} />

      {/* Real-time Status Indicators */}
      <section className="status-grid">
        <div className="status-card">
          <div className="status-header">
            <h3>Registration Portal</h3>
            <span className={`status-badge ${dashboard?.settings.registration_open ? "active" : "closed"}`}>
              {dashboard?.settings.registration_open ? "Open" : "Closed"}
            </span>
          </div>
          <p className="status-detail">
            {dashboard?.settings.registration_open 
              ? "Participants are able to register (Public registration is hidden, but active)." 
              : "Registration is locked. Standard user signups are disabled."}
          </p>
        </div>

        <div className="status-card">
          <div className="status-header">
            <h3>Voting Session</h3>
            <span className={`status-badge ${results.voting.votingOpen && results.voting.hasStarted && !results.voting.hasEnded ? "active" : "closed"}`}>
              {results.voting.votingOpen && results.voting.hasStarted && !results.voting.hasEnded ? "Live" : "Inactive"}
            </span>
          </div>
          <p className="status-detail">
            {results.voting.votingOpen && results.voting.hasStarted && !results.voting.hasEnded
              ? `Live voting is currently underway. Time remaining: ${formatRemaining(results.voting.remainingMs)}`
              : "Voting is closed. Voters cannot submit selections."}
          </p>
        </div>

        <div className="status-card">
          <div className="status-header">
            <h3>Color Selection</h3>
            <span className={`status-badge ${dashboard?.settings.color_selection_open ? "active" : "closed"}`}>
              {dashboard?.settings.color_selection_open ? "Open" : "Closed"}
            </span>
          </div>
          <p className="status-detail">
            {dashboard?.settings.color_selection_open
              ? "Teams can access their links to select and reserve colors."
              : "Color selection has not started or has ended."}
          </p>
        </div>
      </section>

      {/* KPI Metrics */}
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
        <div className="metric">
          <Palette />
          <span>Available Colors</span>
          <strong>{colors.filter(c => c.status === "available").length}</strong>
        </div>
        <div className="metric">
          <Lock />
          <span>Booked Colors</span>
          <strong>{colors.filter(c => c.status === "booked").length}</strong>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="dashboard-layout">
        
        {/* Column 1: Controls & Settings */}
        <div className="dashboard-column">
          <section className="panel">
            <h2>Operations Control</h2>
            <div className="admin-grid">
              <button 
                onClick={() => command("/admin/startRegistration")} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                {runningCommand === "/admin/startRegistration" ? "Opening..." : <><Play size={15} /> Start Registration</>}
              </button>
              <button 
                onClick={() => command("/admin/stopRegistration")} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                {runningCommand === "/admin/stopRegistration" ? "Closing..." : <><Square size={15} /> Stop Registration</>}
              </button>
              <button 
                onClick={() => command("/admin/startColorSelection")} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                {runningCommand === "/admin/startColorSelection" ? "Starting..." : <><Play size={15} /> Start Color Selection</>}
              </button>
              <button 
                onClick={() => command("/admin/stopColorSelection")} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                {runningCommand === "/admin/stopColorSelection" ? "Stopping..." : <><Square size={15} /> Stop Color Selection</>}
              </button>
              <button 
                onClick={() => command("/admin/startVoting", { durationMinutes: 10 })} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                {runningCommand === "/admin/startVoting" ? "Starting..." : <><Play size={15} /> Start Voting</>}
              </button>
              <button 
                onClick={() => command("/admin/stopVoting")} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                {runningCommand === "/admin/stopVoting" ? "Stopping..." : <><Square size={15} /> Stop Voting</>}
              </button>
              <button 
                onClick={() => load()} 
                disabled={runningCommand !== null}
                className="control-btn"
              >
                <RefreshCcw size={15} /> Refresh Data
              </button>
              <button 
                className="danger control-btn" 
                onClick={() => command("/admin/resetEvent")} 
                disabled={runningCommand !== null}
              >
                {runningCommand === "/admin/resetEvent" ? "Resetting..." : <><Trash2 size={15} /> Reset Event</>}
              </button>
            </div>
          </section>

          <form className="panel form-grid" onSubmit={saveSettings}>
            <h2>Event Configuration</h2>
            <label className="wide">
              Event Display Name
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
            <label className="toggle">
              <input name="colorSelectionOpen" type="checkbox" defaultChecked={dashboard?.settings.color_selection_open === true} />
              Color Selection Open
            </label>
            <button className="primary wide"><Save size={18} /> Save Settings</button>
          </form>

          <form className="panel form-grid" onSubmit={addColor}>
            <h2>Add Custom Color</h2>
            <label>
              Color Name
              <input name="name" placeholder="e.g. Amber Gold" required />
            </label>
            <label>
              Hex Code (with #)
              <input name="hexCode" placeholder="e.g. #F59E0B" required />
            </label>
            <button className="primary wide"><Plus size={18} /> Add Color</button>
          </form>

          <form className="panel form-grid" onSubmit={uploadExcel}>
            <h2>Bulk Excel Import</h2>
            <p className="excel-info-text">
              Upload an Excel (.xlsx, .xls) or CSV file. First sheet is parsed.
              Supported columns: <strong>Team Name, Category, Lead Email, Lead Name, Contact Number, Member 1, Member 2, Member 3, Description</strong>.
            </p>
            <label className="wide file-upload-label">
              Select Excel/CSV File
              <input name="file" type="file" accept=".xlsx,.xls,.csv" required disabled={excelBusy} />
            </label>
            <button className="primary wide" disabled={excelBusy}>
              <Upload size={18} />
              {excelBusy ? "Importing..." : "Upload & Import"}
            </button>
            <NoticeView notice={excelNotice} />
          </form>
        </div>

        {/* Column 2: Team Management */}
        <div className="dashboard-column">
          <form key={editingTeam ? editingTeam.id : "new"} className="panel form-grid" onSubmit={submitTeam}>
            <h2 id="team-form-heading">
              {editingTeam ? `Edit Team: ${editingTeam.name}` : "Add New Team"}
            </h2>
            <label>
              Team Name
              <input name="name" defaultValue={editingTeam?.name || ""} required />
            </label>
            <label>
              Category
              <input name="category" defaultValue={editingTeam?.category || ""} required />
            </label>
            <label className="wide">
              Image URL
              <input name="imageUrl" defaultValue={editingTeam?.imageUrl || ""} />
            </label>
            <div className="wide grid-3-cols">
              <label>
                Team Lead (Member 1)
                <input name="member1" defaultValue={editingTeam?.members ? editingTeam.members.split(",")[0]?.trim() : ""} required />
              </label>
              <label>
                Member 2
                <input name="member2" defaultValue={editingTeam?.members ? editingTeam.members.split(",")[1]?.trim() : ""} />
              </label>
              <label>
                Member 3
                <input name="member3" defaultValue={editingTeam?.members ? editingTeam.members.split(",")[2]?.trim() : ""} />
              </label>
            </div>
            <label className="wide">
              Description
              <textarea name="description" defaultValue={editingTeam?.description || ""} rows={2} />
            </label>
            <div className="wide form-buttons">
              <button className="primary wide" type="submit">
                {editingTeam ? "Update Team" : "Add Team"}
              </button>
              {editingTeam && (
                <button className="secondary wide" type="button" onClick={() => setEditingTeam(null)}>
                  Cancel Edit
                </button>
              )}
            </div>
            <NoticeView notice={teamFormNotice} />
          </form>

          <section className="panel table-panel">
            <h2>Active Teams ({teams.length})</h2>
            <div className="team-list">
              {teams.length === 0 ? (
                <p className="no-data">No teams created yet.</p>
              ) : (
                teams.map((team) => {
                  const membersList = team.members ? team.members.split(",").map(m => m.trim()).filter(Boolean) : [];
                  return (
                    <div className="list-row team-crud-row" key={team.id}>
                      <div className="team-info">
                        <strong>{team.name}</strong>
                        <span className="category-badge">{team.category}</span>
                        {membersList.length > 0 && (
                          <div className="team-members-list">
                            Members: {membersList.join(", ")}
                          </div>
                        )}
                        {team.description && <small className="team-desc">{team.description}</small>}
                      </div>
                      <div className="row-actions">
                        <button className="edit-btn" onClick={() => {
                          setEditingTeam(team);
                          document.getElementById("team-form-heading")?.scrollIntoView({ behavior: "smooth" });
                        }}>Edit</button>
                        <button className="delete-btn danger" onClick={() => deleteTeam(team.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Column 3: Reports, Registrations & Live Logs */}
        <div className="dashboard-column">
          <section className="panel table-panel">
            <div className="section-head">
              <h2>Export Reports</h2>
              <div className="reports-buttons">
                <button onClick={() => downloadReport("/export/csv", token, "foodfest-report.csv")}><Download size={14} /> CSV</button>
                <button onClick={() => downloadReport("/export/excel", token, "foodfest-report.xls")}><Download size={14} /> Excel</button>
                <button onClick={() => downloadReport("/export/pdf", token, "foodfest-report.pdf")}><Download size={14} /> PDF</button>
              </div>
            </div>
            <NoticeView notice={notice} />
          </section>

          <section className="panel table-panel">
            <h2>Live Audit Logs</h2>
            <div className="activity-list">
              {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
                dashboard.recentActivity.slice(0, 10).map((act, index) => (
                  <div className="activity-row" key={index}>
                    <div className="activity-meta">
                      <span className="activity-action">{act.action.toUpperCase().replace(/_/g, " ")}</span>
                      <span className="activity-time">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="activity-details">
                      <span className="activity-email">{act.email || "System"}</span>
                      <span className={`activity-status-badge ${act.status >= 400 ? "failed" : "success"}`}>
                        {act.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-activity">No system activity logged yet.</p>
              )}
            </div>
          </section>

          <section className="panel table-panel">
            <h2>Excel Registrations ({registrations.length})</h2>
            <div className="registration-list">
              {registrations.length === 0 ? (
                <p className="no-data">No excel registrations imported.</p>
              ) : (
                registrations.slice(0, 10).map((reg) => (
                  <div className="list-row registration-row" key={reg.id}>
                    <strong>{reg.employeeName}</strong>
                    <span>{reg.email}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

      </div>

      <section className="panel table-panel wide" style={{ marginTop: '24px' }}>
        <h2>Team Invitation & Color Selection Status</h2>
        <div className="color-status-table-container">
          <table className="color-status-table">
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Category</th>
                <th>Selected Color</th>
                <th>Status</th>
                <th>Time Left</th>
                <th>Invitation Link</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team: any) => {
                const selectedColor = colors.find(c => c.bookedByTeamId === team.id || c.reservedByTeamId === team.id);
                
                let statusText = "Pending";
                let statusClass = "pending";
                let timeLeft = "—";
                
                if (team.selectionCompleted) {
                  statusText = "Booked";
                  statusClass = "booked";
                } else if (selectedColor && selectedColor.status === "reserved") {
                  statusText = "Reserved";
                  statusClass = "reserved";
                  timeLeft = selectedColor.remainingMs > 0 ? formatRemaining(selectedColor.remainingMs) : "Expired";
                }

                const inviteLink = `${window.location.origin}/color-selection?token=${team.invitationToken}`;

                return (
                  <tr key={team.id}>
                    <td><strong>{team.name}</strong></td>
                    <td>{team.category}</td>
                    <td>
                      {selectedColor ? (
                        <div className="table-color-pill">
                          <span className="dot" style={{ backgroundColor: selectedColor.hexCode }} />
                          {selectedColor.name}
                        </div>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`status-badge-inline ${statusClass}`}>{statusText}</span>
                    </td>
                    <td>{timeLeft}</td>
                    <td>
                      <div className="invite-link-cell">
                        <input className="invite-url-input" readOnly value={inviteLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                        <button className="copy-btn-small" onClick={() => {
                          navigator.clipboard.writeText(inviteLink);
                          alert("Invitation link copied!");
                        }}><Copy size={12} /> Copy</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

interface Color {
  id: string;
  name: string;
  hexCode: string;
  status: "available" | "reserved" | "booked";
  reservedByTeamId: string | null;
  reservedByTeamName: string | null;
  bookedByTeamId: string | null;
  bookedByTeamName: string | null;
  reservationExpiresAt: string | null;
}

interface ColorState extends Color {
  remainingMs: number;
}

interface ActivityLog {
  time: string;
  text: string;
}

function ColorSelectionPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [colors, setColors] = useState<ColorState[]>([]);
  const [onlineTeams, setOnlineTeams] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [colorSelectionOpen, setColorSelectionOpen] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);

  // Sync state and stream events
  useEffect(() => {
    if (!token) {
      setErrorMsg("Invalid invitation link. Please check your URL or contact event organizers.");
      setLoading(false);
      return;
    }

    // 1. Initial Validation check
    api<{ valid: boolean; team: any; colorSelectionOpen: boolean }>(`/colors/validate-token?token=${token}`)
      .then((data) => {
        if (!data.valid) {
          setErrorMsg("Invalid invitation token. Please check your URL.");
          return;
        }
        setTeamInfo(data.team);
        setColorSelectionOpen(data.colorSelectionOpen);
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg(err instanceof ApiError ? err.message : "Authentication failed.");
        setLoading(false);
      });

    // 2. Establish SSE stream
    const source = new EventSource(`${API_URL}/colors/stream?token=${token}`);

    source.addEventListener("color_event", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      if (payload.type === "INITIAL_STATE" || payload.type === "COLOR_RESERVED" || payload.type === "COLOR_RELEASED" || payload.type === "COLOR_BOOKED" || payload.type === "TIMER_EXPIRED") {
        setColors(payload.colors);
        setLogs(payload.activityLogs);
      }
      if (payload.type === "TEAM_JOINED" || payload.type === "TEAM_LEFT" || payload.type === "ONLINE_COUNT_CHANGED") {
        setOnlineTeams(payload.onlineTeams);
        setLogs(payload.activityLogs);
      }
    });

    source.onerror = () => {
      console.warn("Color SSE disconnected.");
    };

    return () => {
      source.close();
    };
  }, [token]);

  // Handle reload if color was booked
  useEffect(() => {
    if (!teamInfo) return;
    const isNowBooked = colors.some(c => c.status === "booked" && c.bookedByTeamId === teamInfo.id);
    if (isNowBooked && !teamInfo.selectionCompleted) {
      setTeamInfo((prev: any) => ({ ...prev, selectionCompleted: true }));
      // Fetch details of selected color
      api<{ valid: boolean; team: any }>(`/colors/validate-token?token=${token}`).then(d => {
        if (d.valid) setTeamInfo(d.team);
      });
    }
  }, [colors, teamInfo, token]);

  // Find if current team has an active reservation
  const activeReservation = useMemo(() => {
    if (!teamInfo) return null;
    return colors.find((c) => c.status === "reserved" && c.reservedByTeamId === teamInfo.id) || null;
  }, [colors, teamInfo]);

  // Ticking countdown timer logic
  const [timeLeftSecs, setTimeLeftSecs] = useState<number>(0);
  useEffect(() => {
    if (!activeReservation) {
      setTimeLeftSecs(0);
      return;
    }

    const timer = setInterval(() => {
      const expires = new Date(activeReservation.reservationExpiresAt!).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setTimeLeftSecs(diff);

      if (diff === 0) {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [activeReservation]);

  const formatSecs = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleReserve = async (colorId: string) => {
    setToast(null);
    try {
      await api("/colors/reserve", {
        method: "POST",
        body: JSON.stringify({ token, colorId })
      });
    } catch (err: any) {
      setToast({ tone: "error", text: err.message || "Failed to reserve color." });
    }
  };

  const handleConfirm = async () => {
    if (!activeReservation) return;
    setSubmitting(true);
    setToast(null);
    try {
      await api("/colors/confirm", {
        method: "POST",
        body: JSON.stringify({ token, colorId: activeReservation.id })
      });
      // Selection locked! Re-fetch token to trigger thank you screen
      const data = await api<{ valid: boolean; team: any }>(`/colors/validate-token?token=${token}`);
      if (data.valid) {
        setTeamInfo(data.team);
      }
    } catch (err: any) {
      setToast({ tone: "error", text: err.message || "Failed to confirm selection." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell showNav={false}>
        <div className="fullscreen-loading">
          <RefreshCcw className="spinner" size={48} />
          <p>Verifying invitation link...</p>
        </div>
      </Shell>
    );
  }

  if (errorMsg) {
    return (
      <Shell showNav={false}>
        <div className="error-panel">
          <Trash2 size={48} className="error-icon" />
          <h1>Invalid Link</h1>
          <p>{errorMsg}</p>
        </div>
      </Shell>
    );
  }

  // Lock State: If already selected
  if (teamInfo?.selectionCompleted) {
    return (
      <Shell showNav={false}>
        <div className="success-panel">
          <CheckCircle2 size={64} className="success-icon animate-pulse" />
          <h1>Taste of Bloom</h1>
          <p className="subtitle">Color Reservation Complete</p>
          <div className="booking-card">
            <h2>Welcome, {teamInfo.name}!</h2>
            <p>Your team color selection is locked and completed.</p>
            
            <div className="booked-color-display">
              <div 
                className="color-dot-large" 
                style={{ backgroundColor: teamInfo.selectedColorHex || "#ccc" }} 
              />
              <div className="color-details">
                <strong>{teamInfo.selectedColorName || "None"}</strong>
                <span>{teamInfo.selectedColorHex || ""}</span>
              </div>
            </div>
            
            <div className="team-metadata">
              <span><strong>Team Lead:</strong> {teamInfo.members ? teamInfo.members.split(",")[0] : teamInfo.name}</span>
              {teamInfo.members && teamInfo.members.split(",").slice(1).length > 0 && (
                <span><strong>Members:</strong> {teamInfo.members.split(",").slice(1).join(", ") || "None"}</span>
              )}
            </div>
          </div>
          <p className="footer-note">Get ready to cook! We will see you at the event.</p>
        </div>
      </Shell>
    );
  }

  // Lock State: Event closed
  if (!colorSelectionOpen) {
    return (
      <Shell showNav={false}>
        <div className="error-panel">
          <Lock size={48} className="lock-icon" />
          <h1>Color Selection Closed</h1>
          <p>The color selection event is not open at this time. Please check with the organizers.</p>
        </div>
      </Shell>
    );
  }

  // Welcome Video & Step Flow
  if (welcomeStep <= 3) {
    return (
      <Shell showNav={false}>
        <div className="welcome-flow-container">
          <div className="welcome-progress">
            <div className={`step-dot ${welcomeStep >= 1 ? "active" : ""}`}>1</div>
            <div className="step-line" />
            <div className={`step-dot ${welcomeStep >= 2 ? "active" : ""}`}>2</div>
            <div className="step-line" />
            <div className={`step-dot ${welcomeStep >= 3 ? "active" : ""}`}>3</div>
          </div>

          <div className="welcome-card">
            {welcomeStep === 1 && (
              <div className="step-content">
                <Video size={48} className="step-icon" />
                <h2>Registration Complete!</h2>
                <p className="welcome-message text-center">Thank you for registration for Taste of Bloom</p>
                
                {/* Premium Mock Video Block */}
                <div className="mock-video-player">
                  <div className="video-overlay">
                    <Play className="play-button" size={48} />
                    <span>Taste of Bloom Welcome Video</span>
                  </div>
                  <div className="video-waves">
                    <div className="wave"></div>
                    <div className="wave"></div>
                    <div className="wave"></div>
                  </div>
                </div>

                <button className="primary" onClick={() => setWelcomeStep(2)}>Next Step</button>
              </div>
            )}

            {welcomeStep === 2 && (
              <div className="step-content">
                <Palette size={48} className="step-icon" />
                <h2>Welcome, {teamInfo.name}!</h2>
                <p className="team-intro text-center">
                  We are thrilled to have you participating in our event. Before the burners ignite, let's establish your team color identity.
                </p>
                
                <div className="team-summary-box">
                  <h3>Team Summary</h3>
                  <div className="summary-row"><strong>Captain:</strong> {teamInfo.members ? teamInfo.members.split(",")[0] : "Lead"}</div>
                  <div className="summary-row"><strong>Members:</strong> {teamInfo.members ? teamInfo.members.split(",").slice(1).join(", ") || "None" : "None"}</div>
                </div>

                <button className="primary" onClick={() => setWelcomeStep(3)}>Next Step</button>
              </div>
            )}

            {welcomeStep === 3 && (
              <div className="step-content">
                <CheckCircle2 size={48} className="step-icon success" />
                <h3 className="quote">"Book ur color fast and cook peacefully!"</h3>
                
                <ul className="rules-list">
                  <li>Clicking a color places a <strong>2-minute temporary reservation</strong> on it.</li>
                  <li>During these 2 minutes, you must confirm your selection and hit Submit.</li>
                  <li>If you do not submit in time, the color is released back to all teams.</li>
                  <li>Once booked, color choices are <strong>permanent and locked</strong>.</li>
                </ul>

                <button className="primary" onClick={() => setWelcomeStep(4)}>Enter Selection Area</button>
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // Active Selection Workspace
  return (
    <Shell showNav={false}>
      <div className="colors-workspace-grid">
        
        {/* Left Side: Colors Grid */}
        <div className="workspace-main">
          <div className="panel selection-header-panel">
            <h2>Select Your Team Color</h2>
            <p>Select a color from the choices below. Once reserved, you have 2 minutes to lock it in.</p>
            
            {activeReservation && (
              <div className="timer-bar active">
                <div className="timer-info">
                  <strong>Your Reservation: {activeReservation.name}</strong>
                  <span className={timeLeftSecs < 20 ? "warning-flash" : ""}>
                    {formatSecs(timeLeftSecs)} remaining
                  </span>
                </div>
                <button className="primary" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? "Booking..." : <><Check size={18} /> Confirm & Lock Choice</>}
                </button>
              </div>
            )}
            <NoticeView notice={toast} />
          </div>

          <div className="colors-selection-grid">
            {colors.map((color) => {
              const isMine = activeReservation?.id === color.id;
              const isOtherReserved = color.status === "reserved" && !isMine;
              const isBooked = color.status === "booked";
              
              let statusLabel = "Available";
              if (isMine) statusLabel = "Your Selection";
              else if (isOtherReserved) statusLabel = `Reserved by ${color.reservedByTeamName}`;
              else if (isBooked) statusLabel = `Booked by ${color.bookedByTeamName}`;

              return (
                <button
                  key={color.id}
                  className={`color-choice-card ${color.status} ${isMine ? "mine" : ""}`}
                  disabled={isBooked || isOtherReserved || submitting}
                  onClick={() => handleReserve(color.id)}
                >
                  <div className="color-preview-box" style={{ backgroundColor: color.hexCode }} />
                  <div className="color-card-info">
                    <strong>{color.name}</strong>
                    <span>{color.hexCode}</span>
                    <span className="badge">{statusLabel}</span>
                  </div>
                  {isBooked && <Lock size={16} className="lock-badge" />}
                  {isMine && <CheckCircle2 size={18} className="check-badge" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Live Logs & Presence Panel */}
        <div className="workspace-sidebar">
          <section className="panel table-panel">
            <h2>Currently Online ({onlineTeams.length})</h2>
            <div className="online-presence-list">
              {onlineTeams.map((name, index) => (
                <div className="online-pill" key={index}>
                  <span className="dot" />
                  {name}
                </div>
              ))}
            </div>
          </section>

          <section className="panel table-panel">
            <h2>Live Event Activity</h2>
            <div className="color-activity-list">
              {logs.map((log, index) => (
                <div className="color-activity-row" key={index}>
                  <span className="log-text">{log.text}</span>
                  <span className="log-time">
                    {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </Shell>
  );
}

export default function App() {
  const page = window.location.pathname.split("/")[1] || "vote";
  if (page === "display") return <ResultsBoard fullscreen />;
  if (page === "admin") return <AdminPage />;
  if (page === "color-selection") return <ColorSelectionPage />;
  return <VotePage />;
}
