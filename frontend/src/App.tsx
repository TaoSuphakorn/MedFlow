import { LanguageSwitcher, useLanguage } from './lib/i18n';
import { useSessionSync } from './hooks/use-session-sync';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity,
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
  const { t } = useLanguage();
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
          <span className="eyebrow light">{t('CLINICAL WORKSPACE')}</span>
          <h1>
            {t('Clinical records,')}
            <br />
            <span>{t('ready for review.')}</span>
          </h1>
          <p>
            {t(
              'Review patient history, write clinical notes, and use AI to prepare drafts for your review.',
            )}
          </p>
          <div className="login-feature">
            <ShieldCheck />
            <span>
              {t('Every clinical note requires your review.')}
              <small>{t('Every suggestion requires a clinician’s review.')}</small>
            </span>
          </div>
        </div>
        <p className="login-story-footer">
          {t('Synthetic patient data for portfolio demonstration.')}
        </p>
        <div className="story-orbit orbit-one" />
        <div className="story-orbit orbit-two" />
      </section>
      <section className="login-form-side">
        <div className="login-language">
          <LanguageSwitcher />
        </div>
        <div className="login-form">
          <Badge tone="teal">
            <span className="dot" /> {' ' + t('INTERACTIVE PORTFOLIO DEMO')}
          </Badge>
          <h2>{t('Welcome to MedFlow')}</h2>
          <p className="muted">{t('Sign in to review patient records and clinical notes.')}</p>
          <div className="demo-selector">
            <label>{t('EXPLORE A DEMO ROLE')}</label>
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
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={form.handleSubmit(submit)}>
            <label htmlFor="email">{t('Email address')}</label>
            <input id="email" autoComplete="username" {...form.register('email')} />
            <small className="field-error">{t(form.formState.errors.email?.message)}</small>
            <label htmlFor="password">{t('Password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
            <small className="field-error">{t(form.formState.errors.password?.message)}</small>
            {error && (
              <p role="alert" className="error-banner">
                {t(error)}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? t('Signing in…') : t('Sign in to workspace')}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="login-demo-note">
            <Sparkles size={18} />
            <p>
              <strong>{t('Demo accounts are ready to use.')}</strong>
              <br />
              {t(
                'Demo credentials are prefilled. All patient data is fictional. AI runs in demo mode unless configured.',
              )}
            </p>
          </div>
          <p className="demo-disclaimer">
            {t('Portfolio demonstration only — Not for clinical use.')}
          </p>
        </div>
        <span className="login-bottom">
          {t('MEDFLOW AI') + ' '}
          <span>•</span> {' ' + t('A FULL-STACK PORTFOLIO PROJECT')}
        </span>
      </section>
    </div>
  );
}

export default function App() {
  const { t, locale } = useLanguage();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('Overview');
  const [patient, setPatient] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [compactNavigation, setCompactNavigation] = useState(
    () => window.matchMedia('(max-width: 800px)').matches,
  );
  const [shellDirty, setShellDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });
  const patients = useQuery({
    queryKey: ['patients'],
    queryFn: () => api<Patient[]>('/patients'),
    enabled: !!me.data,
  });
  const sessionSync = useSessionSync(qc, () => {
    setPatient(null);
    setView('Overview');
    setSearch('');
    setToast('');
    setShellDirty(false);
    setPendingNavigation(null);
    setHelp(false);
    setSettings(false);
    setMobile(false);
  });
  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const onChange = () => {
      setCompactNavigation(media.matches);
      if (!media.matches) setMobile(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [mobile]);
  function guardNavigation(action: () => void) {
    if (shellDirty) {
      setMobile(false);
      setPendingNavigation(() => action);
    } else action();
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
      setMobile(false);
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
    <div
      className={`app-shell ${sessionSync.checking || sessionSync.error ? 'session-checking' : ''}`}
    >
      {(sessionSync.checking || sessionSync.error) && (
        <div className="session-check">
          {sessionSync.error ? (
            <ErrorState error={sessionSync.error} retry={sessionSync.retry} />
          ) : (
            <Loading />
          )}
        </div>
      )}
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobile ? 'is-open' : ''}`}
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile || undefined}
        aria-label={t('Main navigation')}
        inert={compactNavigation && !mobile}
        aria-hidden={compactNavigation && !mobile ? true : undefined}
      >
        <button
          type="button"
          className="sidebar-close"
          aria-label={t('Close navigation')}
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <Logo />
        <div className="workspace-label">{t('WORKSPACE')}</div>
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
              <span>{t(name)}</span>
              {name === 'Drafts' && <span className="nav-count">{drafts}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="ai-sidebar-card">
          <span className="ai-orb">
            <Sparkles size={20} />
          </span>
          <h4>{t('Documentation assistant')}</h4>
          <p>{t('AI suggestions require clinician review.')}</p>
          <span className="ai-card-mode">
            <span className="dot" />
            {user.aiMode === 'Demo' ? t('Demo AI Mode') : t('Live AI Mode')}
          </span>
        </div>
        <a
          className="nav-item"
          href="/swagger/"
          target="_blank"
          rel="noreferrer"
          onClick={() => setMobile(false)}
        >
          <BookOpen size={19} />
          <span>{t('API documentation')}</span>
          <ArrowUpRight size={15} />
        </a>
        <button
          className="nav-item"
          onClick={() => {
            setMobile(false);
            setSettings(true);
          }}
        >
          <Settings2 size={19} />
          <span>{t('Workspace settings')}</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setMobile(false);
            setHelp(true);
          }}
        >
          <CircleHelp size={19} />
          <span>{t('Help & demo guide')}</span>
          <ArrowUpRight size={15} />
        </button>
        <div className="sidebar-user">
          <Avatar name={user.name} />
          <span>
            <strong>{user.name}</strong>
            <small>{t(user.role)}</small>
          </span>
          <button aria-label={t('Sign out')} onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={mobile || sessionSync.checking || !!sessionSync.error}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label={t('Open navigation')}
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>{t('Workspace')}</span>
            <ChevronRight size={14} />
            <strong>{patient ? t('Patient workspace') : t(view)}</strong>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="synthetic-label">
              <ShieldCheck size={14} />
              {t('Synthetic data only')}
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
                  <div className="eyebrow">{t('YOUR CLINICAL WORKSPACE')}</div>
                  <h1>
                    {view === 'Overview'
                      ? t('Clinical overview')
                      : view === 'Drafts'
                        ? t('Drafts awaiting review')
                        : t('Patient directory')}
                  </h1>
                  <p>
                    {view === 'Overview'
                      ? t('Review patient records and pending clinical documentation.')
                      : view === 'Drafts'
                        ? t('Pick up unfinished notes and review AI suggestions.')
                        : t('Search patients and open their clinical records.')}
                  </p>
                </div>
                <div className="date-pill">
                  <CalendarDays size={16} />
                  {date(new Date().toISOString(), locale)}
                </div>
              </div>
              {view === 'Overview' && (
                <>
                  <div className="stats-grid">
                    <Stat
                      label={t('Patients in workspace')}
                      value={String(list.length).padStart(2, '0')}
                      detail={t('Fictional patient profiles')}
                      icon={<Users />}
                      tone="teal"
                    />
                    <Stat
                      label={t('Confirmed records')}
                      value={list.reduce((n, p) => n + p.visitCount, 0).toString()}
                      detail={t('Clinician-reviewed SOAP notes')}
                      icon={<ClipboardCheck />}
                      tone="blue"
                    />
                    <Stat
                      label={t('Drafts to review')}
                      value={String(drafts).padStart(2, '0')}
                      detail={t('Awaiting clinician review')}
                      icon={<FileClock />}
                      tone="amber"
                    />
                    <Stat
                      label={t('AI assistance')}
                      value={user.aiMode === 'Demo' ? t('Demo') : t('Live')}
                      detail={
                        user.aiMode === 'Demo'
                          ? t('Deterministic · no API key needed')
                          : t('OpenAI · clinician review required')
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
                            <span className="dot" /> {' ' + t('PATIENT DOCUMENTATION')}
                          </span>
                          <h2>
                            {t('Patient records,')}
                            <br />
                            {t('ready for review.')}
                          </h2>
                          <p>
                            {t('Review previous visits and write a SOAP note.')}
                            <br />
                            {t('AI drafts are available when you need them.')}
                          </p>
                          <Button variant="secondary" onClick={() => navigate('Patients')}>
                            {t('Open patient workspace')}
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
                          <Badge tone="purple">{t('AI ASSISTANT')}</Badge>
                        </div>
                        <h3>
                          {t('AI documentation')}
                          <br />
                          {t('assistant')}
                        </h3>
                        <p>{t('Summaries and SOAP drafts use the patient’s confirmed records.')}</p>
                        <div className="assistant-feature">
                          <FileText size={17} />
                          <div>
                            <strong>{t('Patient summaries')}</strong>
                            <small>{t('Review the confirmed visit history.')}</small>
                          </div>
                        </div>
                        <div className="assistant-feature">
                          <BookOpen size={17} />
                          <div>
                            <strong>{t('SOAP draft assistance')}</strong>
                            <small>{t('Edit each section before confirming.')}</small>
                          </div>
                        </div>
                        <div className="assistant-feature">
                          <ShieldCheck size={17} />
                          <div>
                            <strong>{t('Doctor confirmation required')}</strong>
                            <small>{t('Nothing is approved automatically.')}</small>
                          </div>
                        </div>
                        <div className="assistant-disclosure">
                          <span className="dot" />
                          {user.aiMode === 'Demo'
                            ? t('Demo AI Mode · simulated responses')
                            : t('Live AI Mode · OpenAI integration')}
                        </div>
                      </div>
                      <div className="card review-card">
                        <div className="card-title">
                          <h3>{t('Ready for your review')}</h3>
                          <FileClock size={17} />
                        </div>
                        {drafts ? (
                          <>
                            <div className="review-count">
                              {drafts}
                              <span>{t('drafts awaiting review')}</span>
                            </div>
                            <p>
                              {t(
                                'Open a saved draft to continue editing or review an AI suggestion.',
                              )}
                            </p>
                            <button className="text-link" onClick={() => navigate('Drafts')}>
                              {t('Review drafts')}
                              <ArrowRight size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <p>{t('No drafts are awaiting review.')}</p>
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
              {t('MedFlow AI · Clinical workspace')}
            </span>
            <span>{t('Portfolio demonstration only — Not for clinical use.')}</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{t(toast)}</span>
          <button aria-label={t('Dismiss notification')} onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      <Dialog
        open={!!pendingNavigation}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
        title={t('Leave unsaved changes?')}
      >
        <p className="muted">
          {t('Your latest SOAP edits have not been saved. Save the draft first to keep them.')}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setPendingNavigation(null)}>
            {t('Keep editing')}
          </Button>
          <Button
            onClick={() => {
              pendingNavigation?.();
              setPendingNavigation(null);
            }}
          >
            {t('Discard unsaved edits')}
          </Button>
        </div>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp} title={t('Explore the MedFlow demo')}>
        <div className="help-content">
          <p>
            {t(
              'All records belong to fictional patients. This portfolio application must never be used for clinical care.',
            )}
          </p>
          <ol>
            <li>
              {t('Open') + ' '}
              <strong>{t('Patients')}</strong> {' ' + t('and choose Somchai Jaidee.')}
            </li>
            <li>{t('Review original, confirmed visits in the patient timeline.')}</li>
            <li>{t('Generate a SOAP draft or a summary with the AI assistant.')}</li>
            <li>{t('Edit the four SOAP sections and save your draft.')}</li>
            <li>{t('As a doctor, check the review attestation and explicitly confirm.')}</li>
          </ol>
          <p>
            {t(
              'Nurses can write drafts. Administrators can inspect the audit log. Only doctors can confirm clinical notes.',
            )}
          </p>
          <p>
            <strong>{t('Demo AI Mode')}</strong>{' '}
            {' ' +
              t(
                'uses deterministic simulated responses. Configuring an OpenAI key enables live assistance.',
              )}
          </p>
        </div>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings} title={t('Workspace settings')}>
        <div className="help-content">
          <div className="setting-row">
            <span>{t('Signed in as')}</span>
            <strong>{user.name}</strong>
          </div>
          <div className="setting-row">
            <span>{t('Access role')}</span>
            <Badge tone="teal">{t(user.role)}</Badge>
          </div>
          <div className="setting-row">
            <span>{t('AI connection')}</span>
            <Badge tone="purple">
              {user.aiMode === 'Demo' ? t('Demo AI Mode') : t('Live AI Mode')}
            </Badge>
          </div>
          <div className="setting-row">
            <span>{t('Clinical data')}</span>
            <span>{t('Synthetic only')}</span>
          </div>
          <p>
            {t(
              'AI mode is configured securely on the server. See the README for environment settings. Session cookies expire after four hours.',
            )}
          </p>
          <Button variant="outline" onClick={logout}>
            <LogOut size={16} />
            {t('Sign out')}
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
  const { t } = useLanguage();
  return (
    <div className="card stat-card">
      <div>
        <span className="stat-label">{t(label)}</span>
        <span className={`icon-tile ${tone}`}>{icon}</span>
      </div>
      <strong>{t(value)}</strong>
      <small>
        <span className={`dot ${tone}`} />
        {t(detail)}
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
  const { t, locale } = useLanguage();
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
              ? t('Patient overview')
              : draftsOnly
                ? t('Patients with pending drafts')
                : t('Patient directory')}
            <span className="number-badge">{patients.length}</span>
          </h2>
          <p>
            {compact
              ? t('Open a patient to review their records.')
              : t('Fictional patient profiles for this demonstration.')}
          </p>
        </div>
        {compact && (
          <button className="text-link" onClick={onViewAll}>
            {t('View all patients')}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      <div className="table-tools">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder={t('Search name, Thai name, or patient ID…')}
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label={t('Clear search')} onClick={() => setSearch('')}>
              <X size={15} />
            </button>
          )}
        </div>
        <div className="select-wrap">
          <Settings2 size={15} />
          <select
            aria-label={t('Filter patients')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {['All patients', 'Follow-up', 'New visit', 'Routine check'].map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
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
                <th>{t('Patient')}</th>
                <th>{t('Patient ID')}</th>
                <th>{t('Age / Sex')}</th>
                {!compact && <th>{t('Last visit')}</th>}
                <th>{draftsOnly ? t('Pending review') : t('Visit type')}</th>
                <th aria-label={t('Open patient')} />
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
                  <td data-label={t('Patient ID')}>
                    <span className="patient-id">{p.identifier}</span>
                  </td>
                  <td data-label={t('Age / Sex')}>
                    <span className="age-sex">
                      {p.age} {' ' + t('yrs') + ' '}
                      <span>·</span> {t(p.gender === 'Male' ? 'M' : 'F')}
                    </span>
                  </td>
                  {!compact && (
                    <td className="date-cell" data-label={t('Last visit')}>
                      {date(p.lastVisit, locale)}
                    </td>
                  )}
                  <td data-label={draftsOnly ? t('Pending review') : t('Visit type')}>
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
                      {draftsOnly
                        ? t('Pending drafts: {count}', { count: p.draftCount })
                        : t(p.category)}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="open-patient"
                      aria-label={`${t('Open')} ${p.name.split(' ')[0]}`}
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
        <Empty
          title={t('No patients found')}
          text={t('Try another name, patient ID, or visit type.')}
        />
      )}
      <div className="table-footer">
        <span>
          {t('Showing') + ' '}
          {filtered.length} {filtered.length === 1 ? t('patient') : t('patients')}
          <span className="footer-dot">·</span>
          {t('Synthetic demo records')}
        </span>
        <ShieldCheck size={14} />
      </div>
    </section>
  );
}
function Audit() {
  const { t, locale } = useLanguage();
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
          <div className="eyebrow">{t('ACTIVITY AND ACCESS')}</div>
          <h1>{t('Workspace audit log')}</h1>
          <p>
            {t(
              'A record of access, changes, and clinician decisions. Clinical payloads are never logged.',
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void q.refetch();
          }}
        >
          {t('Refresh log')}
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
                  <th>{t('Event')}</th>
                  <th>{t('Timestamp (Bangkok)')}</th>
                  <th>{t('User')}</th>
                  <th>{t('Patient')}</th>
                  <th>{t('Note')}</th>
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
                    <td>{new Date(e.at).toLocaleString(locale, { timeZone: 'Asia/Bangkok' })}</td>
                    <td>{e.userId ? t('User {id}', { id: e.userId }) : t('Anonymous')}</td>
                    <td>{e.patientId || '—'}</td>
                    <td>{e.noteId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small">{t('Showing the 200 most recent events.')}</p>
    </>
  );
}
