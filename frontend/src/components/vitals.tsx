import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, LoaderCircle, OctagonAlert, Plus, Table2 } from 'lucide-react';
import { api, type VitalField, type VitalFlag, type VitalReading } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { Empty, ErrorState, Loading } from './shared';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

type Metric = { field: VitalField; label: string; unit: string; step: string; normal: [number, number] };
// Normal bands mirror the server's demonstration thresholds (backend VitalRules.cs).
const metrics: Metric[] = [
  { field: 'systolic', label: 'Systolic BP', unit: 'mmHg', step: '1', normal: [100, 139] },
  { field: 'diastolic', label: 'Diastolic BP', unit: 'mmHg', step: '1', normal: [50, 89] },
  { field: 'pulse', label: 'Pulse', unit: 'bpm', step: '1', normal: [50, 100] },
  { field: 'temperatureC', label: 'Temperature', unit: '°C', step: '0.1', normal: [36, 37.4] },
  { field: 'respiratoryRate', label: 'Respiratory rate', unit: '/min', step: '1', normal: [12, 20] },
  { field: 'spO2', label: 'SpO₂', unit: '%', step: '1', normal: [95, 100] },
];
const SERIES_1 = '#1d5fd1';
const SERIES_2 = '#c2610f';

export function flagLabel(f: VitalFlag | undefined) {
  if (!f) return 'Normal';
  return f.level === 'critical'
    ? f.direction === 'high'
      ? 'Critically high'
      : 'Critically low'
    : f.direction === 'high'
      ? 'High'
      : 'Low';
}

export function VitalsPanel({
  patientId,
  canRecord,
  notify,
}: {
  patientId: number;
  canRecord: boolean;
  notify: (message: string) => void;
}) {
  const { t, locale } = useLanguage();
  const q = useQuery({
    queryKey: ['vitals', patientId],
    queryFn: () => api<VitalReading[]>(`/patients/${patientId}/vitals`),
  });
  const [recording, setRecording] = useState(false);
  const [table, setTable] = useState(false);
  const when = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    }).format(new Date(value));

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
  const readings = q.data;
  const latest = readings[0];
  const ordered = [...readings].reverse();
  const critical = latest?.flags.filter((f) => f.level === 'critical').length ?? 0;

  return (
    <section className="card vitals-card" aria-labelledby="vitals-title">
      <div className="section-heading">
        <div>
          <h2 id="vitals-title">{t('Vital signs')}</h2>
          <p className="muted small">
            {latest
              ? t('Latest reading {date}', { date: when(latest.recordedAt) })
              : t('No vital signs recorded yet')}
          </p>
        </div>
        {canRecord && (
          <Button onClick={() => setRecording(true)}>
            <Plus size={16} />
            {t('Record vital signs')}
          </Button>
        )}
      </div>
      {!latest ? (
        <Empty title={t('No vital signs recorded yet')} text={t('Recorded readings and alerts will appear here.')} />
      ) : (
        <>
          {latest.flags.length > 0 && (
            <div className={`vitals-alert ${critical ? 'is-critical' : 'is-warning'}`}>
              {critical ? <OctagonAlert size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
              <span>
                <strong>
                  {critical
                    ? t('{count} critical alerts in the latest reading', { count: critical })
                    : t('{count} warnings in the latest reading', { count: latest.flags.length })}
                </strong>
                {t('Demonstration thresholds only. Confirm values and follow local clinical protocols.')}
              </span>
            </div>
          )}
          <div className="vital-tiles">
            {metrics.map((m) => {
              const flag = latest.flags.find((f) => f.field === m.field);
              return (
                <div key={m.field} className={`vital-tile ${flag ? `is-${flag.level}` : 'is-normal'}`}>
                  <span className="vital-label">{t(m.label)}</span>
                  <strong>
                    {latest[m.field]}
                    <small>{m.unit}</small>
                  </strong>
                  <span className="vital-status">
                    {!flag ? (
                      <CheckCircle2 size={13} aria-hidden />
                    ) : flag.level === 'critical' ? (
                      <OctagonAlert size={13} aria-hidden />
                    ) : (
                      <AlertTriangle size={13} aria-hidden />
                    )}
                    {t(flagLabel(flag))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="trend-heading">
            <h3>
              <Activity size={16} aria-hidden />
              {t('Trends')}
              <span className="muted small">{t('{count} readings', { count: readings.length })}</span>
            </h3>
            <Button variant="outline" aria-pressed={table} onClick={() => setTable(!table)}>
              <Table2 size={16} />
              {table ? t('Show charts') : t('Show table')}
            </Button>
          </div>
          {table ? (
            <div className="vitals-table-wrap">
              <table className="vitals-table">
                <caption className="sr-only">{t('Vital sign readings, newest first')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('Recorded')}</th>
                    {metrics.map((m) => (
                      <th key={m.field} scope="col">
                        {t(m.label)} <small>({m.unit})</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{when(r.recordedAt)}</th>
                      {metrics.map((m) => {
                        const flag = r.flags.find((f) => f.field === m.field);
                        return (
                          <td key={m.field} className={flag ? `is-${flag.level}` : undefined}>
                            {r[m.field]}
                            {flag && <span className="cell-flag"> · {t(flagLabel(flag))}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="trend-grid">
              <TrendChart
                title={t('Blood pressure')}
                unit="mmHg"
                readings={ordered}
                when={when}
                series={[
                  { field: 'systolic', name: t('Systolic'), color: SERIES_1 },
                  { field: 'diastolic', name: t('Diastolic'), color: SERIES_2 },
                ]}
              />
              {metrics.slice(2).map((m) => (
                <TrendChart
                  key={m.field}
                  title={t(m.label)}
                  unit={m.unit}
                  readings={ordered}
                  when={when}
                  band={m.normal}
                  series={[{ field: m.field, name: t(m.label), color: SERIES_1 }]}
                />
              ))}
            </div>
          )}
          <p className="vitals-note muted small">
            {t('Shaded bands show the demonstration normal range. Thresholds are not clinically validated.')}
          </p>
        </>
      )}
      <RecordVitals
        open={recording}
        onOpenChange={setRecording}
        patientId={patientId}
        onSaved={(reading) => {
          notify(
            reading.flags.length
              ? t('Vital signs saved with {count} alerts. Review the highlighted values.', { count: reading.flags.length })
              : t('Vital signs saved. All values are within the normal range.'),
          );
        }}
      />
    </section>
  );
}

type Series = { field: VitalField; name: string; color: string };

function TrendChart({
  title,
  unit,
  readings,
  series,
  band,
  when,
}: {
  title: string;
  unit: string;
  readings: VitalReading[];
  series: Series[];
  band?: [number, number];
  when: (value: string) => string;
}) {
  const { t } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const W = 320,
    H = 132,
    L = 34,
    R = series.length > 1 ? 30 : 12,
    T = 10,
    B = 18;
  const values = readings.flatMap((r) => series.map((s) => r[s.field]));
  const lo = Math.min(...values, ...(band ? [band[0]] : []));
  const hi = Math.max(...values, ...(band ? [band[1]] : []));
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad,
    max = hi + pad;
  const x = (i: number) => (readings.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (readings.length - 1));
  const y = (v: number) => T + ((max - v) * (H - T - B)) / (max - min);
  const ticks = [min + pad, (min + max) / 2, max - pad].map((v) => Math.round(v * 10) / 10);
  const flagged = (r: VitalReading, f: VitalField) => r.flags.find((fl) => fl.field === f);
  const tip = hover === null ? null : readings[hover];

  return (
    <figure className="trend-chart">
      <figcaption>
        <strong>{title}</strong>
        <span className="muted">{unit}</span>
        {series.length > 1 && (
          <span className="trend-legend">
            {series.map((s) => (
              <span key={s.field}>
                <i style={{ background: s.color }} aria-hidden />
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="trend-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('{title} trend, {count} readings', { title, count: readings.length })}>
          {band && (
            <rect
              x={L}
              width={W - L - R}
              y={y(band[1])}
              height={Math.max(0, y(band[0]) - y(band[1]))}
              className="trend-band"
            />
          )}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="trend-grid-line" />
              <text x={L - 6} y={y(v) + 3} className="trend-tick" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          <text x={x(0)} y={H - 3} className="trend-tick" textAnchor="start">
            {when(readings[0].recordedAt).split(',')[0]}
          </text>
          {readings.length > 1 && (
            <text x={x(readings.length - 1)} y={H - 3} className="trend-tick" textAnchor="end">
              {when(readings[readings.length - 1].recordedAt).split(',')[0]}
            </text>
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="trend-crosshair" />}
          {series.map((s) => (
            <g key={s.field}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={readings.map((r, i) => `${x(i)},${y(r[s.field])}`).join(' ')}
              />
              {readings.map((r, i) => {
                const f = flagged(r, s.field);
                return (
                  <circle
                    key={r.id}
                    cx={x(i)}
                    cy={y(r[s.field])}
                    r={hover === i ? 5 : 4}
                    fill={f ? (f.level === 'critical' ? '#c2372d' : '#b7791f') : s.color}
                    className="trend-dot"
                  />
                );
              })}
              {series.length > 1 && (
                <text x={W - R + 4} y={y(readings[readings.length - 1][s.field]) + 3} className="trend-direct">
                  {s.field === 'systolic' ? 'SYS' : 'DIA'}
                </text>
              )}
            </g>
          ))}
          {readings.map((r, i) => {
            const half = readings.length === 1 ? (W - L - R) / 2 : (W - L - R) / (readings.length - 1) / 2;
            return (
              <rect
                key={r.id}
                x={Math.max(L, x(i) - half)}
                width={Math.min(half * 2, W - R - Math.max(L, x(i) - half))}
                y={0}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            );
          })}
        </svg>
        {tip && hover !== null && (
          <div
            className="trend-tooltip"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover === 0 ? '0' : hover === readings.length - 1 ? '-100%' : '-50%'})`,
            }}
            aria-hidden
          >
            <span className="muted">{when(tip.recordedAt)}</span>
            {series.map((s) => {
              const f = flagged(tip, s.field);
              return (
                <span key={s.field} className="tip-row">
                  <i style={{ background: s.color }} aria-hidden />
                  {s.name}: <strong>{tip[s.field]}</strong> {unit}
                  {f && <em className={`tip-flag is-${f.level}`}>{t(flagLabel(f))}</em>}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </figure>
  );
}

function RecordVitals({
  open,
  onOpenChange,
  patientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: number;
  onSaved: (reading: VitalReading) => void;
}) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const empty = Object.fromEntries(metrics.map((m) => [m.field, ''])) as Record<VitalField, string>;
  const [values, setValues] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  function close(next: boolean) {
    if (!next) {
      setValues(empty);
      setError('');
    }
    onOpenChange(next);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (metrics.some((m) => values[m.field].trim() === '' || Number.isNaN(Number(values[m.field]))))
      return setError('Check the values. One or more vital signs are missing or outside the possible range.');
    setSaving(true);
    setError('');
    try {
      const body = Object.fromEntries(metrics.map((m) => [m.field, Number(values[m.field])]));
      const reading = await api<VitalReading>(`/patients/${patientId}/vitals`, 'POST', body);
      await qc.invalidateQueries({ queryKey: ['vitals', patientId] });
      close(false);
      onSaved(reading);
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
      title={t('Record vital signs')}
      description={t('Enter all six values. Out-of-range values are flagged after saving.')}
    >
      <form className="vitals-form" onSubmit={submit} noValidate>
        <div className="vitals-fields">
          {metrics.map((m) => (
            <label key={m.field} className="field">
              <span className="field-label">
                {t(m.label)} <small>({m.unit})</small>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step={m.step}
                value={values[m.field]}
                onChange={(e) => setValues({ ...values, [m.field]: e.target.value })}
              />
            </label>
          ))}
        </div>
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
            {saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
            {t('Save vital signs')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
