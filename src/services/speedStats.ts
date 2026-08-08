import { MS_TO_KMH } from '@/utils/format';
import { TrackPoint } from './tripEngine';

/** Ancho de cada casilla del histograma, en km/h. */
export const HIST_BIN_KMH = 10;
/** 24 casillas de 10 km/h cubren de 0 a 240 km/h. */
export const HIST_BINS = 24;

/** Ventana, en segundos, para considerar una velocidad "sostenida". */
export const SUSTAIN_WINDOW_S = 5;

export type SpeedAnalysis = {
  /** Milisegundos pasados en cada casilla de velocidad. */
  histogram: number[];
  /** La mayor velocidad mantenida durante toda la ventana sostenida. */
  sustainedMaxKmh: number;
  p50Kmh: number;
  p85Kmh: number;
  p95Kmh: number;
  overLimitMs: number;
  limitKmh: number;
  /** Altitud típica del viaje, para corregir la potencia. */
  medianAltitude: number | null;
};

export const EMPTY_ANALYSIS: SpeedAnalysis = {
  histogram: new Array(HIST_BINS).fill(0),
  sustainedMaxKmh: 0,
  p50Kmh: 0,
  p85Kmh: 0,
  p95Kmh: 0,
  overLimitMs: 0,
  limitKmh: 0,
  medianAltitude: null,
};

export function binIndexFor(kmh: number): number {
  return Math.max(0, Math.min(HIST_BINS - 1, Math.floor(kmh / HIST_BIN_KMH)));
}

export function binLabel(index: number): string {
  const from = index * HIST_BIN_KMH;
  if (index === HIST_BINS - 1) return `${from}+`;
  return `${from}`;
}

/**
 * Percentil sobre el histograma ponderado por tiempo.
 *
 * El percentil 85 es la medida que usan los ingenieros de tránsito para fijar
 * límites: la velocidad por debajo de la cual circulas el 85 % del tiempo.
 * Describe mucho mejor "a qué velocidad viajas de verdad" que la media, que
 * cada semáforo hunde, o que la máxima, que un solo pico dispara.
 *
 * Solo cuenta el tiempo en movimiento: incluir las paradas metería un montón
 * de ceros que arrastrarían todos los percentiles hacia abajo.
 */
export function percentileFromHistogram(histogram: number[], p: number): number {
  const movingBins = histogram.slice(1); // ignora la casilla 0-10 km/h
  const total = movingBins.reduce((sum, ms) => sum + ms, 0);
  if (total <= 0) return 0;

  const objetivo = total * p;
  let acumulado = 0;
  for (let i = 0; i < movingBins.length; i++) {
    const anterior = acumulado;
    acumulado += movingBins[i];
    if (acumulado >= objetivo) {
      // Interpola dentro de la casilla para no devolver siempre múltiplos de 10.
      const dentro = movingBins[i] > 0 ? (objetivo - anterior) / movingBins[i] : 0;
      const base = (i + 1) * HIST_BIN_KMH;
      return base + dentro * HIST_BIN_KMH;
    }
  }
  return HIST_BINS * HIST_BIN_KMH;
}

/**
 * Acumulador incremental: alimenta el análisis mientras se conduce, sin tener
 * que recorrer toda la traza en cada lectura del GPS.
 */
export class SpeedAnalyzer {
  histogram: number[] = new Array(HIST_BINS).fill(0);
  sustainedMaxKmh = 0;
  overLimitMs = 0;
  limitKmh: number;

  /** Ventana móvil de lecturas recientes para la máxima sostenida. */
  private window: { t: number; kmh: number }[] = [];
  private altitudes: number[] = [];

  constructor(limitKmh = 0) {
    this.limitKmh = limitKmh;
  }

  push(tMs: number, kmh: number, deltaMs: number, altitude: number | null): void {
    if (deltaMs > 0 && deltaMs < 10000) {
      this.histogram[binIndexFor(kmh)] += deltaMs;
      if (this.limitKmh > 0 && kmh > this.limitKmh) this.overLimitMs += deltaMs;
    }

    // Máxima sostenida: la velocidad más baja dentro de la ventana es la que
    // realmente mantuviste todo ese tiempo. Guardamos el mayor de esos mínimos,
    // así un pico aislado del GPS no puede inflar el récord.
    this.window.push({ t: tMs, kmh });
    const desde = tMs - SUSTAIN_WINDOW_S * 1000;
    while (this.window.length > 1 && this.window[0].t < desde) this.window.shift();

    const cubreVentana = tMs - this.window[0].t >= SUSTAIN_WINDOW_S * 1000 * 0.9;
    if (cubreVentana) {
      let minimo = Infinity;
      for (const s of this.window) minimo = Math.min(minimo, s.kmh);
      if (minimo > this.sustainedMaxKmh) this.sustainedMaxKmh = minimo;
    }

    if (altitude != null && Number.isFinite(altitude)) {
      // Guarda una muestra cada tantas lecturas: para la mediana sobra.
      if (this.altitudes.length < 4000) this.altitudes.push(altitude);
    }
  }

  get medianAltitude(): number | null {
    if (this.altitudes.length === 0) return null;
    const ordenadas = [...this.altitudes].sort((a, b) => a - b);
    return ordenadas[Math.floor(ordenadas.length / 2)];
  }

  result(): SpeedAnalysis {
    return {
      histogram: [...this.histogram],
      sustainedMaxKmh: this.sustainedMaxKmh,
      p50Kmh: percentileFromHistogram(this.histogram, 0.5),
      p85Kmh: percentileFromHistogram(this.histogram, 0.85),
      p95Kmh: percentileFromHistogram(this.histogram, 0.95),
      overLimitMs: this.overLimitMs,
      limitKmh: this.limitKmh,
      medianAltitude: this.medianAltitude,
    };
  }
}

/**
 * Reconstruye el análisis desde una traza guardada.
 * Se usa con viajes antiguos, grabados antes de que existiera esta pantalla.
 */
export function analyzePoints(points: TrackPoint[], limitKmh = 0): SpeedAnalysis {
  const analyzer = new SpeedAnalyzer(limitKmh);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const deltaMs = i === 0 ? 0 : p.t - points[i - 1].t;
    analyzer.push(p.t, p.s * MS_TO_KMH, deltaMs, p.a);
  }
  return analyzer.result();
}

/** Tiempo total registrado en el histograma, en ms. */
export function histogramTotalMs(histogram: number[]): number {
  return histogram.reduce((sum, ms) => sum + ms, 0);
}
