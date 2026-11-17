import { useLayoutEffect, useState, type RefObject } from 'react';
import { placeTour } from '../lib/tour-placement';

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export function useTourTarget(active: boolean, selector: string, panel: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<{ box: Box | null; x: number; y: number; width: number; limit: number; keyboard: boolean; targetName: string | null; side: 'top' | 'bottom' | 'left' | 'right' }>({ box: null, x: 12, y: 100, width: 360, limit: 600, keyboard: false, targetName: null, side: 'bottom' });
  useLayoutEffect(() => {
    if (!active) return;
    let frame = 0;
    let target: HTMLElement | null = null;
    const resize = new ResizeObserver(() => schedule());
    function measure() {
      const node = selector.split('||').flatMap(query => Array.from(document.querySelectorAll<HTMLElement>(query.trim()))).find(el =>
        el.getClientRects().length && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden') || null;
      const visual = window.visualViewport;
      const vw = (visual?.offsetLeft || 0) + (visual?.width || window.innerWidth);
      const topEdge = visual?.offsetTop || 0;
      const visibleHeight = visual?.height || window.innerHeight;
      const vh = topEdge + visibleHeight;
      const keyboard = visibleHeight < window.innerHeight * .8;
      const baseLimit = Math.min(visibleHeight - 24, keyboard ? Math.max(150, visibleHeight * .58) : visibleHeight - 24);
      const width = Math.min(360, (visual?.width || window.innerWidth) - 24);
      const body = panel.current?.querySelector<HTMLElement>('.tour-body');
      const naturalHeight = (panel.current?.offsetHeight || 280) + Math.max(0, (body?.scrollHeight || 0) - (body?.clientHeight || 0));
      const height = Math.min(naturalHeight, baseLimit);
      if (node !== target) {
        if (target) { target.removeAttribute('aria-describedby'); resize.unobserve(target); }
        target = node;
        if (node) {
          node.setAttribute('aria-describedby', 'tutorial-description');
          resize.observe(node);
          const box = node.getBoundingClientRect();
          if (box.top < 80 || box.bottom > vh) node.scrollIntoView({ block: 'center', behavior: 'instant' });
          const focus = node.dataset.tour !== 'soap-field' && node.matches('button,input,textarea,select,a[href]') ? node : panel.current?.querySelector<HTMLElement>('button');
          focus?.focus({ preventScroll: true });
        }
      }
      let box: Box | null = null;
      let x = vw - width - 12, y = Math.max(topEdge + 12, vh - height - 12);
      let limit = baseLimit;
      let side: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
      if (node) {
        let r = node.getBoundingClientRect();
        const viewport = { left: visual?.offsetLeft || 0, top: topEdge, right: vw, bottom: vh };
        let placement = placeTour(r, viewport, width, height);
        if (placement.limit < Math.min(200, height) && !node.closest('.sidebar,.topbar')) {
          const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom || topEdge;
          const desiredTop = Math.max(topEdge + 12, headerBottom + 12);
          window.scrollBy({ top: r.top - desiredTop, behavior: 'instant' });
          r = node.getBoundingClientRect();
          placement = placeTour(r, viewport, width, height);
        }
        ({ x, y, side } = placement);
        limit = Math.min(baseLimit, Math.max(0, placement.limit));
        const left = Math.max(0, r.left - 5), top = Math.max(0, r.top - 5);
        const right = Math.min(vw, r.right + 5), bottom = Math.min(vh, r.bottom + 5);
        box = { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      }
      const next = { box, x, y, width, limit, keyboard, side, targetName: node?.dataset.tour || null };
      setLayout(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); }
    const mutation = new MutationObserver(schedule);
    mutation.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (panel.current) resize.observe(panel.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    function keyboard(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const controls = [
        ...(target?.matches('button,input,textarea,select,a[href]') ? [target] : []),
        ...Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || []),
      ].filter(el => !el.hasAttribute('disabled'));
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault(); event.stopPropagation();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
    document.addEventListener('keydown', keyboard, true);
    measure();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect();
      target?.removeAttribute('aria-describedby');
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, [active, selector, panel]);
  return layout;
}
