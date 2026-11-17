import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileClock,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { api, ApiError, csrf, date, type Patient, type User } from './lib/api';
import { Avatar, Badge, Empty, ErrorState, Loading, Logo } from './components/shared';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
import { Workspace } from './Workspace';

type View = 'Overview' | 'Patients' | 'Drafts' | 'Audit log';
const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
function Login({ onLogin }: { onLogin: () => void }) {
  const [role, setRole] = useState('doctor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'doctor@medflow.demo', password: 'Demo!2026' },
  });
  async function submit(values: z.infer<typeof loginSchema>) {
    setBusy(true);
    setError('');
    try {
      await csrf();
      await api('/auth/login', 'POST', values);
      await csrf();
      onLogin();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Email or password is incorrect.'
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo />
        <div className="login-copy">
          <span className="eyebrow light">LESS ADMIN. MORE HUMAN.</span>
          <h1>
            More time for
            <br />
            the person
            <br />
            <span>behind the patient.</span>
          </h1>
          <p>
            A connected clinical workspace that brings patient records, thoughtful AI assistance,
            and your expertise together.
          </p>
          <div className="login-feature">
            <ShieldCheck />
            <span>
              AI assists. You stay in control.
              <small>Every suggestion requires a clinician’s review.</small>
            </span>
          </div>
        </div>
        <p className="login-story-footer">Built for thoughtful care. Designed around you.</p>
        <div className="story-orbit orbit-one" />
        <div className="story-orbit orbit-two" />
      </section>
      <section className="login-form-side">
        <div className="login-form">
          <Badge tone="teal">
            <span className="dot" /> INTERACTIVE PORTFOLIO DEMO
          </Badge>
          <h2>Welcome to MedFlow</h2>
          <p className="muted">A little less paperwork. A little more possibility.</p>
          <div className="demo-selector">
            <label>EXPLORE A DEMO ROLE</label>
            <div>
              {[
                ['doctor', 'Doctor'],
                ['nurse', 'Nurse'],
                ['admin', 'Administrator'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={role === key ? 'selected' : ''}
                  onClick={() => {
                    setRole(key);
                    form.setValue('email', `${key}@medflow.demo`);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={form.handleSubmit(submit)}>
            <label htmlFor="email">Email address</label>
            <input id="email" autoComplete="username" {...form.register('email')} />
            <small className="field-error">{form.formState.errors.email?.message}</small>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
            <small className="field-error">{form.formState.errors.password?.message}</small>
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to workspace'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="login-demo-note">
            <Sparkles size={18} />
            <p>
              <strong>Ready to explore. No setup needed.</strong>
              <br />
              Demo credentials are prefilled. All patient data is fictional. AI runs in demo mode
              unless configured.
            </p>
          </div>
          <p className="demo-disclaimer">Portfolio demonstration only — Not for clinical use.</p>
        </div>
        <span className="login-bottom">
          MEDFLOW AI <span>•</span> A FULL-STACK PORTFOLIO PROJECT
        </span>
      </section>
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('Overview');
  const [patient, setPatient] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [shellDirty, setShellDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });
  const patients = useQuery({
    queryKey: ['patients'],
    queryFn: () => api<Patient[]>('/patients'),
    enabled: !!me.data,
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  function guardNavigation(action: () => void) {
    if (shellDirty) setPendingNavigation(() => action);
    else action();
  }
  const navigate = (next: View) =>
    guardNavigation(() => {
      setShellDirty(false);
      setView(next);
      setPatient(null);
      setSearch('');
      setMobile(false);
    });
  const open = (id: number) =>
    guardNavigation(() => {
      setShellDirty(false);
      setPatient(id);
      setMobile(false);
    });
  function logout() {
    guardNavigation(() => {
      void performLogout();
    });
  }
  async function performLogout() {
    try {
      await api('/auth/logout', 'POST');
      qc.clear();
      setPatient(null);
      setView('Overview');
      await me.refetch();
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  if (me.isPending) return <Loading />;
  if (!me.data)
    return (
      <Login
        onLogin={() => {
          qc.clear();
          void me.refetch();
        }}
      />
    );
  const user = me.data;
  const list = patients.data || [];
  const drafts = list.reduce((n, p) => n + p.draftCount, 0);
  const nav = [
    { name: 'Overview' as View, icon: LayoutDashboard },
    { name: 'Patients' as View, icon: Users },
    { name: 'Drafts' as View, icon: FileClock },
    ...(user.role === 'Administrator' ? [{ name: 'Audit log' as View, icon: ShieldCheck }] : []),
  ];
  return (
    <div className="app-shell">
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <Logo />
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={
                (view === name && !patient) || (patient && name === 'Patients')
                  ? 'nav-item active'
                  : 'nav-item'
              }
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === 'Drafts' && <span className="nav-count">{drafts}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="ai-sidebar-card">
          <span className="ai-orb">
            <Sparkles size={20} />
          </span>
          <h4>A thoughtful second look</h4>
          <p>
            Documentation support,
            <br />
            with you in control.
          </p>
          <span className="ai-card-mode">
            <span className="dot" />
            {user.aiMode === 'Demo' ? 'Demo AI Mode' : 'Live AI Mode'}
          </span>
        </div>
        <button className="nav-item" onClick={() => setSettings(true)}>
          <Settings2 size={19} />
          <span>Workspace settings</span>
        </button>
        <button className="nav-item" onClick={() => setHelp(true)}>
          <CircleHelp size={19} />
          <span>Help & demo guide</span>
          <ArrowUpRight size={15} />
        </button>
        <div className="sidebar-user">
          <Avatar name={user.name} />
          <span>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </span>
          <button aria-label="Sign out" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{patient ? 'Patient workspace' : view}</strong>
          </div>
          <div className="topbar-right">
            <span className="synthetic-label">
              <ShieldCheck size={14} />
              Synthetic data only
            </span>
            <span className="topbar-divider" />
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="main-content">
          {patient ? (
            <Workspace
              key={patient}
              id={patient}
              user={user}
              onBack={() => navigate('Patients')}
              notify={setToast}
              onDirtyChange={setShellDirty}
            />
          ) : patients.isPending ? (
            <Loading />
          ) : patients.error ? (
            <ErrorState
              error={patients.error}
              retry={() => {
                void patients.refetch();
              }}
            />
          ) : view === 'Audit log' ? (
            <Audit />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR CLINICAL WORKSPACE</div>
                  <h1>
                    {view === 'Overview'
                      ? 'Your day, at a glance.'
                      : view === 'Drafts'
                        ? 'A little review goes a long way.'
                        : 'Good care starts with knowing.'}
                  </h1>
                  <p>
                    {view === 'Overview'
                      ? `Welcome back, ${user.name.split(' ').slice(0, 2).join(' ')}. Let’s make room for what matters.`
                      : view === 'Drafts'
                        ? 'Pick up unfinished notes and review AI suggestions.'
                        : 'Find a patient, review their story, and keep care moving.'}
                  </p>
                </div>
                <div className="date-pill">
                  <CalendarDays size={16} />
                  {date(new Date().toISOString())}
                </div>
              </div>
              {view === 'Overview' && (
                <>
                  <div className="stats-grid">
                    <Stat
                      label="Patients in workspace"
                      value={String(list.length).padStart(2, '0')}
                      detail="Fictional patient profiles"
                      icon={<Users />}
                      tone="teal"
                    />
                    <Stat
                      label="Confirmed records"
                      value={list.reduce((n, p) => n + p.visitCount, 0).toString()}
                      detail="Clinician-reviewed SOAP notes"
                      icon={<ClipboardCheck />}
                      tone="blue"
                    />
                    <Stat
                      label="Drafts to review"
                      value={String(drafts).padStart(2, '0')}
                      detail="Your expertise is the next step"
                      icon={<FileClock />}
                      tone="amber"
                    />
                    <Stat
                      label="AI assistance"
                      value={user.aiMode === 'Demo' ? 'Demo' : 'Live'}
                      detail={
                        user.aiMode === 'Demo'
                          ? 'Deterministic · no API key needed'
                          : 'OpenAI · clinician review required'
                      }
                      icon={<Sparkles />}
                      tone="purple"
                    />
                  </div>
                  <div className="overview-columns">
                    <div className="overview-primary">
                      <div className="welcome-banner">
                        <div>
                          <span className="banner-eyebrow">
                            <span className="dot" /> HUMAN EXPERTISE. THOUGHTFUL AI.
                          </span>
                          <h2>
                            Less time documenting.
                            <br />
                            More time connecting.
                          </h2>
                          <p>
                            Turn patient history into a starting point.
                            <br />
                            Review, refine, and make it your own.
                          </p>
                          <Button variant="secondary" onClick={() => navigate('Patients')}>
                            Open patient workspace
                            <ArrowRight size={16} />
                          </Button>
                        </div>
                        <div className="banner-art" aria-hidden="true">
                          <div className="art-orbit" />
                          <span className="art-heart">
                            <HeartPulse size={48} strokeWidth={1.5} />
                          </span>
                          <span className="art-spark">
                            <Sparkles size={19} />
                          </span>
                          <span className="art-check">
                            <Check size={18} />
                          </span>
                          <svg viewBox="0 0 220 70">
                            <path
                              d="M0 35 H55 L70 21 L84 49 L102 5 L120 63 L137 30 L153 35 H220"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </div>
                      </div>
                      <PatientTable
                        patients={list.slice(0, 5)}
                        search={search}
                        setSearch={setSearch}
                        onOpen={open}
                        compact
                        onViewAll={() => navigate('Patients')}
                      />
                    </div>
                    <aside className="overview-secondary">
                      <div className="card assistant-intro">
                        <div className="card-title">
                          <span className="icon-tile purple">
                            <Sparkles size={18} />
                          </span>
                          <Badge tone="purple">AI ASSISTANT</Badge>
                        </div>
                        <h3>
                          A head start.
                          <br />
                          Never the final say.
                        </h3>
                        <p>
                          Bring the patient’s story together, while keeping your clinical judgment
                          at the center.
                        </p>
                        <div className="assistant-feature">
                          <FileText size={17} />
                          <div>
                            <strong>Patient summaries</strong>
                            <small>The relevant history, in one place.</small>
                          </div>
                        </div>
                        <div className="assistant-feature">
                          <BookOpen size={17} />
                          <div>
                            <strong>SOAP draft assistance</strong>
                            <small>A starting point you can shape.</small>
                          </div>
                        </div>
                        <div className="assistant-feature">
                          <ShieldCheck size={17} />
                          <div>
                            <strong>You review. You confirm.</strong>
                            <small>Nothing is approved automatically.</small>
                          </div>
                        </div>
                        <div className="assistant-disclosure">
                          <span className="dot" />
                          {user.aiMode === 'Demo'
                            ? 'Demo AI Mode · simulated responses'
                            : 'Live AI Mode · OpenAI integration'}
                        </div>
                      </div>
                      <div className="card review-card">
                        <div className="card-title">
                          <h3>Ready for your review</h3>
                          <FileClock size={17} />
                        </div>
                        {drafts ? (
                          <>
                            <div className="review-count">
                              {drafts}
                              <span>unfinished {drafts === 1 ? 'draft' : 'drafts'}</span>
                            </div>
                            <p>Every thoughtful review makes the record a little clearer.</p>
                            <button className="text-link" onClick={() => navigate('Drafts')}>
                              Review drafts
                              <ArrowRight size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <p>You’re all caught up. New drafts will appear here.</p>
                            <Check className="teal-text" />
                          </>
                        )}
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {view !== 'Overview' && (
                <PatientTable
                  patients={view === 'Drafts' ? list.filter((p) => p.draftCount > 0) : list}
                  search={search}
                  setSearch={setSearch}
                  onOpen={open}
                  draftsOnly={view === 'Drafts'}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Activity size={14} />
              Thoughtfully connected. Human-led care.
            </span>
            <span>Portfolio demonstration only — Not for clinical use.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      <Dialog
        open={!!pendingNavigation}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
        title="Leave unsaved changes?"
      >
        <p className="muted">
          Your latest SOAP edits have not been saved. Save the draft first to keep them.
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setPendingNavigation(null)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              pendingNavigation?.();
              setPendingNavigation(null);
            }}
          >
            Discard unsaved edits
          </Button>
        </div>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp} title="Explore the MedFlow demo">
        <div className="help-content">
          <p>
            All records belong to fictional patients. This portfolio application must never be used
            for clinical care.
          </p>
          <ol>
            <li>
              Open <strong>Patients</strong> and choose Somchai Jaidee.
            </li>
            <li>Review original, confirmed visits in the patient timeline.</li>
            <li>Generate a SOAP draft or a summary with the AI assistant.</li>
            <li>Edit the four SOAP sections and save your draft.</li>
            <li>As a doctor, check the review attestation and explicitly confirm.</li>
          </ol>
          <p>
            Nurses can write drafts. Administrators can inspect the audit log. Only doctors can
            confirm clinical notes.
          </p>
          <p>
            <strong>Demo AI Mode</strong> uses deterministic simulated responses. Configuring an
            OpenAI key enables live assistance.
          </p>
        </div>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings} title="Workspace settings">
        <div className="help-content">
          <div className="setting-row">
            <span>Signed in as</span>
            <strong>{user.name}</strong>
          </div>
          <div className="setting-row">
            <span>Access role</span>
            <Badge tone="teal">{user.role}</Badge>
          </div>
          <div className="setting-row">
            <span>AI connection</span>
            <Badge tone="purple">{user.aiMode} AI Mode</Badge>
          </div>
          <div className="setting-row">
            <span>Clinical data</span>
            <span>Synthetic only</span>
          </div>
          <p>
            AI mode is configured securely on the server. See the README for environment settings.
            Session cookies expire after four hours.
          </p>
          <Button variant="outline" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="card stat-card">
      <div>
        <span className="stat-label">{label}</span>
        <span className={`icon-tile ${tone}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>
        <span className={`dot ${tone}`} />
        {detail}
      </small>
    </div>
  );
}

function PatientTable({
  patients,
  search,
  setSearch,
  onOpen,
  compact = false,
  draftsOnly = false,
  onViewAll,
}: {
  patients: Patient[];
  search: string;
  setSearch: (s: string) => void;
  onOpen: (id: number) => void;
  compact?: boolean;
  draftsOnly?: boolean;
  onViewAll?: () => void;
}) {
  const [category, setCategory] = useState('All patients');
  const filtered = patients.filter(
    (p) =>
      `${p.name} ${p.thaiName} ${p.identifier}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === 'All patients' || p.category === category),
  );
  return (
    <section className="card patients-card">
      <div className="patient-table-heading">
        <div>
          <h2>
            {compact
              ? 'Patient overview'
              : draftsOnly
                ? 'Patients with pending drafts'
                : 'Patient directory'}
            <span className="number-badge">{patients.length}</span>
          </h2>
          <p>
            {compact
              ? 'A familiar face. A complete picture.'
              : 'All fictional profiles, securely in one workspace.'}
          </p>
        </div>
        {compact && (
          <button className="text-link" onClick={onViewAll}>
            View all patients
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      <div className="table-tools">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Search name, Thai name, or patient ID…"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={15} />
            </button>
          )}
        </div>
        <div className="select-wrap">
          <Settings2 size={15} />
          <select
            aria-label="Filter patients"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {['All patients', 'Follow-up', 'New visit', 'Routine check'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
      </div>
      {filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Patient ID</th>
                <th>Age / Sex</th>
                {!compact && <th>Last visit</th>}
                <th>{draftsOnly ? 'Pending review' : 'Visit type'}</th>
                <th aria-label="Open patient" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="patient-name-cell">
                      <Avatar name={p.name} color={p.color} />
                      <span>
                        <strong>{p.name}</strong>
                        <small lang="th">{p.thaiName}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="patient-id">{p.identifier}</span>
                  </td>
                  <td>
                    <span className="age-sex">
                      {p.age} yrs <span>·</span> {p.gender === 'Male' ? 'M' : 'F'}
                    </span>
                  </td>
                  {!compact && <td className="date-cell">{date(p.lastVisit)}</td>}
                  <td>
                    <Badge
                      tone={
                        draftsOnly
                          ? 'amber'
                          : p.category === 'Follow-up'
                            ? 'teal'
                            : p.category === 'New visit'
                              ? 'blue'
                              : 'neutral'
                      }
                    >
                      {draftsOnly ? `${p.draftCount} drafts` : p.category}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="open-patient"
                      aria-label={`Open ${p.name.split(' ')[0]}`}
                      onClick={() => onOpen(p.id)}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No patients found" text="Try another name, patient ID, or visit type." />
      )}
      <div className="table-footer">
        <span>
          Showing {filtered.length} {filtered.length === 1 ? 'patient' : 'patients'}
          <span className="footer-dot">·</span>Synthetic demo records
        </span>
        <ShieldCheck size={14} />
      </div>
    </section>
  );
}
function Audit() {
  const q = useQuery({
    queryKey: ['audit'],
    queryFn: () =>
      api<
        {
          id: number;
          at: string;
          userId: number | null;
          action: string;
          patientId: number | null;
          noteId: number | null;
        }[]
      >('/audit'),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNTABILITY, BUILT IN</div>
          <h1>Workspace audit log</h1>
          <p>
            A record of access, changes, and clinician decisions. Clinical payloads are never
            logged.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void q.refetch();
          }}
        >
          Refresh log
        </Button>
      </div>
      <div className="card">
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState
            error={q.error}
            retry={() => {
              void q.refetch();
            }}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Timestamp (Bangkok)</th>
                  <th>User</th>
                  <th>Patient</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Badge tone={e.action.includes('failed') ? 'amber' : 'teal'}>
                        {e.action}
                      </Badge>
                    </td>
                    <td>{new Date(e.at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}</td>
                    <td>{e.userId ? `User ${e.userId}` : 'Anonymous'}</td>
                    <td>{e.patientId || '—'}</td>
                    <td>{e.noteId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small">Showing the 200 most recent events.</p>
    </>
  );
}
