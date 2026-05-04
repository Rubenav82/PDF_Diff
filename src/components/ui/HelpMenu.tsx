import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useT } from '../../i18n/useT';
import { useLanguage } from '../../i18n/LanguageContext';
import { APP_VERSION } from '../../version';

// ─── Icons ───────────────────────────────────────────────────────────────────

const QuestionIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const BugIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2l1.88 1.88M16 2l-1.88 1.88M9 7.13v-1a3.003 3.003 0 0 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
    <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-3 1.5-6 3-8M17.47 9c1.93-.2 3.53-1.9 3.53-4M18 13h4M21 21c0-3-1.5-6-3-8" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Privacy modal content ────────────────────────────────────────────────────

function PrivacyContent({ locale }: { locale: string }) {
  const isEn = locale === 'en';

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
  };
  const headingStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };
  const bodyStyle: React.CSSProperties = {
    fontSize: 13.5,
    color: 'var(--text-2)',
    lineHeight: 1.65,
    margin: 0,
  };
  const listStyle: React.CSSProperties = {
    fontSize: 13.5,
    color: 'var(--text-2)',
    lineHeight: 1.7,
    paddingLeft: 20,
    margin: '6px 0 0',
  };
  const linkStyle: React.CSSProperties = {
    color: 'var(--accent)',
    textDecoration: 'none',
  };

  if (isEn) {
    return (
      <>
        <p style={{ ...bodyStyle, marginBottom: 20 }}>
          <strong style={{ color: 'var(--text)' }}>PDF Comparison Tool</strong> is a web application
          that runs entirely in your browser. There is no backend server: all PDF documents you
          upload are processed in memory on your own device and never leave it.
        </p>

        <div style={sectionStyle}>
          <p style={headingStyle}>We do not collect or transmit</p>
          <ul style={listStyle}>
            <li>The textual or visual content of uploaded PDFs</li>
            <li>Comparison results</li>
            <li>Personal data or confidential information contained in documents</li>
            <li>File metadata (name, size or modification date)</li>
          </ul>
        </div>

        <div style={sectionStyle}>
          <p style={headingStyle}>Local processing</p>
          <p style={bodyStyle}>
            PDFs are read directly in the browser using the standard File API. All processing
            (text extraction, comparison and visual rendering) takes place entirely on your device.
            When you close or refresh the page, all data is automatically discarded.
          </p>
        </div>

        <div style={sectionStyle}>
          <p style={headingStyle}>Exported report</p>
          <p style={bodyStyle}>
            The downloadable HTML report is generated and stored on your device. It is not sent
            to any external service.
          </p>
        </div>

        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <p style={headingStyle}>Contact</p>
          <p style={bodyStyle}>
            For any privacy-related enquiries or to report an issue, write to{' '}
            <a href="mailto:rubenav82@gmail.com" style={linkStyle}>rubenav82@gmail.com</a>.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <p style={{ ...bodyStyle, marginBottom: 20 }}>
        <strong style={{ color: 'var(--text)' }}>PDF Comparison Tool</strong> es una aplicación web
        que funciona íntegramente en tu navegador. No existe ningún servidor backend: todos los
        documentos PDF que cargues se procesan en memoria, en tu propio dispositivo, y nunca
        salen de él.
      </p>

      <div style={sectionStyle}>
        <p style={headingStyle}>No recogemos ni transmitimos</p>
        <ul style={listStyle}>
          <li>El contenido textual o visual de los PDF cargados</li>
          <li>Los resultados de las comparaciones</li>
          <li>Datos personales o información confidencial presente en los documentos</li>
          <li>Metadatos de los archivos (nombre, tamaño o fecha de modificación)</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <p style={headingStyle}>Procesamiento local</p>
        <p style={bodyStyle}>
          Los PDF se leen directamente en el navegador mediante la API de archivos estándar.
          El procesamiento (extracción de texto, comparación y renderizado visual) ocurre
          íntegramente en tu dispositivo. Al cerrar o refrescar la página, todos los datos
          quedan eliminados automáticamente.
        </p>
      </div>

      <div style={sectionStyle}>
        <p style={headingStyle}>Informe exportado</p>
        <p style={bodyStyle}>
          El informe HTML descargable se genera y almacena en tu dispositivo. No se envía a
          ningún servicio externo.
        </p>
      </div>

      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <p style={headingStyle}>Contacto</p>
        <p style={bodyStyle}>
          Para cualquier consulta sobre privacidad o para notificar un problema, escríbenos a{' '}
          <a href="mailto:rubenav82@gmail.com" style={linkStyle}>rubenav82@gmail.com</a>.
        </p>
      </div>
    </>
  );
}

function PrivacyModal({ onClose, locale }: { onClose: () => void; locale: string }) {
  const t = useT();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'var(--surface)', borderRadius: 12,
        padding: '28px 32px 24px',
        width: '100%', maxWidth: 560,
        maxHeight: '80vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldIcon />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {t('privacy.title')}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={t('privacy.close')}
            style={{
              padding: 5, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface-2)', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <XIcon />
          </button>
        </div>

        <PrivacyContent locale={locale} />
      </div>
    </div>
  );
}

// ─── HelpMenu ─────────────────────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  width: '100%', padding: '8px 14px',
  background: 'none', border: 'none',
  color: 'var(--text-2)', fontSize: 13,
  cursor: 'pointer', textDecoration: 'none',
  textAlign: 'left', borderRadius: 6,
  transition: 'background 0.15s, color 0.15s',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

export function HelpMenu() {
  const t = useT();
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeMenu]);

  const emailHref =
    `mailto:rubenav82@gmail.com` +
    `?subject=${encodeURIComponent(t('help.reportSubject'))}` +
    `&body=${encodeURIComponent(t('help.reportBody', { version: APP_VERSION }))}`;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-label={t('help.tooltip')}
        aria-expanded={open}
        style={{
          padding: 6, borderRadius: 6,
          background: open ? 'var(--surface-2)' : 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: open ? 'var(--text)' : 'var(--text-2)',
          display: 'flex', alignItems: 'center', cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <QuestionIcon />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10, padding: '6px',
          boxShadow: 'var(--shadow-md)',
          minWidth: 220, zIndex: 200,
        }}>
          {/* App name + version */}
          <div style={{
            padding: '8px 14px 10px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              PDF Comparison Tool
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              v{APP_VERSION}
            </div>
          </div>

          {/* Report issue */}
          <a
            href={emailHref}
            target='_blank'
            onClick={closeMenu}
            style={menuItemStyle}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'none';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
            }}
          >
            <BugIcon />
            {t('help.reportIssue')}
          </a>

          {/* Privacy policy */}
          <button
            type="button"
            onClick={() => { setPrivacyOpen(true); closeMenu(); }}
            style={menuItemStyle}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'none';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
            }}
          >
            <ShieldIcon />
            {t('help.privacy')}
          </button>
        </div>
      )}

      {/* Privacy modal */}
      {privacyOpen && (
        <PrivacyModal onClose={() => setPrivacyOpen(false)} locale={locale} />
      )}
    </div>
  );
}
