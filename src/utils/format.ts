export type SpeedUnit = 'kmh' | 'mph';

export const MS_TO_KMH = 3.6;
export const KMH_TO_MPH = 0.621371;

export function toDisplaySpeed(kmh: number, unit: SpeedUnit): number {
  return unit === 'mph' ? kmh * KMH_TO_MPH : kmh;
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return unit === 'mph' ? 'mph' : 'km/h';
}

export function distanceUnitLabel(unit: SpeedUnit): string {
  return unit === 'mph' ? 'mi' : 'km';
}

export function toDisplayDistanceKm(km: number, unit: SpeedUnit): number {
  return unit === 'mph' ? km * KMH_TO_MPH : km;
}

/** 1234 m → "1,23 km" · 340 m → "340 m" */
export function formatDistance(meters: number, unit: SpeedUnit = 'kmh'): string {
  if (unit === 'mph') {
    const miles = (meters / 1000) * KMH_TO_MPH;
    if (miles < 0.2) return `${Math.round(meters * 3.28084)} ft`;
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

/** 3.725.000 ms → "1:02:05" */
export function formatDuration(ms: number, forceHours = false): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/** Cronómetro con centésimas: "1:02.45" */
export function formatStopwatch(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
  return `${m}:${pad(s)}.${pad(cs)}`;
}

/** "hoy 14:32" · "ayer 08:10" · "3 mar 19:45" */
export function formatTripDate(epochMs: number): string {
  const d = new Date(epochMs);
  const now = new Date();
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, now)) return `Hoy ${time}`;
  const yesterday = new Date(now.getTime() - 86400000);
  if (sameDay(d, yesterday)) return `Ayer ${time}`;

  const date = d.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
  return `${date} · ${time}`;
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('es', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatMoney(amount: number, currency = '$'): string {
  return `${currency}${amount.toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Segundos de aceleración: "10,62 s" */
export function formatAccel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return `${seconds.toFixed(2).replace('.', ',')} s`;
}
