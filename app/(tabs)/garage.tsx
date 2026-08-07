import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { SpeedUnit, formatNumber } from '@/utils/format';
import { kmhPer1000Rpm, powerToWeight, rollingCircumferenceM } from '@/vehicles/polo';

const TAB_BAR_SPACE = 78;

export default function GarageScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update, updateVehicle, reset } = useSettings();
  const { resetSession, permission, requestPermission } = useTracking();
  const [showRatios, setShowRatios] = useState(false);

  const v = settings.vehicle;

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
      <LinearGradient
        colors={['rgba(34,211,238,0.16)', 'rgba(34,211,238,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroNickname}>{v.nickname}</Text>
            <Text style={styles.heroModel}>
              {v.make} {v.model} · {v.year}
            </Text>
          </View>
          <Ionicons name="car-sport" size={34} color={colors.accent} />
        </View>

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
          <Badge label={v.trim.toUpperCase()} />
          <Badge label={`${powerToWeight(v).toFixed(1)} KG/CV`} tint={colors.lime} />
          <Badge label={`${v.consumptionMixed} L/100 KM`} tint={colors.amber} />
        </View>
      </LinearGradient>

      {/* ------------------- ficha técnica ------------------- */}
      <SectionTitle>Ficha técnica</SectionTitle>
      <GlassCard padded={false}>
        <SpecRow label="Motor" value={`${v.engine} · ${v.cylinders} cil. ${v.valves}v`} />
        <Divider />
        <SpecRow label="Alimentación" value={v.aspiration} />
        <Divider />
        <SpecRow label="Potencia" value={`${v.powerCv} CV (${v.powerHp} hp) @ ${formatNumber(v.powerRpm)} rpm`} />
        <Divider />
        <SpecRow label="Par máximo" value={`${v.torqueNm} Nm @ ${formatNumber(v.torqueRpm)} rpm`} />
        <Divider />
        <SpecRow label="Transmisión" value={`${v.transmission} de ${v.gearCount} velocidades`} />
        <Divider />
        <SpecRow label="Tracción" value={v.drivetrain} />
        <Divider />
        <SpecRow
          label="0-100 km/h"
          value={`${v.accel0100Factory.toFixed(1).replace('.', ',')} s fábrica · ${v.accel0100Tested
            .toFixed(1)
            .replace('.', ',')} s medido`}
        />
        <Divider />
        <SpecRow label="Velocidad máxima" value={`${v.topSpeedKmh} km/h`} />
        <Divider />
        <SpecRow label="Peso en orden de marcha" value={`${formatNumber(v.curbWeightKg)} kg`} />
        <Divider />
        <SpecRow label="Relación peso/potencia" value={`${powerToWeight(v).toFixed(1)} kg/CV`} />
        <Divider />
        <SpecRow label="Tanque" value={`${v.fuelTankL} L`} />
        <Divider />
        <SpecRow
          label="Consumo"
          value={`${v.consumptionCity} ciudad · ${v.consumptionHwy} ruta · ${v.consumptionMixed} mixto L/100 km`}
        />
        <Divider />
        <SpecRow
          label="Dimensiones"
          value={`${formatNumber(v.lengthMm)} × ${formatNumber(v.widthMm)} × ${formatNumber(
            v.heightMm
          )} mm`}
        />
        <Divider />
        <SpecRow label="Distancia entre ejes" value={`${formatNumber(v.wheelbaseMm)} mm`} />
        <Divider />
        <SpecRow label="Baúl" value={`${v.trunkL} L`} />
        <Divider />
        <SpecRow
          label="Llantas"
          value={`${v.tire.widthMm}/${v.tire.aspect} R${v.tire.rimIn} · ${rollingCircumferenceM(v).toFixed(
            2
          )} m de rodadura`}
        />
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

  heroCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.28)',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroNickname: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  heroModel: { fontSize: 13, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  heroSpecs: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSpec: { alignItems: 'flex-start' },
  heroSpecValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  heroSpecUnit: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  heroSpecLabel: { fontSize: 9, color: colors.textFaint, fontWeight: '800', letterSpacing: 0.7, marginTop: 2 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

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
