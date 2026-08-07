import { useEffect, useRef, useState } from 'react';

/**
 * Suaviza un valor que llega a saltos hacia un objetivo, a 60 fps.
 *
 * El GPS entrega una lectura por segundo: sin esto, la aguja del velocímetro
 * daría tirones. Interpola exponencialmente y se detiene sola al llegar, para
 * no re-renderizar cuando el valor ya está quieto.
 *
 * @param target valor objetivo
 * @param tau constante de tiempo en ms (mayor = más suave y más lento)
 * @param epsilon diferencia por debajo de la cual se considera que llegó
 */
export function useSmoothValue(target: number, tau = 260, epsilon = 0.02): number {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (Math.abs(target - currentRef.current) < epsilon) {
      currentRef.current = target;
      setValue(target);
      return;
    }

    let frame = 0;
    let lastTs = 0;
    let running = true;

    const step = (ts: number) => {
      if (!running) return;
      // Limita el delta: al volver de segundo plano el primer frame trae un
      // salto enorme que provocaría un tirón visible.
      const dt = lastTs ? Math.min(ts - lastTs, 64) : 16;
      lastTs = ts;

      const k = 1 - Math.exp(-dt / tau);
      currentRef.current += (target - currentRef.current) * k;

      const arrived = Math.abs(target - currentRef.current) < epsilon;
      if (arrived) currentRef.current = target;
      setValue(currentRef.current);

      if (!arrived) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [target, tau, epsilon]);

  return value;
}
