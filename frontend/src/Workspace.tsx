import { useLanguage } from './lib/i18n';
import { useEffect, useRef, useState } from 'react';
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
  CircleCheck,
  Clock3,
  FileCheck2,
  FileText,
  History,
  HeartPulse,
  Link2,
  Info,
  ListChecks,
  LoaderCircle,
  PenLine,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import { api, date, type Note, type Patient, type Soap, type User } from './lib/api';
import { Avatar, Badge, Empty, ErrorState, Loading } from './components/shared';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
import { Select } from './components/ui/select';
import { VitalsPanel } from './components/vitals';

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
type SectionKey = keyof Soap;
// The stored AI text is the baseline, so edits stay visible after a draft is saved and reopened.
const soapOf = (n: Note | null): Soap => {
  if (!n) return blank;
  const base: Soap = { subjective: n.subjective, objective: n.objective, assessment: n.assessment, plan: n.plan };
  for (const r of n.sectionReviews ?? []) base[r.section] = r.aiText;
  return base;
};
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
    help: 'Treatment plan and follow-up documented by the clinician.',
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
  const { t, locale } = useLanguage();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['patient', id], queryFn: () => api<Patient>(`/patients/${id}`) });
  const [current, setCurrent] = useState<Note | null>(null);
  const [suggestion, setSuggestion] = useState<Note | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [tab, setTab] = useState<'notes' | 'history' | 'vitals'>('notes');
  // Confirmed visit a summary citation points at; the history tab opens and highlights it.
  const [highlight, setHighlight] = useState<number | null>(null);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  // Original AI text per section; used to show per-section AI provenance.
  const [baseline, setBaseline] = useState<Soap>(blank);
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
    setBaseline(soapOf(note));
    setReviewed(false);
    setError('');
    setTab('notes');
    setHighlight(null);
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
    if (!current || !reviewed || changed || !sectionsDone) return;
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
  const hasAllergy = !/^no\b/i.test(p.allergies.trim());
  const values = form.watch();
  const reviews = current?.sectionReviews ?? [];
  const aiReview = !!current?.aiGenerated && reviews.length > 0 && !readOnly;
  const isChecked = (k: SectionKey) => !!reviews.find((r) => r.section === k)?.reviewedAt;
  const isEdited = (k: SectionKey) => (values[k] ?? '').trim() !== baseline[k].trim();
  const isReviewed = (k: SectionKey) => isEdited(k) || isChecked(k);
  const reviewedCount = sections.filter((s) => isReviewed(s.key)).length;
  const sectionsDone = !aiReview || reviewedCount === sections.length;
  async function toggleChecked(k: SectionKey) {
    if (!current) return;
    setBusy('review');
    setError('');
    setReviewed(false);
    try {
      const n = await api<Note>(`/notes/${current.id}/sections/${k}/review`, isChecked(k) ? 'DELETE' : 'POST');
      // Keep in-progress edits; only the review marks changed on the server.
      setCurrent((prev) => (prev ? { ...prev, sectionReviews: n.sectionReviews } : prev));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <button className="back-link" onClick={() => guard(onBack)}>
        <ArrowLeft size={16} />
        {t('Back to patients')}
      </button>
      <header
        className="patient-workspace-heading patient-banner"
        aria-label={t('Patient banner')}
        data-tour="history"
      >
          <div className="profile-title">
            <Avatar name={p.name} color={p.color} large />
            <div>
              <div className="profile-kicker">
                <span>{p.identifier}</span>
                <Badge tone="teal">{t('SYNTHETIC PATIENT')}</Badge>
              </div>
              <h1>{p.name}</h1>
              <p lang="th">
                {p.thaiName}
                <span>·</span>
                {p.age} {' ' + t('years')}
                <span>·</span>
                {t(p.gender)}
                <span>·</span>
                {t('Blood type') + ' '}
                {p.bloodType}
              </p>
            </div>
          </div>
          <div className={`allergy-flag ${hasAllergy ? 'is-alert' : 'is-clear'}`}>
            {hasAllergy ? <TriangleAlert size={18} aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
            <span>
              <strong>{hasAllergy ? t('Allergy alert') : t('Allergies')}</strong>
              <span>{p.allergies}</span>
            </span>
          </div>
          {canEdit && (
            <Button variant="outline" onClick={() => guard(() => edit(null))}>
              <Plus size={17} />
              {t('New SOAP note')}
            </Button>
          )}
          <div className="banner-history">
            <History size={15} aria-hidden />
            <strong>{t('Medical history')}</strong>
            <span>{p.history}</span>
          </div>
        </header>
      <div className="workspace-tabs">
        <button data-tour="documentation-tab" className={tab === 'notes' ? 'selected' : ''} onClick={() => setTab('notes')}>
          <FileText size={17} />
          {t('Clinical documentation')}
        </button>
        <button className={tab === 'history' ? 'selected' : ''} onClick={() => setTab('history')}>
          <History size={17} />
          {t('Visit history')}
          <span className="number-badge">{confirmed.length}</span>
        </button>
        <button className={tab === 'vitals' ? 'selected' : ''} onClick={() => setTab('vitals')}>
          <HeartPulse size={17} />
          {t('Vital signs')}
        </button>
        <span>
          <ShieldCheck size={14} />
          {t('Clinician-led. Always.')}
        </span>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          <AlertCircle size={17} />
          {t(error)}
        </div>
      )}
      <div className="workspace-columns">
        <div className="workspace-primary">
          {tab === 'vitals' ? (
            <VitalsPanel patientId={id} canRecord={canEdit} notify={notify} />
          ) : tab === 'history' ? (
            <section className="card history-card">
              <div className="section-heading">
                <h2>{t('Original clinical records')}</h2>
                <Badge>{t('Confirmed visits: {count}', { count: confirmed.length })}</Badge>
              </div>
              <p className="muted">
                {t('Source documentation, separate from unapproved AI suggestions.')}
              </p>
              {confirmed.length ? (
                confirmed.map((n, i) => (
                  <Record key={n.id} note={n} defaultOpen={i === 0} highlighted={highlight === n.id} />
                ))
              ) : (
                <Empty
                  title={t('No confirmed records yet')}
                  text={t('Confirmed clinical notes will appear here.')}
                />
              )}
            </section>
          ) : (
            <>
              {drafts.length > 0 && (
                <div className="draft-picker">
                  <span>
                    <FileText size={16} />
                    {t('Saved drafts: {count}', { count: drafts.length })}
                  </span>
                  <Select
                    label={t('Open a saved draft')}
                    value={current?.status === 'Draft' ? String(current.id) : ''}
                    placeholder={t('Continue a saved draft…')}
                    onChange={(value) => {
                      const n = drafts.find((n) => n.id === Number(value));
                      if (n) guard(() => edit(n));
                    }}
                    options={drafts.map(n => ({ value: String(n.id), label: `${n.aiGenerated ? t('AI Suggested') : t('Manual draft')} · ${date(n.createdAt, locale)} · #${n.id}` }))}
                  />
                </div>
              )}
              <section className="card editor-card">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">{t('CLINICAL DOCUMENTATION')}</div>
                    <h2>
                      {current?.status === 'Confirmed'
                        ? t('Confirmed SOAP note')
                        : !canEdit && current
                          ? t('SOAP draft · read only')
                          : t('SOAP note')}
                    </h2>
                  </div>
                  <Badge tone={current?.status === 'Confirmed' ? 'teal' : 'amber'}>
                    {current?.status === 'Confirmed' ? (
                      <>
                        <Check size={12} />
                        {t('Confirmed')}
                      </>
                    ) : (
                      <>
                        <span className="dot" />
                        {t('Draft')}
                      </>
                    )}
                  </Badge>
                </div>
                <div className="editor-meta">
                  <span>
                    <Clock3 size={14} />
                    {current
                      ? t('Saved {date} · Version {version}', {
                          date: date(current.updatedAt, locale),
                          version: current.version,
                        })
                      : t('New note · not yet saved')}
                  </span>
                  {current?.aiGenerated && (
                    <Badge tone="purple">
                      <Sparkles size={12} />
                      {t('AI Suggested')}
                    </Badge>
                  )}
                </div>
                {current?.aiGenerated && (
                  <div className="ai-warning">
                    <Info size={16} />
                    <span>
                      {t(
                        'This is an AI-assisted draft. Verify it against the original records before confirming.',
                      )}
                    </span>
                  </div>
                )}
                {aiReview && (
                  <div className="review-progress">
                    <ListChecks size={16} aria-hidden />
                    <span>
                      {t('AI sections reviewed: {done} of {total}', {
                        done: reviewedCount,
                        total: sections.length,
                      })}
                    </span>
                    <span
                      className="review-meter"
                      role="progressbar"
                      aria-label={t('AI section review progress')}
                      aria-valuemin={0}
                      aria-valuemax={sections.length}
                      aria-valuenow={reviewedCount}
                    >
                      <span style={{ width: `${(reviewedCount / sections.length) * 100}%` }} />
                    </span>
                  </div>
                )}
                <form onSubmit={form.handleSubmit(save)}>
                  {sections.map((s) => (
                    <div
                      className={`soap-section${aiReview ? (isReviewed(s.key) ? ' ai-reviewed' : ' ai-pending') : ''}`}
                      key={s.key}
                    >
                      <div className="soap-label">
                        <span className={`soap-letter letter-${s.letter}`}>{s.letter}</span>
                        <div>
                          <label htmlFor={s.key}>{t(s.label)}</label>
                          <small>{t(s.help)}</small>
                        </div>
                        {aiReview && (
                          <div className="provenance">
                            {isEdited(s.key) ? (
                              <Badge tone="teal">
                                <PenLine size={12} aria-hidden />
                                {t('Edited by clinician')}
                              </Badge>
                            ) : (
                              <>
                                <Badge tone="purple">
                                  <Sparkles size={12} aria-hidden />
                                  {t('AI Suggested')}
                                </Badge>
                                {user.role === 'Doctor' && (
                                  <button
                                    type="button"
                                    className={`review-toggle${isChecked(s.key) ? ' on' : ''}`}
                                    aria-pressed={isChecked(s.key)}
                                    aria-label={t('Mark {section} as reviewed', { section: t(s.label) })}
                                    disabled={!!busy}
                                    onClick={() => {
                                      void toggleChecked(s.key);
                                    }}
                                  >
                                    <CircleCheck size={15} aria-hidden />
                                    {isChecked(s.key) ? t('Reviewed') : t('Mark reviewed')}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <textarea
                        data-tour={s.key === 'subjective' ? 'soap-field' : undefined}
                        id={s.key}
                        placeholder={t(s.placeholder)}
                        rows={3}
                        maxLength={8000}
                        readOnly={readOnly}
                        disabled={!!busy}
                        {...form.register(s.key, { onChange: () => setReviewed(false) })}
                      />
                      {form.formState.errors[s.key] && (
                        <small className="field-error">
                          {t(form.formState.errors[s.key]?.message)}
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
                              {t('Unsaved changes')}
                            </>
                          ) : current ? (
                            <>
                              <Check size={14} />
                              {t('All changes saved')}
                            </>
                          ) : (
                            t('Your note stays a draft until confirmed.')
                          )}
                        </span>
                        <Button variant="outline" type="submit" disabled={!!busy}>
                          <Save size={16} />
                          {busy === 'save' ? t('Saving…') : t('Save draft')}
                        </Button>
                      </div>
                      {user.role === 'Doctor' ? (
                        <div className="confirmation-area">
                          <div>
                            <ShieldCheck size={19} />
                            <span>
                              <strong>{t('Review before confirming')}</strong>
                              <small>
                                {t(
                                  'Confirm only when the note reflects your own clinical judgment.',
                                )}
                              </small>
                            </span>
                          </div>
                          <label className="attestation">
                            <input
                              type="checkbox"
                              checked={reviewed}
                              disabled={!current || changed || !sectionsDone || !!busy}
                              onChange={(e) => setReviewed(e.target.checked)}
                            />
                            <span>
                              {t(
                                'I have reviewed and edited this note and take responsibility for its content.',
                              )}
                            </span>
                          </label>
                          <Button
                            type="button"
                            disabled={!current || !reviewed || changed || !sectionsDone || !!busy}
                            onClick={confirm}
                          >
                            <FileCheck2 size={17} />
                            {busy === 'confirm' ? t('Confirming…') : t('Confirm clinical note')}
                          </Button>
                          {(!current || changed) && (
                            <small className="muted">
                              {t('Save your draft before confirming.')}
                            </small>
                          )}
                          {current && !changed && !sectionsDone && (
                            <small className="muted">
                              {t('Review every AI-suggested section before confirming.')}
                            </small>
                          )}
                        </div>
                      ) : (
                        <div className="role-note">
                          <ShieldCheck size={16} />
                          {t('A doctor must review and confirm this draft.')}
                        </div>
                      )}
                    </>
                  )}
                  {current?.status === 'Confirmed' && (
                    <div className="confirmed-notice">
                      <ShieldCheck size={17} />
                      {t('Confirmed') + ' '}
                      {date(current.confirmedAt, locale)}
                      {t('. Approved records are locked to preserve the audit trail.')}
                    </div>
                  )}
                </form>
              </section>
              {confirmed[0] && (
                <section className="card source-preview">
                  <div className="section-heading">
                    <div>
                      <h2>{t('Most recent confirmed visit')}</h2>
                      <p className="muted small">{t('Original patient record')}</p>
                    </div>
                    <button className="text-link" onClick={() => setTab('history')}>
                      {t('All visits')}
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
                <h2>{t('Clinical assistant')}</h2>
                <span>{t('Drafts from confirmed source records')}</span>
              </div>
            </div>
            <div className="mode-banner">
              <span className="dot" />
              {user.aiMode === 'Demo' ? t('Demo AI Mode') : t('Live AI Mode')}
              <Badge tone="purple">{user.aiMode === 'Demo' ? t('SIMULATED') : t('OPENAI')}</Badge>
            </div>
            <p className="ai-panel-description">
              {t(
                'Generate a summary or SOAP draft from the confirmed visit history. Review all AI content before use.',
              )}
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
                  {t('Generate SOAP draft')}
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
                  {t('Summarize patient records')}
                </Button>
              </div>
            )}
            {ai ? (
              <div className="suggestion-content">
                <div className="suggestion-title">
                  <Badge tone="purple">
                    <Sparkles size={12} />
                    {t('AI Suggested')}
                  </Badge>
                  <span>{ai.aiMode === 'Demo' ? t('Demo AI Mode') : t('Live AI Mode')}</span>
                </div>
                <h3>{t('Patient summary')}</h3>
                {ai.summarySentences?.length ? (
                  <ol className="cited-summary">
                    {ai.summarySentences.map((sentence) => (
                      <li key={sentence.ordinal} className={sentence.sourceNoteIds.length ? '' : 'uncited'}>
                        <p>{sentence.text}</p>
                        {sentence.sourceNoteIds.length ? (
                          <span className="citations">
                            {sentence.sourceNoteIds.map((sourceId) => {
                              const source = p.notes.find((n) => n.id === sourceId);
                              const label = source ? date(source.createdAt, locale) : `#${sourceId}`;
                              return (
                                <button
                                  key={sourceId}
                                  type="button"
                                  className="citation"
                                  aria-label={t('Show source visit {date}', { date: label })}
                                  onClick={() => {
                                    setHighlight(sourceId);
                                    setTab('history');
                                  }}
                                >
                                  <Link2 size={12} aria-hidden />
                                  {label}
                                </button>
                              );
                            })}
                          </span>
                        ) : (
                          <span className="uncited-flag">
                            <AlertCircle size={13} aria-hidden />
                            {t('No source visit. Verify against the patient profile.')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>{ai.summary}</p>
                )}
                <div className="information-gap">
                  <span>
                    <AlertCircle size={15} />
                    {t('Missing information')}
                  </span>
                  <p>{ai.missingInformation}</p>
                </div>
                <div className="uncertainty-box">
                  <span>
                    <Info size={15} />
                    {t('Keep in mind')}
                  </span>
                  <p>{ai.uncertainty}</p>
                </div>
              </div>
            ) : (
              <div className="assistant-empty">
                <span className="ai-orb">
                  <Sparkles size={24} />
                </span>
                <h3>{t('No suggestion generated')}</h3>
                <p>{t('Generate a summary or SOAP draft to begin your review.')}</p>
              </div>
            )}
            <div className="ai-panel-footer">
              <ShieldCheck size={16} />
              <p>
                {t(
                  'AI supports documentation. It does not make clinical decisions or approve records.',
                )}
              </p>
            </div>
          </div>
          <div className="workflow-note">
            <span className="eyebrow">{t('REVIEW WORKFLOW')}</span>
            <div>
              <span>01</span>
              {t('Generate a suggestion')}
            </div>
            <div>
              <span>02</span>
              {t('Review and make it your own')}
            </div>
            <div>
              <span>03</span>
              {t('Explicitly confirm the note')}
            </div>
            <p>
              <Check size={13} />
              {t('Every confirmation leaves an audit trail.')}
            </p>
          </div>
        </aside>
      </div>
      <Dialog
        open={!!discard}
        onOpenChange={(open) => {
          if (!open) setDiscard(null);
        }}
        title={t('Leave unsaved changes?')}
      >
        <p className="muted">
          {t('Your latest edits have not been saved. Save the draft first to keep them.')}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDiscard(null)}>
            {t('Keep editing')}
          </Button>
          <Button
            onClick={() => {
              discard?.();
              setDiscard(null);
            }}
          >
            {t('Discard unsaved edits')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function Record({
  note,
  defaultOpen = false,
  highlighted = false,
}: {
  note: Note;
  defaultOpen?: boolean;
  highlighted?: boolean;
}) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(defaultOpen || highlighted);
  const heading = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!highlighted) return;
    setOpen(true);
    heading.current?.scrollIntoView({ block: 'center' });
    heading.current?.focus({ preventScroll: true });
  }, [highlighted]);
  return (
    <article className={`record${highlighted ? ' highlighted' : ''}`} aria-current={highlighted || undefined}>
      <button ref={heading} className="record-heading" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="record-icon">
          <FileCheck2 size={18} />
        </span>
        <span>
          <strong>{date(note.createdAt, locale)}</strong>
          <small>
            {note.aiGenerated
              ? t('Clinician-confirmed · AI-assisted')
              : t('Confirmed clinical record')}
          </small>
        </span>
        <Badge tone="teal">{t('Confirmed')}</Badge>
        <ChevronDown size={16} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="record-body">
          {sections.map((s) => (
            <div key={s.key}>
              <span>{s.letter}</span>
              <div>
                <h4>{t(s.label)}</h4>
                <p>{note[s.key]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
