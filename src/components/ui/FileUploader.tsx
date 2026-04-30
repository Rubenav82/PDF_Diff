import React, { useCallback, useState, useRef } from 'react';
import { useT } from '../../i18n/useT';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const PDF_MIME_TYPE = 'application/pdf';

interface FileUploaderProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  label: string;
  id: string;
  variant?: 'original' | 'modified';
}

const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const PdfIcon = ({ color }: { color: string }) => (
  <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
    <rect width="28" height="36" rx="3" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="1.5"/>
    <path d="M17 0v7h7" fill="none" stroke="var(--border-strong)" strokeWidth="1.5"/>
    <text x="5" y="26" style={{ fontSize: '8px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fill: color }}>PDF</text>
  </svg>
);
const CheckSmIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const FileUploader: React.FC<FileUploaderProps> = ({ file, onFileSelect, label, id, variant = 'original' }) => {
  const t = useT();
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const color = variant === 'original' ? '#2563eb' : 'var(--accent)';
  const subtleColor = variant === 'original' ? 'var(--blue-subtle)' : 'var(--red-subtle)';

  const validateAndSetFile = useCallback((selectedFile: File) => {
    const isPdfByMime = selectedFile.type === PDF_MIME_TYPE;
    const isPdfByName = selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdfByMime && !isPdfByName) { setErrorMessage(t('upload.onlyPdf')); return; }
    if (selectedFile.size > MAX_SIZE_BYTES) { setErrorMessage(t('upload.maxSize', { max: MAX_SIZE_MB })); return; }
    setErrorMessage(null);
    onFileSelect(selectedFile);
  }, [onFileSelect, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) validateAndSetFile(e.target.files[0]);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onFileSelect(null); setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) validateAndSetFile(e.dataTransfer.files[0]);
  }, [validateAndSetFile]);

  const fmtSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  const borderColor = errorMessage ? 'var(--red)' : file ? color : isDragging ? 'var(--accent)' : 'var(--border-strong)';

  return (
    <div style={{ minWidth: 0 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>

      {file ? (
        /* ── File loaded state ── */
        <div
          className="anim-in"
          style={{ border: `2px solid ${color}55`, borderRadius: 8, padding: '12px 14px', background: subtleColor, display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div style={{ color, flexShrink: 0 }}><PdfIcon color={color} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{fmtSize(file.size)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, color }}>
              <CheckSmIcon />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{t('upload.selected')}</span>
            </div>
          </div>
          <button
            onClick={handleRemove}
            aria-label={t('upload.remove')}
            title={t('upload.remove')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, flexShrink: 0,
              borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)',
              background: 'rgba(220,38,38,0.07)', color: 'var(--red)',
              cursor: 'pointer', transition: 'background 0.2s ease', fontFamily: 'inherit',
            }}
          >
            <XIcon />
          </button>
        </div>
      ) : (
        /* ── Empty / drag state ── */
        <div
          className={isDragging ? 'drag-over' : ''}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label={`${label} — ${t('upload.orDrop')}`}
          style={{
            border: `2px dashed ${borderColor}`, borderRadius: 8, padding: '28px 16px',
            background: isDragging ? 'var(--accent-subtle)' : 'var(--surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            cursor: 'pointer', transition: 'border-color 0.2s ease, background 0.2s ease', minHeight: 130,
          }}
        >
          <div style={{ color: 'var(--text-3)' }}><UploadIcon /></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{t('upload.load')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('upload.orDrop')}</div>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              marginTop: 2, padding: '6px 14px', borderRadius: 6,
              border: `1.5px solid ${color}`, background: 'transparent', color,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s ease', fontFamily: 'inherit',
            }}
          >
            {t('upload.load')}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            PDF · {t('upload.maxSizeHint', { max: MAX_SIZE_MB })}
          </div>
        </div>
      )}

      {errorMessage && (
        <p style={{ marginTop: 5, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ {errorMessage}
        </p>
      )}
      <input ref={fileInputRef} id={id} name={id} type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
};
