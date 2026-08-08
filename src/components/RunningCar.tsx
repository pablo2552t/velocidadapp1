import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { colors, speedColor } from '@/theme/theme';

const VIEW_W = 260;
const VIEW_H = 112;
const ROAD_Y = 98;
const WHEEL_R = 16;
const WHEEL_Y = 82;
const WHEEL_FRONT_X = 176;
const WHEEL_REAR_X = 64;

/** Silueta lateral del hatchback. */
const BODY_PATH = `
  M 26 80
  L 23 66 C 22 60, 24 56, 29 54
  L 46 49
  L 64 27 C 67 22, 72 20, 79 20
  L 144 19 C 153 19, 159 21, 164 27
  L 186 46
  L 214 50 C 222 51, 227 55, 228 62
  L 229 73 C 229 78, 227 80, 223 80
  Z
`;

/** Cristales, en una sola banda para que la silueta quede limpia. */
const GLASS_PATH = `
  M 56 45
  L 70 28 C 72 25, 76 24, 81 24
  L 142 23 C 149 23, 153 25, 157 30
  L 172 45
  Z
`;

/**
 * Integra una tasa a 60 fps y devuelve el acumulado.
 *
 * Con esto las ruedas giran a las vueltas que de verdad daría la rueda a esa
 * velocidad, y el asfalto se desplaza a la par: el GPS entrega una lectura por
 * segundo, pero el movimiento tiene que ser continuo.
 */
function useOdometer(ratePerSecond: number): number {
  const [value, setValue] = useState(0);
  const accumulated = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(ratePerSecond) || Math.abs(ratePerSecond) < 0.01) return;

    let frame = 0;
    let lastTs = 0;
    let running = true;

    const step = (ts: number) => {
      if (!running) return;
      // Al volver de segundo plano el primer delta es enorme; se acota para que
      // las ruedas no peguen un salto.
      const dt = lastTs ? Math.min(ts - lastTs, 64) / 1000 : 0.016;
      lastTs = ts;
      accumulated.current += ratePerSecond * dt;
      setValue(accumulated.current);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [ratePerSecond]);

  return value;
}

type Props = {
  speedKmh: number;
  /** Aceleración longitudinal en g: hunde el morro al frenar y lo levanta al acelerar. */
  gForce?: number;
  /** Circunferencia de rodadura en metros, para que la rueda gire a escala real. */
  tireCircumferenceM: number;
  maxKmh?: number;
  height?: number;
};

function RunningCarBase({
  speedKmh,
  gForce = 0,
  tireCircumferenceM,
  maxKmh = 180,
  height = 112,
}: Props) {
  const speedMs = Math.max(0, speedKmh) / 3.6;
  const intensity = Math.min(1, Math.max(0, speedKmh) / Math.max(40, maxKmh));

  // Vueltas por segundo de la rueda × 360 = grados por segundo.
  const wheelDegPerSec = tireCircumferenceM > 0 ? (speedMs / tireCircumferenceM) * 360 : 0;
  const wheelAngle = useOdometer(wheelDegPerSec);

  // El asfalto avanza en unidades del lienzo. La escala se elige para que a
  // velocidad de ciudad se lea el movimiento sin que parpadee a 120.
  const scroll = useOdometer(speedMs * 2.6);

  // Cabeceo de la suspensión, limitado para que se sienta sin caricaturizar.
  const pitch = Math.max(-2, Math.min(2, -gForce * 3.4));

  const tint = speedColor(speedKmh);
  const dash = 26;
  const roadOffset = -(scroll % (dash * 2));

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          <LinearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#31404F" />
            <Stop offset="0.55" stopColor="#1D2732" />
            <Stop offset="1" stopColor="#131A22" />
          </LinearGradient>
          <LinearGradient id="carGlass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5D7183" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#28323D" stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tint} stopOpacity="0" />
            <Stop offset="1" stopColor={tint} stopOpacity="0.75" />
          </LinearGradient>
        </Defs>

        {/* Líneas de velocidad: nacen al acelerar y se alargan con la marcha */}
        <G opacity={intensity}>
          {[24, 37, 52, 66].map((y, i) => {
            const largo = 26 + intensity * 54 + i * 6;
            const inicio = ((scroll * (1.1 + i * 0.16)) % (VIEW_W + largo)) - largo;
            return (
              <Rect
                key={y}
                x={VIEW_W - inicio - largo}
                y={y}
                width={largo}
                height={1.6}
                rx={0.8}
                fill="url(#streak)"
                opacity={0.35 + i * 0.1}
              />
            );
          })}
        </G>

        {/* Asfalto */}
        <Line x1="0" y1={ROAD_Y} x2={VIEW_W} y2={ROAD_Y} stroke={colors.border} strokeWidth={1.5} />
        <G>
          {Array.from({ length: 8 }, (_, i) => (
            <Rect
              key={i}
              x={roadOffset + i * dash * 2}
              y={ROAD_Y + 4}
              width={dash}
              height={2.5}
              rx={1.25}
              fill={colors.textFaint}
              opacity={0.5}
            />
          ))}
        </G>

        {/* Sombra bajo el carro: se aprieta al acelerar */}
        <Rect
          x={34}
          y={ROAD_Y - 5}
          width={196}
          height={7}
          rx={3.5}
          fill="#000"
          opacity={0.34}
        />

        <G rotation={pitch} origin={`${VIEW_W / 2}, ${WHEEL_Y}`}>
          <Path d={BODY_PATH} fill="url(#carBody)" stroke="#465768" strokeWidth={1.2} />
          <Path d={GLASS_PATH} fill="url(#carGlass)" />
          {/* Montante central */}
          <Line x1="112" y1="24" x2="112" y2="45" stroke="#1B2530" strokeWidth={2.5} />
          {/* Línea de puerta y manija */}
          <Line x1="112" y1="46" x2="112" y2="79" stroke="#0F161D" strokeWidth={1.2} opacity={0.8} />
          <Rect x="120" y="52" width="11" height="2.6" rx={1.3} fill="#3E4E5E" />
          {/* Espejo */}
          <Path d="M 163 40 L 172 38 L 172 43 Z" fill="#2A3541" />

          {/* Faro y piloto: el faro se enciende con la velocidad */}
          <Path
            d="M 213 55 L 226 57 L 226 63 L 213 62 Z"
            fill="#FFF6D8"
            opacity={0.55 + intensity * 0.45}
          />
          <Path d="M 24 57 L 33 56 L 33 63 L 24 63 Z" fill={colors.danger} opacity={0.85} />

          {/* Pasos de rueda */}
          <Path
            d={`M ${WHEEL_REAR_X - 22} 80 A 22 22 0 0 1 ${WHEEL_REAR_X + 22} 80`}
            fill="none"
            stroke="#0D131A"
            strokeWidth={3}
          />
          <Path
            d={`M ${WHEEL_FRONT_X - 22} 80 A 22 22 0 0 1 ${WHEEL_FRONT_X + 22} 80`}
            fill="none"
            stroke="#0D131A"
            strokeWidth={3}
          />

          {[WHEEL_REAR_X, WHEEL_FRONT_X].map((cx) => (
            <G key={cx}>
              <Circle cx={cx} cy={WHEEL_Y} r={WHEEL_R} fill="#0B1016" stroke="#2C3843" strokeWidth={1.5} />
              <G rotation={wheelAngle} origin={`${cx}, ${WHEEL_Y}`}>
                <Circle cx={cx} cy={WHEEL_Y} r={WHEEL_R * 0.62} fill="#1E2833" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <Rect
                    key={a}
                    x={cx - 1.4}
                    y={WHEEL_Y - WHEEL_R * 0.6}
                    width={2.8}
                    height={WHEEL_R * 0.52}
                    rx={1.4}
                    fill="#4A5C6D"
                    transform={`rotate(${a}, ${cx}, ${WHEEL_Y})`}
                  />
                ))}
              </G>
              <Circle cx={cx} cy={WHEEL_Y} r={3} fill={tint} />
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
});

export const RunningCar = memo(RunningCarBase);
