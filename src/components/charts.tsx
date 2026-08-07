import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { colors, mono } from '@/theme/theme';
import { TrackPoint } from '@/services/tripEngine';
import { MS_TO_KMH } from '@/utils/format';

/** Mide el ancho disponible para que las gráficas se adapten al contenedor. */
function useMeasuredWidth(fallback = 320) {
  const [width, setWidth] = useState(fallback);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };
  return { width, onLayout };
}

/** Reduce una serie a como mucho `maxPoints` conservando picos y valles. */
function decimate<T>(items: T[], maxPoints: number, valueOf: (t: T) => number): T[] {
  if (items.length <= maxPoints) return items;
  const bucketSize = items.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(items.length, Math.floor((i + 1) * bucketSize));
    let lo = items[start];
    let hi = items[start];
    for (let k = start; k < end; k++) {
      if (valueOf(items[k]) < valueOf(lo)) lo = items[k];
      if (valueOf(items[k]) > valueOf(hi)) hi = items[k];
    }
    // Mantiene el orden original dentro del bucket para no dentar la línea.
    out.push(items[start] === lo ? lo : hi);
  }
  return out;
}

const PAD_TOP = 14;
const PAD_BOTTOM = 20;
const PAD_LEFT = 34;

type SeriesProps = { points: TrackPoint[]; height?: number };

/**
 * Perfil de elevación del viaje: altitud contra distancia recorrida.
 * Es la vista que responde a "¿cuánto bajé?".
 */
export function ElevationChart({ points, height = 150 }: SeriesProps) {
  const { width, onLayout } = useMeasuredWidth();

  const data = useMemo(
    () => decimate(points.filter((p) => p.a != null), 220, (p) => p.a as number),
    [points]
  );

  const geometry = useMemo(() => {
    if (data.length < 2) return null;
    const alts = data.map((p) => p.a as number);
    let minAlt = Math.min(...alts);
    let maxAlt = Math.max(...alts);
    if (maxAlt - minAlt < 12) {
      // Evita que un perfil casi plano se dibuje como una montaña rusa.
      const mid = (maxAlt + minAlt) / 2;
      minAlt = mid - 6;
      maxAlt = mid + 6;
    }
    const maxDist = data[data.length - 1].d || 1;
    const plotW = width - PAD_LEFT - 8;
    const plotH = height - PAD_TOP - PAD_BOTTOM;

    const x = (d: number) => PAD_LEFT + (d / maxDist) * plotW;
    const y = (a: number) => PAD_TOP + (1 - (a - minAlt) / (maxAlt - minAlt)) * plotH;

    const line = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.d).toFixed(1)} ${y(p.a as number).toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${x(maxDist).toFixed(1)} ${PAD_TOP + plotH} L ${PAD_LEFT} ${
      PAD_TOP + plotH
    } Z`;

    return { line, area, minAlt, maxAlt, plotH };
  }, [data, width, height]);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {geometry ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.descent} stopOpacity="0.42" />
              <Stop offset="1" stopColor={colors.descent} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={PAD_LEFT}
              x2={width - 8}
              y1={PAD_TOP + geometry.plotH * f}
              y2={PAD_TOP + geometry.plotH * f}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}

          <Path d={geometry.area} fill="url(#elevFill)" />
          <Path
            d={geometry.line}
            stroke={colors.descent}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />

          <SvgText x={2} y={PAD_TOP + 4} fill={colors.textFaint} fontSize={10}>
            {Math.round(geometry.maxAlt)}
          </SvgText>
          <SvgText x={2} y={PAD_TOP + geometry.plotH + 4} fill={colors.textFaint} fontSize={10}>
            {Math.round(geometry.minAlt)}
          </SvgText>
          <SvgText x={2} y={height - 4} fill={colors.textFaint} fontSize={9}>
            m
          </SvgText>
        </Svg>
      ) : (
        <ChartPlaceholder message="Sin datos de altitud" />
      )}
    </View>
  );
}

/** Velocidad contra distancia, con degradado vertical según lo rápido que ibas. */
export function SpeedChart({ points, height = 150 }: SeriesProps) {
  const { width, onLayout } = useMeasuredWidth();

  const data = useMemo(() => decimate(points, 240, (p) => p.s), [points]);

  const geometry = useMemo(() => {
    if (data.length < 2) return null;
    const speeds = data.map((p) => p.s * MS_TO_KMH);
    const maxSpeed = Math.max(20, Math.ceil(Math.max(...speeds) / 20) * 20);
    const maxDist = data[data.length - 1].d || 1;
    const plotW = width - PAD_LEFT - 8;
    const plotH = height - PAD_TOP - PAD_BOTTOM;

    const x = (d: number) => PAD_LEFT + (d / maxDist) * plotW;
    const y = (v: number) => PAD_TOP + (1 - v / maxSpeed) * plotH;

    const line = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.d).toFixed(1)} ${y(p.s * MS_TO_KMH).toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${x(maxDist).toFixed(1)} ${PAD_TOP + plotH} L ${PAD_LEFT} ${
      PAD_TOP + plotH
    } Z`;

    return { line, area, maxSpeed, plotH };
  }, [data, width, height]);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {geometry ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="speedLine" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FB3B4E" />
              <Stop offset="0.35" stopColor="#FBBF24" />
              <Stop offset="0.7" stopColor="#A3E635" />
              <Stop offset="1" stopColor="#22D3EE" />
            </LinearGradient>
            <LinearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FBBF24" stopOpacity="0.30" />
              <Stop offset="1" stopColor="#22D3EE" stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {[0, 0.5, 1].map((f) => (
            <G key={f}>
              <Line
                x1={PAD_LEFT}
                x2={width - 8}
                y1={PAD_TOP + geometry.plotH * f}
                y2={PAD_TOP + geometry.plotH * f}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={2}
                y={PAD_TOP + geometry.plotH * f + 4}
                fill={colors.textFaint}
                fontSize={10}
              >
                {Math.round(geometry.maxSpeed * (1 - f))}
              </SvgText>
            </G>
          ))}

          <Path d={geometry.area} fill="url(#speedFill)" />
          <Path
            d={geometry.line}
            stroke="url(#speedLine)"
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
        </Svg>
      ) : (
        <ChartPlaceholder message="Sin datos de velocidad" />
      )}
    </View>
  );
}

/** Barras de distancia diaria para el dashboard. */
export function DailyBars({
  data,
  height = 130,
  unitLabel = 'km',
}: {
  data: { day: string; km: number }[];
  height?: number;
  unitLabel?: string;
}) {
  const { width, onLayout } = useMeasuredWidth();
  const maxKm = Math.max(1, ...data.map((d) => d.km));
  const plotH = height - 26;
  const gap = 4;
  const barW = data.length > 0 ? Math.max(4, (width - gap * (data.length - 1)) / data.length) : 0;

  return (
    <View onLayout={onLayout} style={{ height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0.25" />
          </LinearGradient>
        </Defs>
        {data.map((d, i) => {
          const h = Math.max(d.km > 0 ? 3 : 1, (d.km / maxKm) * plotH);
          const x = i * (barW + gap);
          const isLast = i === data.length - 1;
          return (
            <G key={d.day}>
              <Rect
                x={x}
                y={plotH - h}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
                fill={d.km > 0 ? 'url(#barFill)' : colors.track}
              />
              {(i % 3 === 0 || isLast) && (
                <SvgText
                  x={x + barW / 2}
                  y={height - 8}
                  fill={colors.textFaint}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {d.day.slice(8)}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
      <Text style={styles.barCaption}>
        máx {maxKm.toFixed(1)} {unitLabel}/día
      </Text>
    </View>
  );
}

function ChartPlaceholder({ message }: { message: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.textFaint, fontSize: 12 },
  barCaption: {
    position: 'absolute',
    right: 0,
    top: 0,
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: mono,
  },
});
