import React, { useEffect, useRef, useState } from 'react';

interface AccordionSectionProps {
  num: number;
  title: string;
  badge?: string;
  locked?: boolean;
  open: boolean;
  onToggle: () => void;
  lockedLabel?: string;
  children: React.ReactNode;
}

const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
  >
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  num, title, badge, locked = false, open, onToggle, lockedLabel, children,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!bodyRef.current) return;
    setHeight(open ? bodyRef.current.scrollHeight : 0);
  }, [open, children]);

  useEffect(() => {
    if (!bodyRef.current || !open) return;
    const observer = new ResizeObserver(() => {
      if (bodyRef.current) setHeight(bodyRef.current.scrollHeight);
    });
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, [open]);

  const borderColor = locked ? 'var(--border)' : open ? 'var(--text)' : 'var(--border-strong)';
  const headerBg = open ? 'var(--text)' : locked ? 'var(--surface-2)' : 'var(--surface)';
  const headerTextColor = open ? 'var(--surface)' : 'var(--text)';

  return (
    <div style={{ border: `1.5px solid ${borderColor}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color 0.2s ease' }}>
      <button
        type="button"
        onClick={locked ? undefined : onToggle}
        disabled={locked}
        aria-expanded={open}
        style={{
          width: '100%', padding: '13px 18px', background: headerBg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: locked ? 'default' : 'pointer', border: 'none',
          transition: 'background 0.2s ease', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${locked ? 'var(--border-strong)' : open ? 'var(--surface)' : 'var(--border-strong)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: locked ? 'var(--text-3)' : open ? 'var(--text)' : 'var(--text-2)',
            background: open ? 'var(--surface)' : 'transparent',
            flexShrink: 0, transition: 'all 0.2s ease',
          }}>
            {locked ? <LockIcon /> : num}
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: locked ? 'var(--text-3)' : headerTextColor, transition: 'color 0.2s ease' }}>
            {title}
          </span>
          {badge && !locked && (
            <span style={{
              fontSize: 11, padding: '1px 8px', borderRadius: 10,
              background: open ? 'rgba(255,255,255,0.15)' : 'var(--surface-2)',
              color: open ? 'rgba(255,255,255,0.9)' : 'var(--text-3)',
              border: `1px solid ${open ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
              fontWeight: 500,
            }}>
              {badge}
            </span>
          )}
          {locked && lockedLabel && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
              {lockedLabel}
            </span>
          )}
        </div>
        {!locked && (
          <span style={{ color: open ? 'var(--surface)' : 'var(--text-3)' }}>
            <ChevronIcon open={open} />
          </span>
        )}
      </button>

      <div className="acc-body" style={{ height }}>
        <div ref={bodyRef} style={{ padding: '16px 18px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
