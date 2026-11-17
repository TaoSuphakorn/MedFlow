import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, HeartPulse, Search, ShieldCheck } from 'lucide-react';
import { api, ApiError, resetCsrf, type User } from '../lib/api';
import { LanguageSwitcher, useLanguage } from '../lib/i18n';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

export function OnboardingGuide({ user, replay, restoreFocus }: {
  user: User; replay: number; restoreFocus: () => void;
}) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const [open, setOpen] = useState(!user.onboardingSeenAt);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replaying, setReplaying] = useState(false);
  useEffect(() => {
    if (replay > 0) {
      setStep(0); setError(''); setReplaying(true); setOpen(true);
    }
  }, [replay]);
  useEffect(() => {
    if (user.onboardingSeenAt && !replaying) setOpen(false);
  }, [user.onboardingSeenAt, replaying]);

  async function dismiss() {
    if (busy) return;
    if (user.onboardingSeenAt) { setOpen(false); return; }
    setBusy(true); setError('');
    try {
      await api('/auth/onboarding', 'POST');
      client.setQueryData<User>(['me'], current => current?.userId === user.userId
        ? { ...current, onboardingSeenAt: new Date().toISOString() } : current);
      setOpen(false);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        await client.cancelQueries({ queryKey: ['me'] });
        if (client.getQueryData<User>(['me'])?.userId === user.userId) {
          client.removeQueries({ predicate: query => query.queryKey[0] !== 'me' });
          resetCsrf();
          client.setQueryData(['me'], null);
        }
      } else setError((failure as Error).message);
    } finally { setBusy(false); }
  }

  const steps = [
    { title: 'A quick look around', icon: HeartPulse,
      text: 'Start from the overview to see patients, saved notes and drafts awaiting review.',
      detail: 'All patients are fictional. This workspace is for demonstration only.' },
    { title: 'Find a patient', icon: Search,
      text: 'Open Patients in the main menu. Search by English name, Thai name or patient ID, then open a record.',
      detail: 'Read the patient history, allergies and confirmed visits before preparing a note.' },
    { title: 'Prepare a SOAP draft', icon: ClipboardCheck,
      text: 'SOAP organizes a note into Subjective, Objective, Assessment and Plan. Doctors and nurses can edit and save drafts.',
      detail: 'AI can prepare a draft or summarize confirmed records. Check every suggestion against the source. Nothing is approved automatically.' },
    { title: 'Know your role', icon: ShieldCheck,
      text: user.role === 'Doctor'
        ? 'Only doctors can confirm a reviewed note. AI never approves it for you.'
        : user.role === 'Nurse'
          ? 'You can write and save drafts. A doctor must review and confirm them.'
          : 'You can inspect records and the audit log. You cannot write or confirm clinical notes.',
      detail: 'You can reopen this guide anytime from Help & demo guide.' },
  ];
  const current = steps[step];
  const Icon = current.icon;
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) void dismiss(); }}
      title="Welcome to your workspace"
      onCloseAutoFocus={restoreFocus}
      description="Use Next and Previous to explore the guide, or skip it and reopen it from Help.">
      <div className="onboarding-guide" aria-busy={busy}>
        <div className="onboarding-topline">
          <p role="status">{t('Step {step} of {total}', { step: step + 1, total: steps.length })}</p>
          <LanguageSwitcher />
        </div>
        <ol className="onboarding-progress" aria-label={t('Guide progress')}>
          {steps.map((item, index) => <li key={item.title} aria-current={index === step ? 'step' : undefined}
            className={index <= step ? 'reached' : ''}><span className="sr-only">{t(item.title)}</span></li>)}
        </ol>
        <div className="onboarding-illustration" aria-hidden="true">
          <span className="onboarding-icon"><Icon size={42} strokeWidth={1.5} /></span>
          <span className="onboarding-check"><Check size={16} /></span>
        </div>
        <h3>{t(current.title)}</h3>
        <p className="onboarding-description">{t(current.text)}</p>
        <div className="onboarding-note"><ShieldCheck size={19} aria-hidden="true" /><p>{t(current.detail)}</p></div>
        {error && <p className="error-banner" role="alert">{t(error)}</p>}
        <div className="onboarding-actions">
          <Button variant="outline" onClick={() => void dismiss()} disabled={busy}>{t('Skip guide')}</Button>
          <div>
            {step > 0 && <Button variant="outline" disabled={busy} onClick={() => setStep(step - 1)}><ArrowLeft size={16} aria-hidden="true" />{t('Previous')}</Button>}
            <Button disabled={busy} onClick={() => step < steps.length - 1 ? setStep(step + 1) : void dismiss()}>
              {busy ? t('Saving…') : step === steps.length - 1 ? t('Start using MedFlow') : t('Next')}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
