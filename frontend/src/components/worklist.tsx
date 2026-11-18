import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  DoorOpen,
  FileClock,
  LoaderCircle,
  Play,
  Undo2,
  UserPlus,
} from 'lucide-react';
import { api, type Patient, type User } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { Badge, Empty, ErrorState, Loading } from './shared';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Select } from './ui/select';

export type VisitStatus = 'Waiting' | 'InExam' | 'Completed';
export type WorklistItem = {
  id: number;
  patientId: number;
  identifier: string;
  name: string;
  thaiName: string;
  age: number;
  gender: string;
  allergies: string;
  scheduledAt: string;
  reason: string;
  room: string;
  status: VisitStatus;
  version: number;
  draftCount: number;
};
type Filter = 'all' | VisitStatus;

const statusLabel: Record<VisitStatus, string> = {
  Waiting: 'Waiting',
  InExam: 'In exam',
  Completed: 'Completed',
};
const hasAllergy = (text: string) => !/^no\b/i.test(text.trim());

export function Worklist({
  user,
  patients,
  onOpen,
  notify,
}: {
  user: User;
  patients: Patient[];
  onOpen: (patientId: number) => void;
  notify: (message: string) => void;
}) {
  const { t, locale } = useLanguage();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['worklist'], queryFn: () => api<WorklistItem[]>('/worklist') });
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState(false);
  const canAct = user.role !== 'Administrator';
  const time = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    }).format(new Date(value));

  async function move(visit: WorklistItem, status: VisitStatus) {
    setBusy(visit.id);
    setError('');
    try {
      await api<WorklistItem>(`/encounters/${visit.id}/status`, 'POST', {
        status,
        version: visit.version,
      });
      await qc.invalidateQueries({ queryKey: ['worklist'] });
      if (status === 'InExam') {
        notify(t('Exam started for {name}.', { name: visit.name }));
        if (visit.status === 'Waiting') onOpen(visit.patientId);
      } else if (status === 'Completed') notify(t('Visit completed for {name}.', { name: visit.name }));
      else notify(t('{name} returned to the queue.', { name: visit.name }));
    } catch (e) {
      setError((e as Error).message);
      await qc.invalidateQueries({ queryKey: ['worklist'] });
    } finally {
      setBusy(null);
    }
  }

  if (q.isPending)
    return (
      <section className="card worklist">
        <Loading />
      </section>
    );
  if (q.error)
    return (
      <ErrorState
        error={q.error}
        retry={() => {
          void q.refetch();
        }}
      />
    );
  const visits = q.data;
  const count = (s: VisitStatus) => visits.filter((v) => v.status === s).length;
  const shown = filter === 'all' ? visits : visits.filter((v) => v.status === filter);
  const active = new Set(visits.filter((v) => v.status !== 'Completed').map((v) => v.patientId));

  return (
    <section className="card worklist" aria-labelledby="worklist-title" data-tour="worklist">
      <div className="worklist-head">
        <div>
          <h2 id="worklist-title">{t('Today’s clinic queue')}</h2>
          <p className="muted">
            {t('{done} of {total} visits completed. Start an exam to open the patient record.', {
              done: count('Completed'),
              total: visits.length,
            })}
          </p>
        </div>
        {canAct && (
          <Button variant="outline" onClick={() => setCheckIn(true)}>
            <UserPlus size={17} />
            {t('Check in patient')}
          </Button>
        )}
      </div>
      <div className="worklist-filters" role="group" aria-label={t('Visit status filter')}>
        {(['all', 'Waiting', 'InExam', 'Completed'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={`filter-chip${filter === f ? ' on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? t('All') : t(statusLabel[f])}
            <span className="chip-count">{f === 'all' ? visits.length : count(f)}</span>
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="error-banner">
          <AlertCircle size={17} />
          {t(error)}
        </div>
      )}
      {shown.length === 0 ? (
        <Empty title={t('No visits in this view')} text={t('Checked-in patients will appear here.')} />
      ) : (
        <ol className="visit-list">
          {shown.map((v) => (
            <li key={v.id} className={`visit-card status-${v.status}`}>
              <div className="visit-time">
                <strong>{time(v.scheduledAt)}</strong>
                <span>
                  <DoorOpen size={13} aria-hidden />
                  {v.room}
                </span>
              </div>
              <div className="visit-main">
                <div className="visit-name">
                  <strong>{v.name}</strong>
                  <span lang="th">{v.thaiName}</span>
                </div>
                <div className="visit-meta">
                  {v.identifier} · {v.age} {t('years')} · {t(v.gender)}
                </div>
                <p className="visit-reason">{v.reason}</p>
                <div className="visit-flags">
                  <span className={`visit-status-badge status-${v.status}`}>
                    {v.status === 'Completed' ? (
                      <CheckCircle2 size={13} aria-hidden />
                    ) : (
                      <Clock3 size={13} aria-hidden />
                    )}
                    {t(statusLabel[v.status])}
                  </span>
                  {hasAllergy(v.allergies) && (
                    <span className="visit-allergy">
                      <AlertCircle size={13} aria-hidden />
                      {t('Allergy')}: {v.allergies}
                    </span>
                  )}
                  {v.draftCount > 0 && (
                    <Badge tone="amber">
                      <FileClock size={12} aria-hidden />
                      {t('{count} drafts to confirm', { count: v.draftCount })}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="visit-actions">
                {canAct && v.status === 'Waiting' && (
                  <Button disabled={busy !== null} onClick={() => void move(v, 'InExam')}>
                    {busy === v.id ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                    {t('Start exam')}
                  </Button>
                )}
                {canAct && v.status === 'InExam' && (
                  <>
                    <Button disabled={busy !== null} onClick={() => void move(v, 'Completed')}>
                      {busy === v.id ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      {t('Complete visit')}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void move(v, 'Waiting')}
                    >
                      <Undo2 size={16} />
                      {t('Return to queue')}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  aria-label={t('Open record for {name}', { name: v.name })}
                  onClick={() => onOpen(v.patientId)}
                >
                  {t('Open record')}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <CheckInDialog
        open={checkIn}
        onOpenChange={setCheckIn}
        patients={patients.filter((p) => !active.has(p.id))}
        onDone={async (name) => {
          await qc.invalidateQueries({ queryKey: ['worklist'] });
          setFilter('all');
          notify(t('{name} checked in.', { name }));
        }}
      />
    </section>
  );
}

function CheckInDialog({
  open,
  onOpenChange,
  patients,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  onDone: (name: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  function close(next: boolean) {
    if (!next) {
      setPatientId('');
      setReason('');
      setError('');
    }
    onOpenChange(next);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const chosen = patients.find((p) => String(p.id) === patientId);
    if (!chosen) return setError('Choose a patient.');
    if (!reason.trim()) return setError('Enter a visit reason of 200 characters or fewer.');
    setSaving(true);
    setError('');
    try {
      await api('/encounters', 'POST', { patientId: chosen.id, reason });
      close(false);
      await onDone(chosen.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t('Check in patient')}
      description={t('Add a walk-in visit to today’s queue.')}
    >
      <form className="check-in-form" onSubmit={submit}>
        <div className="field">
          <span className="field-label">{t('Patient')}</span>
          <Select
            label={t('Patient')}
            value={patientId}
            placeholder={t('Choose a patient')}
            onChange={setPatientId}
            options={patients.map((p) => ({
              value: String(p.id),
              label: `${p.name} · ${p.thaiName} · ${p.identifier}`,
            }))}
          />
        </div>
        <label className="field">
          <span className="field-label">{t('Visit reason')}</span>
          <input
            value={reason}
            maxLength={200}
            placeholder={t('e.g. Follow-up visit')}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="field-error">
            {t(error)}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <LoaderCircle size={16} className="spin" /> : <UserPlus size={16} />}
            {t('Check in')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
