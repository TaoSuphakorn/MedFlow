import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  History,
  Info,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { api, date, type Note, type Patient, type Soap, type User } from './lib/api';
import { Avatar, Badge, Empty, ErrorState, Loading } from './components/shared';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';

const section = z
  .string()
  .trim()
  .min(1, 'This section is required.')
  .max(8000, 'Keep this section under 8,000 characters.');
const schema = z.object({
  subjective: section,
  objective: section,
  assessment: section,
  plan: section,
});
const blank: Soap = { subjective: '', objective: '', assessment: '', plan: '' };
const sections = [
  {
    key: 'subjective' as const,
    letter: 'S',
    label: 'Subjective',
    help: 'The patient’s story, in their own words.',
    placeholder: 'Chief concern, symptom history, and patient-reported information…',
  },
  {
    key: 'objective' as const,
    letter: 'O',
    label: 'Objective',
    help: 'What you observe and measure.',
    placeholder: 'Vital signs, examination findings, and relevant results…',
  },
  {
    key: 'assessment' as const,
    letter: 'A',
    label: 'Assessment',
    help: 'Your clinical interpretation.',
    placeholder: 'Document your assessment, supported by the source information…',
  },
  {
    key: 'plan' as const,
    letter: 'P',
    label: 'Plan',
    help: 'The next steps, decided by you.',
    placeholder: 'Document the clinician-reviewed plan and follow-up…',
  },
];

export function Workspace({
  id,
  user,
  onBack,
  notify,
  onDirtyChange,
}: {
  id: number;
  user: User;
  onBack: () => void;
  notify: (s: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['patient', id], queryFn: () => api<Patient>(`/patients/${id}`) });
  const [current, setCurrent] = useState<Note | null>(null);
  const [suggestion, setSuggestion] = useState<Note | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [tab, setTab] = useState<'notes' | 'history'>('notes');
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const form = useForm<Soap>({ resolver: zodResolver(schema), defaultValues: blank });
  const canEdit = user.role !== 'Administrator';
  const changed = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange(changed);
    return () => onDirtyChange(false);
  }, [changed, onDirtyChange]);
  useEffect(() => {
    function unload(e: BeforeUnloadEvent) {
      if (changed) e.preventDefault();
    }
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [changed]);
  useEffect(() => {
    if (changed) setReviewed(false);
  }, [changed]);
  function guard(action: () => void) {
    if (changed) setDiscard(() => action);
    else action();
  }
  function edit(note: Note | null) {
    setCurrent(note);
    form.reset(note || blank);
    setReviewed(false);
    setError('');
    setTab('notes');
    if (note?.aiGenerated) setSuggestion(note);
  }
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['patient', id] }),
      qc.invalidateQueries({ queryKey: ['patients'] }),
    ]);
  }
  async function save(values: Soap) {
    setBusy('save');
    setError('');
    try {
      const n = current
        ? await api<Note>(`/notes/${current.id}`, 'PUT', { ...values, version: current.version })
        : await api<Note>(`/patients/${id}/notes`, 'POST', { ...values, version: 0 });
      setCurrent(n);
      form.reset(n);
      setReviewed(false);
      await refresh();
      notify('Draft saved. Ready for your review.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function generate(kind: 'soap' | 'summary') {
    setBusy(kind);
    setError('');
    try {
      const n = await api<Note>(`/patients/${id}/ai`, 'POST', { kind });
      setSuggestion(n);
      if (kind === 'soap') edit(n);
      await refresh();
      notify(
        kind === 'soap'
          ? 'AI draft ready. Review every section before confirming.'
          : 'AI summary ready. Compare it with the source records.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function confirm() {
    if (!current || !reviewed || changed) return;
    setBusy('confirm');
    setError('');
    try {
      const n = await api<Note>(`/notes/${current.id}/confirm`, 'POST', {
        reviewed: true,
        version: current.version,
      });
      setCurrent(n);
      form.reset(n);
      setReviewed(false);
      await refresh();
      notify('Clinical note confirmed. Your review has been recorded in the audit log.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <ErrorState
        error={q.error}
        retry={() => {
          void q.refetch();
        }}
      />
    );
  const p = q.data!;
  const notes = p.notes.filter((n) => n.kind === 'soap');
  const drafts = notes.filter((n) => n.status === 'Draft');
  const confirmed = notes.filter((n) => n.status === 'Confirmed');
  const readOnly = current?.status === 'Confirmed' || !canEdit;
  const ai = suggestion || p.notes.find((n) => n.aiGenerated);
  return (
    <>
      <button className="back-link" onClick={() => guard(onBack)}>
        <ArrowLeft size={16} />
        Back to patients
      </button>
      <div className="patient-workspace-heading">
        <div className="profile-title">
          <Avatar name={p.name} color={p.color} large />
          <div>
            <div className="profile-kicker">
              <span>{p.identifier}</span>
              <Badge tone="teal">SYNTHETIC PATIENT</Badge>
            </div>
            <h1>{p.name}</h1>
            <p lang="th">
              {p.thaiName}
              <span>·</span>
              {p.age} years<span>·</span>
              {p.gender}
              <span>·</span>Blood type {p.bloodType}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => guard(() => edit(null))}>
            <Plus size={17} />
            New SOAP note
          </Button>
        )}
      </div>
      <div className="patient-context">
        <div>
          <History size={17} />
          <span>
            <strong>Medical history</strong>
            <p>{p.history}</p>
          </span>
        </div>
        <div className={p.allergies.startsWith('No ') ? '' : 'allergy'}>
          <AlertCircle size={17} />
          <span>
            <strong>Allergies</strong>
            <p>{p.allergies}</p>
          </span>
        </div>
      </div>
      <div className="workspace-tabs">
        <button className={tab === 'notes' ? 'selected' : ''} onClick={() => setTab('notes')}>
          <FileText size={17} />
          Clinical documentation
        </button>
        <button className={tab === 'history' ? 'selected' : ''} onClick={() => setTab('history')}>
          <History size={17} />
          Visit history<span className="number-badge">{confirmed.length}</span>
        </button>
        <span>
          <ShieldCheck size={14} />
          Clinician-led. Always.
        </span>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          <AlertCircle size={17} />
          {error}
        </div>
      )}
      <div className="workspace-columns">
        <div className="workspace-primary">
          {tab === 'history' ? (
            <section className="card history-card">
              <div className="section-heading">
                <h2>Original clinical records</h2>
                <Badge>{confirmed.length} confirmed visits</Badge>
              </div>
              <p className="muted">
                Source documentation, separate from unapproved AI suggestions.
              </p>
              {confirmed.length ? (
                confirmed.map((n, i) => <Record key={n.id} note={n} defaultOpen={i === 0} />)
              ) : (
                <Empty
                  title="No confirmed records yet"
                  text="Confirmed clinical notes will appear here."
                />
              )}
            </section>
          ) : (
            <>
              {drafts.length > 0 && (
                <div className="draft-picker">
                  <span>
                    <FileText size={16} />
                    {drafts.length} saved {drafts.length === 1 ? 'draft' : 'drafts'}
                  </span>
                  <select
                    aria-label="Open a saved draft"
                    value={current?.status === 'Draft' ? current.id : ''}
                    onChange={(e) => {
                      const n = drafts.find((n) => n.id === Number(e.target.value));
                      if (n) guard(() => edit(n));
                    }}
                  >
                    <option value="">Continue a saved draft…</option>
                    {drafts.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.aiGenerated ? 'AI Suggested' : 'Manual draft'} · {date(n.createdAt)} · #
                        {n.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <section className="card editor-card">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">CLINICAL DOCUMENTATION</div>
                    <h2>
                      {current?.status === 'Confirmed'
                        ? 'Confirmed SOAP note'
                        : !canEdit && current
                          ? 'SOAP draft · read only'
                          : 'SOAP note'}
                    </h2>
                  </div>
                  <Badge tone={current?.status === 'Confirmed' ? 'teal' : 'amber'}>
                    {current?.status === 'Confirmed' ? (
                      <>
                        <Check size={12} />
                        Confirmed
                      </>
                    ) : (
                      <>
                        <span className="dot" />
                        Draft
                      </>
                    )}
                  </Badge>
                </div>
                <div className="editor-meta">
                  <span>
                    <Clock3 size={14} />
                    {current
                      ? `Saved ${date(current.updatedAt)} · Version ${current.version}`
                      : 'New note · not yet saved'}
                  </span>
                  {current?.aiGenerated && (
                    <Badge tone="purple">
                      <Sparkles size={12} />
                      AI Suggested
                    </Badge>
                  )}
                </div>
                {current?.aiGenerated && (
                  <div className="ai-warning">
                    <Info size={16} />
                    <span>
                      This is an AI-assisted draft. Verify it against the original records before
                      confirming.
                    </span>
                  </div>
                )}
                <form onSubmit={form.handleSubmit(save)}>
                  {sections.map((s) => (
                    <div className="soap-section" key={s.key}>
                      <div className="soap-label">
                        <span className={`soap-letter letter-${s.letter}`}>{s.letter}</span>
                        <div>
                          <label htmlFor={s.key}>{s.label}</label>
                          <small>{s.help}</small>
                        </div>
                      </div>
                      <textarea
                        id={s.key}
                        placeholder={s.placeholder}
                        rows={3}
                        maxLength={8000}
                        readOnly={readOnly}
                        disabled={!!busy}
                        {...form.register(s.key, { onChange: () => setReviewed(false) })}
                      />
                      {form.formState.errors[s.key] && (
                        <small className="field-error">
                          {form.formState.errors[s.key]?.message}
                        </small>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <>
                      <div className="editor-actions">
                        <span>
                          {changed ? (
                            <>
                              <span className="dot amber" />
                              Unsaved changes
                            </>
                          ) : current ? (
                            <>
                              <Check size={14} />
                              All changes saved
                            </>
                          ) : (
                            'Your note stays a draft until confirmed.'
                          )}
                        </span>
                        <Button variant="outline" type="submit" disabled={!!busy}>
                          <Save size={16} />
                          {busy === 'save' ? 'Saving…' : 'Save draft'}
                        </Button>
                      </div>
                      {user.role === 'Doctor' ? (
                        <div className="confirmation-area">
                          <div>
                            <ShieldCheck size={19} />
                            <span>
                              <strong>Your review makes it official.</strong>
                              <small>
                                Confirm only when the note reflects your own clinical judgment.
                              </small>
                            </span>
                          </div>
                          <label className="attestation">
                            <input
                              type="checkbox"
                              checked={reviewed}
                              disabled={!current || changed || !!busy}
                              onChange={(e) => setReviewed(e.target.checked)}
                            />
                            <span>
                              I have reviewed and edited this note and take responsibility for its
                              content.
                            </span>
                          </label>
                          <Button
                            type="button"
                            disabled={!current || !reviewed || changed || !!busy}
                            onClick={confirm}
                          >
                            <FileCheck2 size={17} />
                            {busy === 'confirm' ? 'Confirming…' : 'Confirm clinical note'}
                          </Button>
                          {(!current || changed) && (
                            <small className="muted">Save your draft before confirming.</small>
                          )}
                        </div>
                      ) : (
                        <div className="role-note">
                          <ShieldCheck size={16} />A doctor must review and confirm this draft.
                        </div>
                      )}
                    </>
                  )}
                  {current?.status === 'Confirmed' && (
                    <div className="confirmed-notice">
                      <ShieldCheck size={17} />
                      Confirmed {date(current.confirmedAt)}. Approved records are locked to preserve
                      the audit trail.
                    </div>
                  )}
                </form>
              </section>
              {confirmed[0] && (
                <section className="card source-preview">
                  <div className="section-heading">
                    <div>
                      <h2>Most recent confirmed visit</h2>
                      <p className="muted small">Original patient record</p>
                    </div>
                    <button className="text-link" onClick={() => setTab('history')}>
                      All visits
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <Record note={confirmed[0]} defaultOpen />
                </section>
              )}
            </>
          )}
        </div>
        <aside className="workspace-assistant">
          <div className="card ai-panel">
            <div className="ai-panel-heading">
              <span className="icon-tile purple">
                <Sparkles size={21} />
              </span>
              <div>
                <h2>Clinical assistant</h2>
                <span>A starting point. Your final say.</span>
              </div>
            </div>
            <div className="mode-banner">
              <span className="dot" />
              {user.aiMode === 'Demo' ? 'Demo AI Mode' : 'Live AI Mode'}
              <Badge tone="purple">{user.aiMode === 'Demo' ? 'SIMULATED' : 'OPENAI'}</Badge>
            </div>
            <p className="ai-panel-description">
              Bring the patient’s history into focus. Every suggestion is grounded in confirmed
              source records.
            </p>
            {canEdit && (
              <div className="ai-generate-actions">
                <Button
                  onClick={() =>
                    guard(() => {
                      void generate('soap');
                    })
                  }
                  disabled={!!busy}
                  className="btn-ai"
                >
                  {busy === 'soap' ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <WandSparkles size={17} />
                  )}
                  Generate SOAP draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void generate('summary');
                  }}
                  disabled={!!busy}
                >
                  {busy === 'summary' ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <FileText size={17} />
                  )}
                  Summarize patient records
                </Button>
              </div>
            )}
            {ai ? (
              <div className="suggestion-content">
                <div className="suggestion-title">
                  <Badge tone="purple">
                    <Sparkles size={12} />
                    AI Suggested
                  </Badge>
                  <span>{ai.aiMode} mode</span>
                </div>
                <h3>Patient story, at a glance</h3>
                <p>{ai.summary}</p>
                <div className="information-gap">
                  <span>
                    <AlertCircle size={15} />
                    Missing information
                  </span>
                  <p>{ai.missingInformation}</p>
                </div>
                <div className="uncertainty-box">
                  <span>
                    <Info size={15} />
                    Keep in mind
                  </span>
                  <p>{ai.uncertainty}</p>
                </div>
              </div>
            ) : (
              <div className="assistant-empty">
                <span className="ai-orb">
                  <Sparkles size={24} />
                </span>
                <h3>Ready when you are.</h3>
                <p>Generate a summary or SOAP draft to begin your review.</p>
              </div>
            )}
            <div className="ai-panel-footer">
              <ShieldCheck size={16} />
              <p>
                AI supports documentation. It does not make clinical decisions or approve records.
              </p>
            </div>
          </div>
          <div className="workflow-note">
            <span className="eyebrow">A HUMAN IN EVERY LOOP</span>
            <div>
              <span>01</span>Generate a suggestion
            </div>
            <div>
              <span>02</span>Review and make it your own
            </div>
            <div>
              <span>03</span>Explicitly confirm the note
            </div>
            <p>
              <Check size={13} />
              Every confirmation leaves an audit trail.
            </p>
          </div>
        </aside>
      </div>
      <Dialog
        open={!!discard}
        onOpenChange={(open) => {
          if (!open) setDiscard(null);
        }}
        title="Leave unsaved changes?"
      >
        <p className="muted">
          Your latest edits have not been saved. Save the draft first to keep them.
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDiscard(null)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              discard?.();
              setDiscard(null);
            }}
          >
            Discard unsaved edits
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function Record({ note, defaultOpen = false }: { note: Note; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="record">
      <button className="record-heading" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="record-icon">
          <FileCheck2 size={18} />
        </span>
        <span>
          <strong>{date(note.createdAt)}</strong>
          <small>
            {note.aiGenerated ? 'Clinician-confirmed · AI-assisted' : 'Confirmed clinical record'}
          </small>
        </span>
        <Badge tone="teal">Confirmed</Badge>
        <ChevronDown size={16} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="record-body">
          {sections.map((s) => (
            <div key={s.key}>
              <span>{s.letter}</span>
              <div>
                <h4>{s.label}</h4>
                <p>{note[s.key]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
