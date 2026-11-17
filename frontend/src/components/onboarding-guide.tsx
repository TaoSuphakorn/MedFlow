import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, MousePointer2, X } from 'lucide-react';
import { api, ApiError, resetCsrf, type User } from '../lib/api';
import { LanguageSwitcher, useLanguage } from '../lib/i18n';
import { useTourTarget } from '../hooks/use-tour-target';
import { Button } from './ui/button';

export function OnboardingGuide({ user, replay, restoreFocus, patientOpen, directory, search, compact, mobile }: {
  user: User; replay: number; restoreFocus: () => void; patientOpen: boolean;
  directory: boolean; search: string; compact: boolean; mobile: boolean;
}) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const [open, setOpen] = useState(!user.onboardingSeenAt);
  const [step, setStep] = useState(patientOpen ? 3 : directory ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replaying, setReplaying] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replay > 0) {
      setStep(patientOpen ? 3 : directory ? 1 : 0);
      setError(''); setReplaying(true); setOpen(true);
    }
    // Replay is an explicit event; navigation advances the current tour below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);
  useEffect(() => {
    if (user.onboardingSeenAt && !replaying) setOpen(false);
  }, [user.onboardingSeenAt, replaying]);
  useEffect(() => {
    if (!open) return;
    if (patientOpen && step < 3) setStep(3);
    else if (!patientOpen && directory && step === 0) setStep(1);
    else if (!patientOpen && step >= 3) setStep(directory ? 1 : 0);
  }, [patientOpen, directory, step, open]);

  async function dismiss() {
    if (busy) return;
    if (user.onboardingSeenAt) { setOpen(false); restoreFocus(); return; }
    setBusy(true); setError('');
    try {
      await api('/auth/onboarding', 'POST');
      client.setQueryData<User>(['me'], current => current?.userId === user.userId
        ? { ...current, onboardingSeenAt: new Date().toISOString() } : current);
      setOpen(false); restoreFocus();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        await client.cancelQueries({ queryKey: ['me'] });
        if (client.getQueryData<User>(['me'])?.userId === user.userId) {
          client.removeQueries({ predicate: query => query.queryKey[0] !== 'me' });
          resetCsrf(); client.setQueryData(['me'], null);
        }
      } else setError((failure as Error).message);
    } finally { setBusy(false); }
  }
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); void dismissRef.current();
      }
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [open]);

  const selector = step === 0 ? compact && !mobile ? '[data-tour="menu"]' : '[data-tour="patients"]'
    : step === 1 ? '[data-tour="search"]' : step === 2 ? '[data-tour="open-patient"]'
    : step === 3 || user.role === 'Administrator' ? '[data-tour="history"]' : '[data-tour="soap-field"] || [data-tour="documentation-tab"]';
  const { box, x, y, width, limit, keyboard, targetName } = useTourTarget(open, selector, panel);
  if (!open) return null;
  const titles = ['Open the patient directory', 'Find a patient', 'Open the patient record', 'Review patient history', 'Know your role'];
  const descriptions = [
    compact && !mobile ? 'Click the highlighted menu button to start.' : 'Click Patients in the highlighted menu to continue.',
    'Type a name or patient ID in the highlighted search box, then choose Next.',
    'Click the highlighted arrow to open the patient record.',
    'This area shows the patient history and allergies. Review it before preparing a note.',
    user.role === 'Doctor' ? 'Only doctors can confirm a reviewed note. AI never approves it for you.'
      : user.role === 'Nurse' ? 'You can write and save drafts. A doctor must review and confirm them.'
      : 'You can inspect records and the audit log. You cannot write or confirm clinical notes.',
  ];
  return createPortal(<div className="tour-layer">
    {box ? <>
      <div className="tour-shade" style={{ inset: `0 0 auto 0`, height: box.top }} />
      <div className="tour-shade" style={{ top: box.bottom, bottom: 0, left: 0, right: 0 }} />
      <div className="tour-shade" style={{ top: box.top, left: 0, width: box.left, height: box.height }} />
      <div className="tour-shade" style={{ top: box.top, left: box.right, right: 0, height: box.height }} />
      <div className="tour-spotlight" aria-hidden="true" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
    </> : <div className="tour-shade" style={{ inset: 0 }} />}
    <div ref={panel} role="dialog" aria-label={t('Interactive tutorial')} aria-describedby="tutorial-description"
      className="tour-panel" data-keyboard={keyboard || undefined} style={{ left: x, top: y, width, maxHeight: limit }} aria-busy={busy}>
      <div className="tour-header"><span><MousePointer2 size={17} aria-hidden="true" />{t('Interactive tutorial')}</span>
        <button className="tour-close" aria-label={t('Close')} onClick={() => void dismiss()} disabled={busy}><X size={18} /></button></div>
      <div className="tour-meta"><p role="status">{t('Step {step} of {total}', { step: step + 1, total: 5 })}</p><LanguageSwitcher /></div>
      <div className="tour-body">
      <h2>{t(titles[step])}</h2>
      <p id="tutorial-description">{t(targetName === 'documentation-tab' ? 'Click Clinical documentation to see the SOAP fields.' : descriptions[step])}</p>
      {step === 4 && <p className="tour-note">{t(user.role === 'Administrator'
        ? 'You can reopen this guide anytime from Help & demo guide.'
        : 'Use this field for reported symptoms. Complete all four SOAP sections, then save and review the draft yourself.')}</p>}
      {!box && <p className="tour-note">{t('Waiting for the highlighted control. If there are no results, go back and change the search.')}</p>}
      {error && <p className="error-banner" role="alert">{t(error)}</p>}
      </div>
      <div className="tour-actions">
        <Button variant="outline" onClick={() => void dismiss()} disabled={busy}>{t('Skip guide')}</Button>
        {step === 2 && <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>{t('Previous')}</Button>}
        {(step === 1 || step >= 3) && targetName !== 'documentation-tab' && <Button disabled={busy || !box || (step === 1 && !search.trim())}
          onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); step === 4 ? void dismiss() : setStep(step + 1); }}>
          {busy ? t('Saving…') : step === 4 ? t('Start using MedFlow') : t('Next')}<ArrowRight size={15} aria-hidden="true" />
        </Button>}
      </div>
    </div>
  </div>, document.body);
}
