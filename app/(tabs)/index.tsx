import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Speedometer } from '@/components/Speedometer';
import {
  Badge,
  EmptyState,
  GlassCard,
  PrimaryButton,
  SectionTitle,
  StatGrid,
  StatTile,
} from '@/components/ui';
import { useSettings } from '@/state/SettingsContext';
import { useTracking } from '@/state/TrackingContext';
import { colors, font, gradeColor, mono, radius, spacing } from '@/theme/theme';
import {
  formatAccel,
  formatDistance,
  formatDuration,
  formatNumber,
  speedUnitLabel,
  toDisplaySpeed,
} from '@/utils/format';
import { cardinal } from '@/utils/geo';
import { estimateGearAndRpm } from '@/vehicles/polo';

const TAB_BAR_SPACE = 78;

export default function SpeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const {
    status,
    permission,
    gpsActive,
    live,
    trip,
    overLimit,
    savingTrip,
    requestPermission,
    start,
    pause,
    resume,
    stop,
    discard,
  } = useTracking();

  const unit = settings.unit;
  const unitLabel = speedUnitLabel(unit);
  const vehicle = settings.vehicle;

  // Escala del dial: redondeada hacia arriba desde la máxima del vehículo.
  const gaugeMax = useMemo(() => {
    const top = toDisplaySpeed(vehicle.topSpeedKmh, unit);
    return Math.ceil((top * 1.08) / 20) * 20;
  }, [vehicle.topSpeedKmh, unit]);

  const shown = trip ?? live;
  const gear = useMemo(
    () => estimateGearAndRpm(vehicle, live.speedKmh),
    [vehicle, live.speedKmh]
  );

  const handleStop = () => {
    Alert.alert('Finalizar viaje', '¿Guardar este viaje en el historial?', [
      { text: 'Seguir grabando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: discard,
      },
      {
        text: 'Guardar',
        onPress: async () => {
          const id = await stop();
          if (id) router.push(`/trip/${id}`);
          else Alert.alert('Viaje descartado', 'El recorrido fue demasiado corto para guardarlo.');
        },
      },
    ]);
  };

  if (permission === 'denied') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          icon="location-outline"
          title="Sin acceso al GPS"
          message="Activa la ubicación para Velocidad en Ajustes › Privacidad › Localización. Sin GPS no se puede medir la velocidad."
        />
      </View>
    );
  }

  if (permission === 'unknown') {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <EmptyState
          icon="navigate-circle-outline"
          title="Listo para arrancar"
          message="Velocidad necesita el GPS para medir tu velocidad, altitud y trazar el recorrido."
        />
        <PrimaryButton
          label="Permitir ubicación"
          icon="navigate"
          onPress={requestPermission}
          style={{ marginHorizontal: spacing.xl }}
        />
      </View>
    );
  }

  const accuracy = live.accuracy;
  const gpsQuality =
    !gpsActive || accuracy == null
      ? { label: 'BUSCANDO GPS', tint: colors.textFaint }
      : accuracy <= 8
        ? { label: 'GPS PRECISO', tint: colors.lime }
        : accuracy <= 20
          ? { label: 'GPS MEDIO', tint: colors.amber }
          : { label: 'GPS DÉBIL', tint: colors.danger };

  const grade = live.grade;
  const gradeLabel = grade > 0.8 ? 'SUBIDA' : grade < -0.8 ? 'BAJADA' : 'LLANO';

  return (
    <View style={styles.screen}>
      {overLimit && (
        <LinearGradient
          colors={['rgba(251,59,78,0.35)', 'transparent']}
          style={styles.alertGlow}
          pointerEvents="none"
        />
      )}

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + TAB_BAR_SPACE,
          paddingHorizontal: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- barra de estado ---------------- */}
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <View style={[styles.dot, { backgroundColor: gpsQuality.tint }]} />
            <Text style={[styles.statusText, { color: gpsQuality.tint }]}>{gpsQuality.label}</Text>
            {accuracy != null && (
              <Text style={styles.statusDim}>±{Math.round(accuracy)} m</Text>
            )}
          </View>
          {status === 'recording' && <Badge label="● GRABANDO" tint={colors.danger} />}
          {status === 'paused' && <Badge label="❚❚ EN PAUSA" tint={colors.amber} />}
          {status === 'idle' && <Badge label={vehicle.nickname.toUpperCase()} tint={colors.accent} />}
        </View>

        {/* ---------------- velocímetro ---------------- */}
        <View style={styles.gaugeWrap}>
          <Speedometer
            value={toDisplaySpeed(live.speedKmh, unit)}
            max={gaugeMax}
            unitLabel={unitLabel}
            peak={toDisplaySpeed(shown.maxSpeedKmh, unit)}
            limit={settings.speedAlertEnabled ? toDisplaySpeed(settings.speedLimit, unit) : null}
            vehicleTop={toDisplaySpeed(vehicle.topSpeedKmh, unit)}
            overLimit={overLimit}
            size={320}
            caption={
              gear
                ? `${gear.gear}ª · ${formatNumber(Math.round(gear.rpm / 50) * 50)} rpm aprox.`
                : undefined
            }
          />
        </View>

        {overLimit && (
          <View style={styles.limitBanner}>
            <Ionicons name="warning" size={15} color={colors.danger} />
            <Text style={styles.limitText}>
              Vas sobre el límite de {Math.round(toDisplaySpeed(settings.speedLimit, unit))}{' '}
              {unitLabel}
            </Text>
          </View>
        )}

        {/* ---------------- control del viaje ---------------- */}
        <View style={styles.controls}>
          {status === 'idle' ? (
            <PrimaryButton
              label="Iniciar viaje"
              icon="play"
              onPress={start}
              tint={colors.accent}
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <PrimaryButton
                label={status === 'paused' ? 'Reanudar' : 'Pausar'}
                icon={status === 'paused' ? 'play' : 'pause'}
                onPress={status === 'paused' ? resume : pause}
                tint={colors.amber}
                variant="outline"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={savingTrip ? 'Guardando…' : 'Finalizar'}
                icon="stop"
                onPress={handleStop}
                tint={colors.danger}
                disabled={savingTrip}
                style={{ flex: 1 }}
              />
            </>
          )}
        </View>

        {/* ---------------- viaje ---------------- */}
        <SectionTitle>{trip ? 'Viaje en curso' : 'Sesión actual'}</SectionTitle>
        <StatGrid>
          <StatTile
            label="Distancia"
            value={formatDistance(shown.distanceM, unit)}
            icon="trail-sign-outline"
            tint={colors.accent}
          />
          <StatTile
            label={trip ? 'Tiempo' : 'App abierta'}
            value={formatDuration(shown.durationMs)}
            icon="time-outline"
          />
          <StatTile
            label="Máxima"
            value={formatNumber(toDisplaySpeed(shown.maxSpeedKmh, unit))}
            unit={unitLabel}
            icon="flash-outline"
            tint={colors.lime}
          />
          <StatTile
            label="Media"
            value={formatNumber(toDisplaySpeed(shown.avgSpeedKmh, unit))}
            unit={unitLabel}
            icon="analytics-outline"
          />
          <StatTile
            label="Media en marcha"
            value={formatNumber(toDisplaySpeed(shown.avgMovingKmh, unit))}
            unit={unitLabel}
            icon="car-outline"
          />
          <StatTile
            label="Detenido"
            value={formatDuration(shown.stoppedMs)}
            icon="hourglass-outline"
            tint={colors.textMuted}
          />
        </StatGrid>

        {/* ---------------- altimetría ---------------- */}
        <SectionTitle>Altitud y desnivel</SectionTitle>
        <GlassCard>
          <View style={styles.altRow}>
            <View style={styles.altMain}>
              <Text style={styles.altValue}>
                {live.altitude != null ? formatNumber(live.altitude) : '—'}
                <Text style={styles.altUnit}> m s. n. m.</Text>
              </Text>
              <View style={styles.gradeRow}>
                <Ionicons
                  name={grade > 0.8 ? 'trending-up' : grade < -0.8 ? 'trending-down' : 'remove'}
                  size={16}
                  color={gradeColor(grade)}
                />
                <Text style={[styles.gradeValue, { color: gradeColor(grade) }]}>
                  {grade >= 0 ? '+' : ''}
                  {grade.toFixed(1)} %
                </Text>
                <Text style={styles.gradeLabel}>{gradeLabel}</Text>
              </View>
            </View>
            <View style={styles.altSide}>
              <View style={styles.altSideRow}>
                <Ionicons name="arrow-up" size={13} color={colors.ascent} />
                <Text style={[styles.altSideValue, { color: colors.ascent }]}>
                  {formatNumber(shown.elevGain)} m
                </Text>
              </View>
              <View style={styles.altSideRow}>
                <Ionicons name="arrow-down" size={13} color={colors.descent} />
                <Text style={[styles.altSideValue, { color: colors.descent }]}>
                  {formatNumber(shown.elevLoss)} m
                </Text>
              </View>
              <Text style={styles.altSideHint}>
                {shown.minAlt != null && shown.maxAlt != null
                  ? `${formatNumber(shown.minAlt)} – ${formatNumber(shown.maxAlt)} m`
                  : 'sin rango'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* ---------------- prestaciones ---------------- */}
        <SectionTitle right={<Badge label="AUTOMÁTICO" tint={colors.lime} />}>
          Prestaciones de la sesión
        </SectionTitle>
        <StatGrid>
          <StatTile
            label="0 → 100 km/h"
            value={formatAccel(live.perf.t0_100)}
            icon="rocket-outline"
            tint={live.perf.t0_100 != null ? colors.lime : colors.textFaint}
            compact
          />
          <StatTile
            label="0 → 60 km/h"
            value={formatAccel(live.perf.t0_60)}
            icon="rocket-outline"
            compact
          />
          <StatTile
            label="100 → 0 frenada"
            value={formatAccel(live.perf.t100_0)}
            icon="stop-circle-outline"
            tint={live.perf.t100_0 != null ? colors.danger : colors.textFaint}
            compact
          />
          <StatTile
            label="402 m (¼ milla)"
            value={formatAccel(live.perf.t402m)}
            icon="flag-outline"
            compact
          />
          <StatTile
            label="Vel. en meta"
            value={
              live.perf.vTrap != null
                ? `${formatNumber(toDisplaySpeed(live.perf.vTrap, unit))} ${unitLabel}`
                : '—'
            }
            icon="speedometer-outline"
            compact
          />
          <StatTile
            label="Fábrica 0-100"
            value={`${vehicle.accel0100Factory.toFixed(1).replace('.', ',')} s`}
            icon="document-text-outline"
            tint={colors.textMuted}
            compact
          />
        </StatGrid>
        <Text style={styles.footnote}>
          Los tiempos se detectan solos cuando arrancas desde parado. Medidos por GPS: sirven para
          comparar pasadas entre sí, no son cifras de banco de pruebas.
        </Text>

        {/* ---------------- dinámica ---------------- */}
        <SectionTitle>Dinámica</SectionTitle>
        <StatGrid>
          <StatTile
            label="Aceleración"
            value={`${live.gForce >= 0 ? '+' : ''}${live.gForce.toFixed(2)} g`}
            icon="speedometer-outline"
            tint={live.gForce > 0.05 ? colors.lime : live.gForce < -0.05 ? colors.danger : colors.text}
            compact
          />
          <StatTile
            label="Rumbo"
            value={live.heading != null ? `${Math.round(live.heading)}° ${cardinal(live.heading)}` : '—'}
            icon="compass-outline"
            compact
          />
          <StatTile
            label="Combustible est."
            value={`${shown.fuelL.toFixed(2)} L`}
            icon="water-outline"
            tint={colors.amber}
            compact
          />
        </StatGrid>

        <Pressable onPress={() => router.push('/garage')} style={styles.vehicleChip}>
          <Ionicons name="car-sport" size={16} color={colors.accent} />
          <Text style={styles.vehicleChipText}>
            {vehicle.make} {vehicle.model} {vehicle.year} · {vehicle.trim}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center' },
  alertGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 2 },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statusDim: { fontSize: 10, color: colors.textFaint, fontFamily: mono },

  gaugeWrap: { alignItems: 'center', marginVertical: spacing.sm },

  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.dangerDim,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  limitText: { color: colors.danger, fontSize: 12, fontWeight: '700' },

  controls: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  altRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  altMain: { flex: 1 },
  altValue: { ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
  altUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  gradeValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gradeLabel: { fontSize: 10, color: colors.textFaint, fontWeight: '800', letterSpacing: 1 },
  altSide: { alignItems: 'flex-end', gap: 4 },
  altSideRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  altSideValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  altSideHint: { fontSize: 10, color: colors.textFaint, fontFamily: mono, marginTop: 2 },

  footnote: {
    fontSize: 11,
    color: colors.textFaint,
    lineHeight: 16,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  vehicleChipText: { flex: 1, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
