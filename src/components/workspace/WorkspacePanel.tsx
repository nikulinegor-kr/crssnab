import { useEffect, useState, useRef, useLayoutEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import './workspace.css';

/** One detail surface: adjacent to the list on desktop, protected focus on phones. */
export function WorkspacePanel({ title, subtitle, badge, children, footer, onClose }: {
  title: string; subtitle?: string; badge?: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void;
}) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const panelRef = useRef<HTMLElement>(null);
  const [panelHeight, setPanelHeight] = useState<number>();
  useLayoutEffect(() => {
    if (compact) return;
    let frame = 0;
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (panelRef.current) setPanelHeight(Math.max(220, window.innerHeight - Math.max(18, panelRef.current.getBoundingClientRect().top) - 24)); }); };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [compact]);
  const body = <>
    <header className="cw-detail-head"><div className="cw-detail-top">{badge}<Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть карточку"><X /></Button></div>
      {compact ? <DialogTitle>{title}</DialogTitle> : <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}
    </header>
    <div className="cw-detail-body">{children}</div>
    {footer && <footer className="cw-detail-footer">{footer}</footer>}
  </>;
  return compact ? <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="cw-panel cw-panel-mobile" aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); }}>
    {body}
  </DialogContent></Dialog> : <aside ref={panelRef} className="cw-panel" style={{maxHeight:panelHeight}} aria-label={title}>{body}</aside>;
}
export function WorkspaceEmpty({ children }: { children: ReactNode }) { return <div className="cw-empty">{children}</div>; }
export function WorkspaceAvatar({ name }: { name: string }) { return <span className="cw-avatar" title={name}>{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>; }
