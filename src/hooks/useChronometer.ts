import { useCallback, useEffect, useRef, useState } from 'react';

export type Lap = { index: number; splitMs: number; totalMs: number };

/**
 * Cronómetro manual con vueltas.
 *
 * El tiempo se calcula siempre a partir de `Date.now()` y no acumulando
 * intervalos: así no se desfasa si el sistema retrasa el temporizador ni si la
 * app pasa a segundo plano.
 */
export function useChronometer(tickMs = 47) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  const readElapsed = useCallback(() => {
    const base = accumulatedRef.current;
    return startedAtRef.current == null ? base : base + (Date.now() - startedAtRef.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(readElapsed()), tickMs);
    return () => clearInterval(id);
  }, [running, tickMs, readElapsed]);

  const start = useCallback(() => {
    if (startedAtRef.current != null) return;
    startedAtRef.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAtRef.current == null) return;
    accumulatedRef.current += Date.now() - startedAtRef.current;
    startedAtRef.current = null;
    setElapsed(accumulatedRef.current);
    setRunning(false);
  }, []);

  const toggle = useCallback(() => {
    if (startedAtRef.current == null) start();
    else pause();
  }, [start, pause]);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsed(0);
    setLaps([]);
    setRunning(false);
  }, []);

  const lap = useCallback(() => {
    const total = readElapsed();
    setLaps((prev) => {
      const previousTotal = prev.length ? prev[0].totalMs : 0;
      return [{ index: prev.length + 1, splitMs: total - previousTotal, totalMs: total }, ...prev];
    });
  }, [readElapsed]);

  return { running, elapsed, laps, start, pause, toggle, reset, lap };
}
