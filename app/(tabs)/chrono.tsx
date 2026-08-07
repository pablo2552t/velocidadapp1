import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Divider,
  GlassCard,
  PrimaryButton,
  SectionTitle,
  StatGrid,
  StatTile,
} from '@/components/ui';
import { useChronometer } from '@/hooks/useChronometer';
import { useSettings } from '@/state/SettingsContext';
import { useTracking } from '@/state/TrackingContext';
import { colors, font, mono, radius, spacing } from '@/theme/theme';
import {
  formatAccel,
  formatDistance,
  formatNumber,
  formatStopwatch,
  speedUnitLabel,
  toDisplaySpeed,
} from '@/utils/format';

const TAB_BAR_SPACE = 78;

export default function ChronoScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { live, trip } = useTracking();
  const chrono = useChronometer();

  const unit = settings.unit;
  const unitLabel = speedUnitLabel(unit);
  const vehicle = settings.vehicle;

  const best = live.perf;
  const lastRun = live.lastRun;

  // Comparación con la cifra de fábrica: el signo importa más que el valor.
  const delta = useMemo(() => {
    if (best.t0_100 == null) return null;
    return best.t0_100 - vehicle.accel0100Factory;
  }, [best.t0_100, vehicle.accel0100Factory]);

  const armed = live.speedKmh < 2;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + TAB_BAR_SPACE,
        paddingHorizontal: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Cronómetro</Text>

      {/* ------------------ cronómetro manual ------------------ */}
      <GlassCard style={styles.chronoCard}>
        <Text style={styles.chronoValue} allowFontScaling={false} numberOfLines={1}>
          {formatStopwatch(chrono.elapsed)}
        </Text>
        <View style={styles.chronoButtons}>
          <PrimaryButton
            label={chrono.running ? 'Vuelta' : 'Reiniciar'}
            icon={chrono.running ? 'flag' : 'refresh'}
            onPress={chrono.running ? chrono.lap : chrono.reset}
            variant="ghost"
            tint={colors.textMuted}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label={chrono.running ? 'Parar' : chrono.elapsed > 0 ? 'Seguir' : 'Iniciar'}
            icon={chrono.running ? 'pause' : 'play'}
            onPress={chrono.toggle}
            tint={chrono.running ? colors.danger : colors.lime}
            style={{ flex: 1 }}
          />
        </View>
      </GlassCard>

      {chrono.laps.length > 0 && (
        <>
          <SectionTitle right={<Badge label={`${chrono.laps.length} VUELTAS`} />}>
            Vueltas
          </SectionTitle>
          <GlassCard padded={false}>
            {chrono.laps.map((lap, i) => (
              <View key={lap.index}>
                {i > 0 && <Divider />}
                <View style={styles.lapRow}>
                  <Text style={styles.lapIndex}>#{lap.index}</Text>
                  <Text style={styles.lapSplit}>{formatStopwatch(lap.splitMs)}</Text>
                  <Text style={styles.lapTotal}>{formatStopwatch(lap.totalMs)}</Text>
                </View>
              </View>
            ))}
          </GlassCard>
        </>
      )}

      {/* ------------------ modo arrancada ------------------ */}
      <SectionTitle
        right={
          <Badge
            label={armed ? 'LISTO PARA ARRANCAR' : 'EN MOVIMIENTO'}
            tint={armed ? colors.lime : colors.textFaint}
          />
        }
      >
        Modo arrancada
      </SectionTitle>
      <GlassCard>
        <Text style={styles.dragHint}>
          Detén el carro por completo y acelera a fondo: la app cronometra sola cada umbral usando
          el GPS. No hace falta tocar nada.
        </Text>
        <View style={styles.dragLive}>
          <Text style={styles.dragLiveValue} allowFontScaling={false}>
            {formatNumber(toDisplaySpeed(live.speedKmh, unit))}
          </Text>
          <Text style={styles.dragLiveUnit}>{unitLabel}</Text>
        </View>
      </GlassCard>

      <SectionTitle>Mejores marcas de la sesión</SectionTitle>
      <StatGrid>
        <StatTile
          label="0 → 100 km/h"
          value={formatAccel(best.t0_100)}
          icon="rocket-outline"
          tint={best.t0_100 != null ? colors.lime : colors.textFaint}
        />
        <StatTile
          label="0 → 60 km/h"
          value={formatAccel(best.t0_60)}
          icon="rocket-outline"
        />
        <StatTile
          label="60 → 100 km/h"
          value={formatAccel(best.t60_100)}
          icon="trending-up-outline"
        />
        <StatTile
          label="100 → 0 frenada"
          value={formatAccel(best.t100_0)}
          icon="stop-circle-outline"
          tint={best.t100_0 != null ? colors.danger : colors.textFaint}
        />
        <StatTile label="402 m" value={formatAccel(best.t402m)} icon="flag-outline" />
        <StatTile
          label="Vel. en meta"
          value={
            best.vTrap != null
              ? `${formatNumber(toDisplaySpeed(best.vTrap, unit))} ${unitLabel}`
              : '—'
          }
          icon="speedometer-outline"
        />
      </StatGrid>

      {delta != null && (
        <View
          style={[
            styles.deltaCard,
            { borderColor: delta <= 0 ? `${colors.lime}55` : `${colors.amber}55` },
          ]}
        >
          <Ionicons
            name={delta <= 0 ? 'trophy' : 'information-circle'}
            size={18}
            color={delta <= 0 ? colors.lime : colors.amber}
          />
          <Text style={styles.deltaText}>
            {delta <= 0
              ? `${Math.abs(delta).toFixed(2).replace('.', ',')} s por debajo del dato de fábrica (${vehicle.accel0100Factory.toFixed(1).replace('.', ',')} s).`
              : `${delta.toFixed(2).replace('.', ',')} s por encima del dato de fábrica (${vehicle.accel0100Factory.toFixed(1).replace('.', ',')} s). Influyen la carga, la altitud y la pendiente.`}
          </Text>
        </View>
      )}

      {lastRun && (
        <>
          <SectionTitle>Última pasada</SectionTitle>
          <GlassCard padded={false}>
            <PassRow label="0 → 60 km/h" value={formatAccel(lastRun.t0_60)} />
            <Divider />
            <PassRow label="0 → 100 km/h" value={formatAccel(lastRun.t0_100)} />
            <Divider />
            <PassRow label="402 m" value={formatAccel(lastRun.t402m)} />
          </GlassCard>
        </>
      )}

      {/* ------------------ tramo en curso ------------------ */}
      {trip && (
        <>
          <SectionTitle right={<Badge label="EN CURSO" tint={colors.danger} />}>
            Tramo actual
          </SectionTitle>
          <StatGrid>
            <StatTile
              label="Recorrido"
              value={formatDistance(trip.distanceM, unit)}
              icon="trail-sign-outline"
              tint={colors.accent}
              compact
            />
            <StatTile
              label="En marcha"
              value={formatStopwatch(trip.movingMs).split('.')[0]}
              icon="car-outline"
              compact
            />
            <StatTile
              label="Detenido"
              value={formatStopwatch(trip.stoppedMs).split('.')[0]}
              icon="hourglass-outline"
              tint={colors.textMuted}
              compact
            />
          </StatGrid>
        </>
      )}

      <Text style={styles.footnote}>
        El GPS entrega una lectura por segundo; los cruces de umbral se interpolan entre lecturas,
        así que el margen de error típico es de una a dos décimas.
      </Text>
    </ScrollView>
  );
}

function PassRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.passRow}>
      <Text style={styles.passLabel}>{label}</Text>
      <Text style={styles.passValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenTitle: { ...font.title, fontSize: 30, color: colors.text, marginBottom: spacing.lg },

  chronoCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  chronoValue: {
    fontSize: 52,
    fontWeight: '200',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
  },
  chronoButtons: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },

  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  lapIndex: { width: 42, color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  lapSplit: { flex: 1, color: colors.text, fontFamily: mono, fontSize: 16 },
  lapTotal: { color: colors.textFaint, fontFamily: mono, fontSize: 13 },

  dragHint: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  dragLive: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  dragLiveValue: {
    fontSize: 46,
    fontWeight: '200',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  dragLiveUnit: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },

  deltaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  deltaText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
  },
  passLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  passValue: { fontSize: 16, color: colors.text, fontFamily: mono },

  footnote: {
    fontSize: 11,
    color: colors.textFaint,
    lineHeight: 16,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
});
