/**
 * Paleta y tokens de diseño.
 * Look "HUD automotriz": fondo casi negro, tarjetas de vidrio, acentos cian/lima.
 */

export const colors = {
  bg: '#05070B',
  bgElevated: '#0B0F16',
  surface: 'rgba(255,255,255,0.045)',
  surfaceStrong: 'rgba(255,255,255,0.075)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  text: '#F2F5F9',
  textMuted: '#8A94A6',
  textFaint: '#5A6474',

  accent: '#22D3EE',
  accentDim: 'rgba(34,211,238,0.16)',
  lime: '#A3E635',
  amber: '#FBBF24',
  danger: '#FB3B4E',
  dangerDim: 'rgba(251,59,78,0.16)',

  ascent: '#F97316', // subida
  descent: '#38BDF8', // bajada

  track: 'rgba(255,255,255,0.08)',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Fuente monoespaciada para números: evita que el ancho "baile" al cambiar de dígito. */
export const mono = 'Menlo';

export const font = {
  huge: { fontSize: 88, fontWeight: '200' as const, letterSpacing: -3 },
  display: { fontSize: 40, fontWeight: '300' as const, letterSpacing: -1 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1.2 },
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

/**
 * Escala de color por velocidad (km/h). Se usa en el velocímetro y en la
 * polilínea del mapa para leer "de un vistazo" dónde ibas rápido.
 */
const SPEED_STOPS: [number, string][] = [
  [0, '#22D3EE'],
  [40, '#34D399'],
  [70, '#A3E635'],
  [100, '#FBBF24'],
  [130, '#FB7185'],
  [180, '#FB3B4E'],
];

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function speedColor(kmh: number): string {
  const v = Math.max(0, kmh);
  if (v <= SPEED_STOPS[0][0]) return SPEED_STOPS[0][1];
  for (let i = 0; i < SPEED_STOPS.length - 1; i++) {
    const [v0, c0] = SPEED_STOPS[i];
    const [v1, c1] = SPEED_STOPS[i + 1];
    if (v <= v1) {
      const t = (v - v0) / (v1 - v0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      const mix = a.map((x, k) => Math.round(x + (b[k] - x) * t));
      return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
    }
  }
  return SPEED_STOPS[SPEED_STOPS.length - 1][1];
}

/** Color según la pendiente en % (negativo = descenso). */
export function gradeColor(grade: number): string {
  if (grade > 1.5) return colors.ascent;
  if (grade < -1.5) return colors.descent;
  return colors.textMuted;
}
