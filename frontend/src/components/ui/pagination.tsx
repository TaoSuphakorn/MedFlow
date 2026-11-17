import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { Button } from './button';
import { Select } from './select';

export type PaginationState = { scope: string; page: number; size: number };
export type PaginationControl = [PaginationState, Dispatch<SetStateAction<PaginationState>>];
export function usePagination<T>(items: T[], scope: string, control?: PaginationControl) {
  const internal = useState({ scope, page: 1, size: 10 });
  const [state, setState] = control || internal;
  const pages = Math.max(1, Math.ceil(items.length / state.size));
  const page = state.scope === scope ? Math.min(state.page, pages) : 1;
  useEffect(() => {
    setState(current => current.scope === scope && current.page <= pages
      ? current : { ...current, scope, page: current.scope === scope ? Math.min(current.page, pages) : 1 });
  }, [scope, pages, setState]);
  return {
    rows: items.slice((page - 1) * state.size, page * state.size),
    total: items.length, page, pages, size: state.size,
    setPage: (next: number) => setState({ ...state, scope, page: Math.max(1, Math.min(pages, next)) }),
    setSize: (size: number) => setState({ scope, page: 1, size }),
  };
}

export function Pagination({ total, page, pages, size, setPage, setSize }: ReturnType<typeof usePagination>) {
  const { t } = useLanguage();
  const start = total ? (page - 1) * size + 1 : 0;
  const end = Math.min(page * size, total);
  const visiblePages = Array.from({ length: pages }, (_, index) => index + 1)
    .filter(number => number === 1 || number === pages || Math.abs(number - page) <= 1);
  return <div className="pagination-bar">
    <p className="pagination-summary" role="status">{t('Showing {start}–{end} of {total}', { start, end, total })}</p>
    <div className="pagination-controls">
      <div className="page-size"><span>{t('Rows per page')}</span>
        <Select label={t('Rows per page')} value={String(size)} onChange={value => setSize(Number(value))}
          options={[5, 10, 20].map(number => ({ value: String(number), label: String(number) }))} />
      </div>
      <nav aria-label={t('Pagination')}>
        <Button variant="outline" aria-label={t('Previous page')} disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button>
        {visiblePages.map((number, index) => <span className="pagination-page" key={number}>
          {index > 0 && number - visiblePages[index - 1] > 1 && <span className="pagination-ellipsis">…</span>}
          <Button variant="outline" aria-label={t('Page {page}', { page: number })} aria-current={number === page ? 'page' : undefined}
            onClick={() => setPage(number)}>{number}</Button>
        </span>)}
        <Button variant="outline" aria-label={t('Next page')} disabled={page === pages || !total} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button>
      </nav>
    </div>
  </div>;
}
