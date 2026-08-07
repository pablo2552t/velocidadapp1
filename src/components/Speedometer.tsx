import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useSmoothValue } from '@/hooks/useSmoothValue';
import { colors, mono, speedColor } from '@/theme/theme';

const START_DEG = 135;
const SWEEP_DEG = 270;

type Props = {
  /** Velocidad ya convertida a la unidad que se muestra. */
  value: number;
  max: number;
  unitLabel: string;
  /** Marca de velocidad máxima alcanzada (misma unidad). */
  peak?: number;
  /** Marca del límite configurado (misma unidad). */
  limit?: number | null;
  /** Velocidad máxima del vehículo: pinta la zona roja (misma unidad). */
  vehicleTop?: number | null;
  size?: number;
  overLimit?: boolean;
  /** Texto secundario bajo el número (marcha estimada, rpm…). */
  caption?: string;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const a = polar(cx, cy, r, startDeg);
  const b = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

function SpeedometerBase({
  value,
  max,
  unitLabel,
  peak = 0,
  limit = null,
  vehicleTop = null,
  size = 300,
  overLimit = false,
  caption,
}: Props) {
  const target = Math.max(0, Math.min(value, max));
  const smooth = useSmoothValue(target, 240, 0.05);
  const ratio = max > 0 ? smooth / max : 0;

  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.055;
  const radius = cx - strokeWidth / 2 - size * 0.055;
  const arcLength = 2 * Math.PI * radius * (SWEEP_DEG / 360);

  const trackPath = useMemo(
    () => arcPath(cx, cy, radius, START_DEG, START_DEG + SWEEP_DEG),
    [cx, cy, radius]
  );

  // Marcas: una mayor con número cada `majorStep`, dos menores intermedias.
  const majorStep = max <= 140 ? 20 : max <= 240 ? 20 : 40;
  const ticks = useMemo(() => {
    const out: { v: number; major: boolean }[] = [];
    const minorStep = majorStep / 2;
    for (let v = 0; v <= max + 0.001; v += minorStep) {
      out.push({ v, major: Math.abs(v % majorStep) < 0.001 });
    }
    return out;
  }, [max, majorStep]);

  const degFor = (v: number) => START_DEG + (Math.max(0, Math.min(v, max)) / max) * SWEEP_DEG;

  const needleDeg = START_DEG + ratio * SWEEP_DEG;
  const needleLen = radius - strokeWidth * 1.15;
  const tint = overLimit ? colors.danger : speedColor(unitLabel === 'mph' ? smooth / 0.621371 : smooth);

  const redlineFrom = vehicleTop != null && vehicleTop < max ? vehicleTop : null;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="speedArc" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#22D3EE" />
            <Stop offset="0.35" stopColor="#34D399" />
            <Stop offset="0.55" stopColor="#A3E635" />
            <Stop offset="0.75" stopColor="#FBBF24" />
            <Stop offset="1" stopColor="#FB3B4E" />
          </LinearGradient>
        </Defs>

        {/* Canal de fondo */}
        <Path
          d={trackPath}
          stroke={colors.track}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {/* Zona roja: por encima de la velocidad máxima del vehículo */}
        {redlineFrom != null && (
          <Path
            d={arcPath(cx, cy, radius, degFor(redlineFrom), START_DEG + SWEEP_DEG)}
            stroke={colors.danger}
            strokeOpacity={0.35}
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}

        {/* Arco de progreso: el degradado se revela con el dash offset */}
        <Path
          d={trackPath}
          stroke="url(#speedArc)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${arcLength}`}
          strokeDashoffset={arcLength * (1 - ratio)}
        />

        {/* Marcas y números */}
        <G>
          {ticks.map(({ v, major }) => {
            const deg = degFor(v);
            const rOuter = radius - strokeWidth * 0.72;
            const rInner = rOuter - (major ? size * 0.045 : size * 0.022);
            const p1 = polar(cx, cy, rOuter, deg);
            const p2 = polar(cx, cy, rInner, deg);
            const label = polar(cx, cy, rInner - size * 0.058, deg);
            return (
              <G key={v}>
                <Line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={major ? colors.textMuted : colors.textFaint}
                  strokeWidth={major ? 2 : 1}
                  strokeLinecap="round"
                />
                {major && (
                  <SvgText
                    x={label.x}
                    y={label.y + size * 0.018}
                    fill={colors.textMuted}
                    fontSize={size * 0.048}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {String(Math.round(v))}
                  </SvgText>
                )}
              </G>
            );
          })}
        </G>

        {/* Marca del límite configurado */}
        {limit != null && limit > 0 && limit <= max && (
          <G rotation={degFor(limit) - 90} origin={`${cx}, ${cy}`}>
            <Polygon
              points={`${cx},${cy - radius + strokeWidth * 0.05} ${cx - size * 0.022},${
                cy - radius - size * 0.035
              } ${cx + size * 0.022},${cy - radius - size * 0.035}`}
              fill={colors.amber}
            />
          </G>
        )}

        {/* Máxima alcanzada en la sesión */}
        {peak > 0 && peak <= max && (
          <G rotation={degFor(peak) - 90} origin={`${cx}, ${cy}`}>
            <Line
              x1={cx}
              y1={cy - radius - strokeWidth * 0.5}
              x2={cx}
              y2={cy - radius + strokeWidth * 0.5}
              stroke="#FFFFFF"
              strokeOpacity={0.85}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </G>
        )}

        {/* Aguja */}
        <G rotation={needleDeg - 90} origin={`${cx}, ${cy}`}>
          <Line
            x1={cx}
            y1={cy + size * 0.05}
            x2={cx}
            y2={cy - needleLen}
            stroke={tint}
            strokeWidth={size * 0.012}
            strokeLinecap="round"
          />
        </G>
        <Circle cx={cx} cy={cy} r={size * 0.035} fill={colors.bgElevated} />
        <Circle
          cx={cx}
          cy={cy}
          r={size * 0.035}
          fill="none"
          stroke={tint}
          strokeWidth={2}
        />
      </Svg>

      {/* Lectura digital superpuesta: RN Text da mejor tipografía que SVG Text */}
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Text
          style={[
            styles.value,
            { fontSize: size * 0.29, color: overLimit ? colors.danger : colors.text },
          ]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {Math.round(smooth)}
        </Text>
        <Text style={[styles.unit, { fontSize: size * 0.052 }]} allowFontScaling={false}>
          {unitLabel}
        </Text>
        {!!caption && (
          <Text style={[styles.caption, { fontSize: size * 0.042 }]} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: {
    fontWeight: '200',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    marginTop: -6,
  },
  unit: {
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: -4,
  },
  caption: {
    color: colors.accent,
    fontFamily: mono,
    marginTop: 8,
  },
});

export const Speedometer = memo(SpeedometerBase);
