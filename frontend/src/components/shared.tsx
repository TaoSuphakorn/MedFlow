import { useLanguage } from '../lib/i18n';
import { Activity, AlertCircle, LoaderCircle, Search } from 'lucide-react';
import { initials } from '../lib/api';
export function Logo() {
  const { t } = useLanguage();
  return (
    <div className="brand">
      <span className="brand-mark">
        <Activity size={25} strokeWidth={2.6} />
      </span>
      <span>
        MedFlow<span className="brand-ai">AI</span>
        <small>{t('CLINICAL WORKSPACE')}</small>
      </span>
    </div>
  );
}
export function Avatar({
  name,
  color = 'teal',
  large = false,
}: {
  name: string;
  color?: string;
  large?: boolean;
}) {
  return <span className={`avatar ${color} ${large ? 'avatar-lg' : ''}`}>{initials(name)}</span>;
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Loading() {
  const { t } = useLanguage();
  return (
    <div className="state">
      <LoaderCircle className="spin" size={26} />
      <p>{t('Loading your workspace…')}</p>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="state error-state">
      <AlertCircle size={28} />
      <h3>{t('We couldn’t load this view')}</h3>
      <p>{t(error.message)}</p>
      <button className="btn btn-outline" onClick={retry}>
        {t('Try again')}
      </button>
    </div>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  const { t } = useLanguage();
  return (
    <div className="state">
      <span className="empty-icon">
        <Search size={25} />
      </span>
      <h3>{t(title)}</h3>
      <p>{t(text)}</p>
    </div>
  );
}
