import type { Locale } from './i18n/messages';

/**
 * Historial de cambios de la SPA, mostrado en Ayuda → Notas de versión.
 *
 * Reglas (ver CLAUDE.md → "SPA versioning & release"):
 *  - Orden: la versión más reciente SIEMPRE va primero.
 *  - La primera entrada debe coincidir con `APP_VERSION` (src/version.ts)
 *    y con `version` en package.json — `releaseNotes.test.ts` lo verifica.
 *  - `date` en formato ISO `YYYY-MM-DD`.
 *  - Cada cambio se redacta en ES y EN, en lenguaje de usuario (qué cambia
 *    para quien usa la herramienta, no detalles de implementación).
 */
export interface ReleaseNote {
  version: string;
  date: string;
  changes: Record<Locale, string[]>;
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '2.1.0',
    date: '2026-09-10',
    changes: {
      es: [
        'Nuevo apartado «Notas de versión» en el menú de ayuda para consultar el historial de cambios de la aplicación.',
      ],
      en: [
        'New "Release notes" section in the help menu to browse the application change history.',
      ],
    },
  },
  {
    version: '2.0.2',
    date: '2026-08-24',
    changes: {
      es: ['Versión del paquete alineada con la versión mostrada en la aplicación.'],
      en: ['Package version aligned with the version shown in the app.'],
    },
  },
  {
    version: '2.0.1',
    date: '2026-08-24',
    changes: {
      es: [
        'Corregida la carga de la aplicación cuando se publica bajo una subruta (rutas relativas).',
        'Publicación automática de releases al integrar cambios en la rama principal.',
      ],
      en: [
        'Fixed app loading when hosted under a subpath (relative asset paths).',
        'Automated release publishing when changes are merged into the main branch.',
      ],
    },
  },
  {
    version: '2.0.0',
    date: '2026-06-05',
    changes: {
      es: [
        'Menú de ayuda con versión, notificación de problemas y política de privacidad.',
        'Corregido el desbordamiento del cargador de archivos.',
        'Nueva identidad visual con logos actualizados.',
        'Publicación bajo licencia MIT.',
      ],
      en: [
        'Help menu with version, issue reporting and privacy policy.',
        'Fixed file uploader overflow.',
        'New visual identity with updated logos.',
        'Released under the MIT License.',
      ],
    },
  },
];
