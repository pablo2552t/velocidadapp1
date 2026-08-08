import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarHero } from '@/components/CarHero';
import { CarPhotos, NO_PHOTOS, loadCarPhotos } from '@/services/carPhotos';

import {
  Badge,
  Divider,
  GlassCard,
  NumberRow,
  Row,
  SectionTitle,
  Segmented,
  TextRow,
  ToggleRow,
} from '@/components/ui';
import { deleteAllTrips } from '@/services/database';
import { useSettings } from '@/state/SettingsContext';
import { useTracking } from '@/state/TrackingContext';
import { colors, font, mono, radius, spacing } from '@/theme/theme';
import { REFERENCE_ALTITUDES, altitudeEffect } from '@/utils/altitude';
import { SpeedUnit, formatNumber } from '@/utils/format';
import {
  kmhPer1000Rpm,
  powerToWeight,
  rollingCircumferenceM,
  specificPower,
  strokeToBore,
} from '@/vehicles/polo';

const TAB_BAR_SPACE = 78;

export default function GarageScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update, updateVehicle, reset } = useSettings();
  const { resetSession, permission, requestPermission, live } = useTracking();
  const [showRatios, setShowRatios] = useState(false);

  const router = useRouter();
  const [photos, setPhotos] = useState<CarPhotos>(NO_PHOTOS);

  // Al volver de la pantalla de fotos la tarjeta debe reflejar el cambio.
  useFocusEffect(
    useCallback(() => {
      loadCarPhotos().then(setPhotos).catch(() => {});
    }, [])
  );

  const v = settings.vehicle;

  const effect = useMemo(() => {
    if (live.altitude == null) return null;
    return altitudeEffect(v, Math.round(live.altitude / 50) * 50);
  }, [v, live.altitude]);

  const confirmClearHistory = () => {
    Alert.alert('Borrar historial', 'Se eliminarán todos los viajes guardados. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: () => {
          deleteAllTrips().catch(() => {});
        },
      },
    ]);
  };

  const confirmReset = () => {
    Alert.alert('Restaurar valores', '¿Volver a la configuración y ficha originales del Polo Track?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + TAB_BAR_SPACE,
        paddingHorizontal: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>Garaje</Text>

      {/* ------------------- tarjeta del vehículo ------------------- */}
      <CarHero
        vehicle={v}
        frames={photos.frames}
        driverName={settings.driverName}
        onPressOptions={() => router.push('/car-photos')}
      />

      <View style={styles.heroSpecsCard}>
        <View style={styles.heroSpecs}>
          <HeroSpec value={`${v.powerCv}`} unit="CV" label="Potencia" />
          <HeroSpec value={`${v.torqueNm}`} unit="Nm" label="Par" />
          <HeroSpec value={`${v.topSpeedKmh}`} unit="km/h" label="Vel. máx" />
          <HeroSpec
            value={v.accel0100Factory.toFixed(1).replace('.', ',')}
            unit="s"
            label="0-100"
          />
        </View>
        <View style={styles.heroBadges}>
          <Badge label={v.nickname.toUpperCase()} />
          <Badge label={`${powerToWeight(v).toFixed(1)} KG/CV`} tint={colors.lime} />
          <Badge label={`${v.consumptionMixed} L/100 KM`} tint={colors.amber} />
        </View>
      </View>

      <Pressable onPress={() => router.push('/car-photos')} style={styles.photosChip}>
        <Ionicons name="camera-outline" size={16} color={colors.accent} />
        <Text style={styles.photosChipText}>
          {photos.frames.length === 0
            ? 'Pon fotos de tu Polo y gíralo en 360°'
            : `${photos.frames.length} fotos · toca para cambiarlas`}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
      </Pressable>

      {/* ------------------- potencia real a la altitud actual ------------------- */}
      {effect && (
        <>
          <SectionTitle right={<Badge label="AQUÍ Y AHORA" tint={colors.amber} />}>
            Potencia disponible
          </SectionTitle>
          <GlassCard>
            <View style={styles.altRow}>
              <View>
                <Text style={styles.altPower}>
                  {Math.round(effect.powerCv)}
                  <Text style={styles.altPowerUnit}> CV</Text>
                </Text>
                <Text style={styles.altPowerSub}>
                  {Math.round(effect.torqueNm)} Nm · {effect.weightPerPowerKg.toFixed(1)} kg/CV
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.altLoss}>−{effect.lossPct.toFixed(0)} %</Text>
                <Text style={styles.altHint}>{Math.round(effect.altitudeM)} m sobre el mar</Text>
              </View>
            </View>
            <Text style={styles.altNote}>
              Un motor atmosférico entrega lo que le permita el aire que respira. Estas son las
              cifras corregidas por la norma SAE J1349 para la altitud a la que estás ahora mismo.
            </Text>
          </GlassCard>

          <SectionTitle>Cómo cambia según dónde estés</SectionTitle>
          <GlassCard padded={false}>
            {REFERENCE_ALTITUDES.map((ref, i) => {
              const e = altitudeEffect(v, ref.altitudeM);
              const aqui = Math.abs(ref.altitudeM - effect.altitudeM) < 250;
              return (
                <View key={ref.label}>
                  {i > 0 && <Divider />}
                  <View style={styles.refRow}>
                    <Text style={[styles.refLabel, aqui && { color: colors.accent }]}>
                      {ref.label}
                    </Text>
                    <Text style={styles.refAlt}>{formatNumber(ref.altitudeM)} m</Text>
                    <View style={styles.refBarTrack}>
                      <View
                        style={[
                          styles.refBarFill,
                          {
                            width: `${(1 / e.factor) * 100}%`,
                            backgroundColor: aqui ? colors.accent : colors.textFaint,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.refCv, aqui && { color: colors.accent }]}>
                      {Math.round(e.powerCv)} CV
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {/* ------------------- ficha técnica ------------------- */}
      <SectionTitle>Motor</SectionTitle>
      <GlassCard padded={false}>
        <SpecRow label="Denominación" value={v.engine} />
        <Divider />
        <SpecRow label="Familia" value={`${v.engineFamily} · ${v.layout.toLowerCase()}`} />
        <Divider />
        <SpecRow
          label="Cilindrada"
          value={`${formatNumber(v.displacementCc)} cc · ${v.cylinders} cilindros`}
        />
        <Divider />
        <SpecRow label="Diámetro × carrera" value={`${v.boreMm} × ${v.strokeMm} mm`} />
        <Divider />
        <SpecRow
          label="Carrera / diámetro"
          value={`${strokeToBore(v).toFixed(2)} — de carrera larga, empuja abajo`}
        />
        <Divider />
        <SpecRow label="Distribución" value={`${v.valvetrain} · ${v.valves} válvulas`} />
        <Divider />
        <SpecRow label="Alimentación" value={`${v.aspiration} · ${v.injection}`} />
        <Divider />
        <SpecRow label="Combustible" value={v.fuel} />
        <Divider />
        <SpecRow
          label="Potencia"
          value={`${v.powerCv} CV (${v.powerHp} hp) @ ${formatNumber(v.powerRpm)} rpm`}
        />
        <Divider />
        <SpecRow
          label="Par máximo"
          value={`${v.torqueNm} Nm @ ${formatNumber(v.torqueRpm)}–${formatNumber(v.torqueRpmTo)} rpm`}
        />
        <Divider />
        <SpecRow label="Potencia específica" value={`${specificPower(v).toFixed(1)} CV/litro`} />
      </GlassCard>

      <SectionTitle>Transmisión y prestaciones</SectionTitle>
      <GlassCard padded={false}>
        <SpecRow label="Caja" value={`${v.transmission} de ${v.gearCount} velocidades`} />
        <Divider />
        <SpecRow label="Tracción" value={v.drivetrain} />
        <Divider />
        <SpecRow
          label="0-100 km/h"
          value={`${v.accel0100Factory.toFixed(1).replace('.', ',')} s fábrica · ${v.accel0100Tested
            .toFixed(1)
            .replace('.', ',')} s medido en prueba`}
        />
        <Divider />
        <SpecRow label="Velocidad máxima" value={`${v.topSpeedKmh} km/h`} />
        <Divider />
        <SpecRow label="Relación peso/potencia" value={`${powerToWeight(v).toFixed(1)} kg/CV`} />
        <Divider />
        <SpecRow
          label="Velocidad en 5ª"
          value={`${kmhPer1000Rpm(v, v.ratios.gears.length - 1).toFixed(1)} km/h por 1.000 rpm (aprox.)`}
        />
      </GlassCard>

      <SectionTitle>Chasis, frenos y dirección</SectionTitle>
      <GlassCard padded={false}>
        <SpecRow label="Suspensión delantera" value={v.suspensionFront} />
        <Divider />
        <SpecRow label="Suspensión trasera" value={v.suspensionRear} />
        <Divider />
        <SpecRow label="Frenos delanteros" value={v.brakesFront} />
        <Divider />
        <SpecRow label="Frenos traseros" value={v.brakesRear} />
        <Divider />
        <SpecRow label="Dirección" value={v.steering} />
        <Divider />
        <SpecRow
          label="Llantas"
          value={`${v.tire.widthMm}/${v.tire.aspect} R${v.tire.rimIn} · ${rollingCircumferenceM(v).toFixed(
            2
          )} m de rodadura`}
        />
        <Divider />
        <SpecRow
          label="Presión de inflado"
          value={`${v.tirePressureFrontBar.toFixed(1)} / ${v.tirePressureRearBar.toFixed(
            1
          )} bar — confirma en el pilar de la puerta`}
        />
      </GlassCard>

      <SectionTitle>Seguridad</SectionTitle>
      <GlassCard padded={false}>
        <SpecRow label="Airbags" value={`${v.airbags}`} />
        <Divider />
        {v.assists.map((a, i) => (
          <View key={a}>
            {i > 0 && <Divider />}
            <View style={styles.assistRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.lime} />
              <Text style={styles.assistText}>{a}</Text>
            </View>
          </View>
        ))}
      </GlassCard>

      <SectionTitle>Carrocería y capacidades</SectionTitle>
      <GlassCard padded={false}>
        <SpecRow
          label="Dimensiones"
          value={`${formatNumber(v.lengthMm)} × ${formatNumber(v.widthMm)} × ${formatNumber(
            v.heightMm
          )} mm`}
        />
        <Divider />
        <SpecRow label="Distancia entre ejes" value={`${formatNumber(v.wheelbaseMm)} mm`} />
        <Divider />
        <SpecRow label="Peso en orden de marcha" value={`${formatNumber(v.curbWeightKg)} kg`} />
        <Divider />
        <SpecRow label="Baúl" value={`${v.trunkL} litros`} />
        <Divider />
        <SpecRow label="Tanque" value={`${v.fuelTankL} litros`} />
        <Divider />
        <SpecRow
          label="Consumo"
          value={`${v.consumptionCity} ciudad · ${v.consumptionHwy} ruta · ${v.consumptionMixed} mixto L/100 km`}
        />
        <Divider />
        <SpecRow
          label="Autonomía teórica"
          value={`${Math.round((v.fuelTankL / v.consumptionMixed) * 100)} km con el tanque lleno`}
        />
        <Divider />
        <SpecRow label="Intervalo de servicio" value={`cada ${formatNumber(v.serviceIntervalKm)} km`} />
      </GlassCard>
      <Text style={styles.footnote}>
        Cifras del Polo Track 1.6 MSI para Sudamérica según Volkswagen y pruebas de prensa
        independiente. Puedes ajustarlas abajo si tu unidad difiere.
      </Text>

      {/* ------------------- personalizar ------------------- */}
      <SectionTitle>Personalizar el vehículo</SectionTitle>
      <GlassCard padded={false}>
        <TextRow
          label="Apodo"
          icon="pricetag-outline"
          value={v.nickname}
          onChange={(nickname) => updateVehicle({ nickname })}
          placeholder="Mi Polo"
        />
        <Divider />
        <TextRow
          label="Tu nombre"
          icon="person-outline"
          value={settings.driverName}
          onChange={(driverName) => update({ driverName })}
          placeholder="Para el saludo"
        />
        <Divider />
        <Row
          label="Fotos del carro"
          hint={
            photos.frames.length === 0
              ? 'Sin fotos: se muestra la ilustración'
              : `${photos.frames.length} fotos guardadas`
          }
          icon="camera-outline"
          onPress={() => router.push('/car-photos')}
        />
        <Divider />
        <NumberRow
          label="Consumo mixto"
          hint="Base del cálculo de combustible y costo"
          icon="water-outline"
          value={v.consumptionMixed}
          onChange={(consumptionMixed) => updateVehicle({ consumptionMixed })}
          suffix="L/100"
          step={0.1}
          decimals={2}
          min={1}
          max={30}
        />
        <Divider />
        <NumberRow
          label="Velocidad máxima"
          hint="Define la escala del velocímetro"
          icon="speedometer-outline"
          value={v.topSpeedKmh}
          onChange={(topSpeedKmh) => updateVehicle({ topSpeedKmh })}
          suffix="km/h"
          step={5}
          min={60}
          max={400}
        />
        <Divider />
        <NumberRow
          label="Corte de inyección"
          icon="pulse-outline"
          value={v.redlineRpm}
          onChange={(redlineRpm) => updateVehicle({ redlineRpm })}
          suffix="rpm"
          step={100}
          min={3000}
          max={10000}
        />
        <Divider />
        <NumberRow
          label="Tanque"
          icon="beaker-outline"
          value={v.fuelTankL}
          onChange={(fuelTankL) => updateVehicle({ fuelTankL })}
          suffix="L"
          step={1}
          min={10}
          max={200}
        />
        <Divider />
        <Row
          label="Relaciones de caja"
          hint="Aproximadas: solo afectan al tacómetro estimado"
          icon="git-compare-outline"
          onPress={() => setShowRatios((s) => !s)}
          right={
            <Ionicons
              name={showRatios ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textFaint}
            />
          }
        />
        {showRatios && (
          <>
            {v.ratios.gears.map((ratio, i) => (
              <View key={i}>
                <Divider />
                <NumberRow
                  label={`${i + 1}ª marcha`}
                  hint={`${kmhPer1000Rpm(v, i).toFixed(1)} km/h por 1.000 rpm`}
                  value={ratio}
                  onChange={(next) => {
                    const gears = [...v.ratios.gears];
                    gears[i] = next;
                    updateVehicle({ ratios: { ...v.ratios, gears } });
                  }}
                  step={0.01}
                  decimals={2}
                  min={0.3}
                  max={6}
                />
              </View>
            ))}
            <Divider />
            <NumberRow
              label="Grupo final"
              value={v.ratios.final}
              onChange={(final) => updateVehicle({ ratios: { ...v.ratios, final } })}
              step={0.01}
              decimals={2}
              min={2}
              max={7}
            />
          </>
        )}
      </GlassCard>

      {/* ------------------- ajustes ------------------- */}
      <SectionTitle>Unidades</SectionTitle>
      <Segmented<SpeedUnit>
        options={[
          { value: 'kmh', label: 'km/h' },
          { value: 'mph', label: 'mph' },
        ]}
        value={settings.unit}
        onChange={(unit) => update({ unit })}
      />

      <SectionTitle>Alertas y conducción</SectionTitle>
      <GlassCard padded={false}>
        <ToggleRow
          label="Aviso de velocidad"
          hint="Vibración y aviso en pantalla al pasarte"
          icon="warning-outline"
          value={settings.speedAlertEnabled}
          onChange={(speedAlertEnabled) => update({ speedAlertEnabled })}
        />
        <Divider />
        <NumberRow
          label="Límite"
          icon="speedometer-outline"
          value={settings.speedLimit}
          onChange={(speedLimit) => update({ speedLimit })}
          suffix="km/h"
          step={5}
          min={10}
          max={300}
        />
        <Divider />
        <ToggleRow
          label="Vibración"
          icon="phone-portrait-outline"
          value={settings.hapticsEnabled}
          onChange={(hapticsEnabled) => update({ hapticsEnabled })}
        />
        <Divider />
        <ToggleRow
          label="Pantalla siempre encendida"
          hint="Mientras hay un viaje en curso"
          icon="sunny-outline"
          value={settings.keepAwake}
          onChange={(keepAwake) => update({ keepAwake })}
        />
        <Divider />
        <ToggleRow
          label="Pausa automática"
          hint="Deja de contar el tiempo cuando te detienes"
          icon="pause-circle-outline"
          value={settings.autoPause}
          onChange={(autoPause) => update({ autoPause })}
        />
        <Divider />
        <NumberRow
          label="Esperar antes de pausar"
          value={settings.autoPauseSeconds}
          onChange={(autoPauseSeconds) => update({ autoPauseSeconds })}
          suffix="s"
          step={15}
          min={15}
          max={600}
        />
        <Divider />
        <ToggleRow
          label="Mapa orientado al rumbo"
          hint="El mapa gira contigo al conducir"
          icon="compass-outline"
          value={settings.followHeading}
          onChange={(followHeading) => update({ followHeading })}
        />
      </GlassCard>

      <SectionTitle>Combustible</SectionTitle>
      <GlassCard padded={false}>
        <NumberRow
          label="Precio por galón"
          hint="Para estimar el costo de cada viaje"
          icon="cash-outline"
          value={settings.fuelPrice}
          onChange={(fuelPrice) => update({ fuelPrice })}
          suffix={settings.currency}
          step={0.05}
          decimals={2}
          min={0}
          max={100}
        />
        <Divider />
        <TextRow
          label="Símbolo de moneda"
          icon="pricetags-outline"
          value={settings.currency}
          onChange={(currency) => update({ currency })}
          placeholder="$"
        />
      </GlassCard>

      {/* ------------------- permisos y datos ------------------- */}
      <SectionTitle>Permisos</SectionTitle>
      <GlassCard padded={false}>
        <Row
          label="Ubicación"
          hint={
            permission === 'background'
              ? 'Siempre: el viaje sigue con la pantalla apagada'
              : permission === 'granted'
                ? 'Solo con la app abierta. Toca para pedir acceso permanente.'
                : 'Sin acceso al GPS'
          }
          icon="navigate-outline"
          onPress={permission === 'background' ? undefined : requestPermission}
          right={
            <Badge
              label={permission === 'background' ? 'SIEMPRE' : permission === 'granted' ? 'EN USO' : 'DENEGADO'}
              tint={
                permission === 'background'
                  ? colors.lime
                  : permission === 'granted'
                    ? colors.amber
                    : colors.danger
              }
            />
          }
        />
      </GlassCard>

      <SectionTitle>Datos</SectionTitle>
      <GlassCard padded={false}>
        <Row
          label="Reiniciar sesión actual"
          hint="Pone a cero máximas y tiempos de aceleración"
          icon="refresh-outline"
          onPress={resetSession}
        />
        <Divider />
        <Row label="Borrar historial" icon="trash-outline" danger onPress={confirmClearHistory} />
        <Divider />
        <Row
          label="Restaurar valores por defecto"
          icon="reload-outline"
          danger
          onPress={confirmReset}
        />
      </GlassCard>

      <Text style={styles.version}>Velocidad · uso personal</Text>
    </ScrollView>
  );
}

function HeroSpec({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.heroSpec}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text style={styles.heroSpecValue}>{value}</Text>
        <Text style={styles.heroSpecUnit}>{unit}</Text>
      </View>
      <Text style={styles.heroSpecLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenTitle: { ...font.title, fontSize: 30, color: colors.text, marginBottom: spacing.lg },

  heroSpecsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroSpecs: { flexDirection: 'row', justifyContent: 'space-between' },
  photosChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  photosChipText: { flex: 1, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  heroSpec: { alignItems: 'flex-start' },
  heroSpecValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  heroSpecUnit: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  heroSpecLabel: { fontSize: 9, color: colors.textFaint, fontWeight: '800', letterSpacing: 0.7, marginTop: 2 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  altRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  altPower: { ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
  altPowerUnit: { fontSize: 15, color: colors.textMuted, fontWeight: '700' },
  altPowerSub: { fontSize: 12, color: colors.textFaint, marginTop: 2, fontFamily: mono },
  altLoss: { fontSize: 22, fontWeight: '700', color: colors.amber, fontVariant: ['tabular-nums'] },
  altHint: { fontSize: 10, color: colors.textFaint, fontFamily: mono, marginTop: 3 },
  altNote: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing.md },

  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  refLabel: { fontSize: 12, color: colors.text, fontWeight: '600', width: 96 },
  refAlt: {
    fontSize: 10,
    color: colors.textFaint,
    fontFamily: mono,
    width: 52,
    textAlign: 'right',
  },
  refBarTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  refBarFill: { height: '100%', borderRadius: 3 },
  refCv: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: mono,
    width: 50,
    textAlign: 'right',
  },

  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  assistText: { fontSize: 13, color: colors.text },

  specRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  specLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600', flexShrink: 0 },
  specValue: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  footnote: {
    fontSize: 11,
    color: colors.textFaint,
    lineHeight: 16,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  version: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: mono,
    marginTop: spacing.xxl,
  },
});
