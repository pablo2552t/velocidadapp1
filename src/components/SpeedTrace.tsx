import React, { memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

import { TrackPoint } from '@/services/tripEngine';
import { speedColor } from '@/theme/theme';
import { MS_TO_KMH } from '@/utils/format';
import { LatLng } from '@/utils/geo';

/**
 * Traza el recorrido coloreando cada tramo según la velocidad.
 *
 * `react-native-maps` no admite degradados por vértice, así que se agrupan los
 * puntos en tramos de velocidad parecida y se dibuja una polilínea por tramo.
 * Se limita el número de tramos para no ahogar el mapa en viajes largos.
 */
function SpeedTraceBase({
  points,
  width = 5,
  maxSegments = 90,
}: {
  points: TrackPoint[];
  width?: number;
  maxSegments?: number;
}) {
  const segments = useMemo(() => {
    if (points.length < 2) return [];

    // Cuantiza la velocidad en escalones de 12 km/h: suficiente para leer el
    // color y evita fragmentar la línea en cientos de trozos.
    const bucketOf = (p: TrackPoint) => Math.round((p.s * MS_TO_KMH) / 12);

    const out: { coords: LatLng[]; color: string }[] = [];
    let current: LatLng[] = [{ latitude: points[0].lat, longitude: points[0].lon }];
    let currentBucket = bucketOf(points[0]);
    let speedSum = points[0].s;

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const bucket = bucketOf(p);
      current.push({ latitude: p.lat, longitude: p.lon });
      speedSum += p.s;

      if (bucket !== currentBucket && current.length > 1) {
        out.push({
          coords: current,
          color: speedColor((speedSum / current.length) * MS_TO_KMH),
        });
        // El primer punto del tramo siguiente es el último del anterior para
        // que la línea quede continua, sin huecos entre colores.
        current = [current[current.length - 1]];
        currentBucket = bucket;
        speedSum = p.s;
      }
    }
    if (current.length > 1) {
      out.push({ coords: current, color: speedColor((speedSum / current.length) * MS_TO_KMH) });
    }

    if (out.length <= maxSegments) return out;

    // Demasiados tramos: fusiona vecinos hasta bajar del límite.
    const factor = Math.ceil(out.length / maxSegments);
    const merged: { coords: LatLng[]; color: string }[] = [];
    for (let i = 0; i < out.length; i += factor) {
      const group = out.slice(i, i + factor);
      merged.push({
        coords: group.flatMap((g, gi) => (gi === 0 ? g.coords : g.coords.slice(1))),
        color: group[Math.floor(group.length / 2)].color,
      });
    }
    return merged;
  }, [points, maxSegments]);

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          coordinates={seg.coords}
          strokeColor={seg.color}
          strokeWidth={width}
          lineCap="round"
          lineJoin="round"
        />
      ))}
    </>
  );
}

export const SpeedTrace = memo(SpeedTraceBase);
