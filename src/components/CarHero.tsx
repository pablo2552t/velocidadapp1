import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { CarSpinner } from '@/components/CarSpinner';
import { colors, font, radius, spacing } from '@/theme/theme';
import { Vehicle } from '@/vehicles/polo';

function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

type Props = {
  vehicle: Vehicle;
  frames: string[];
  driverName?: string;
  onPressOptions?: () => void;
};

function CarHeroBase({ vehicle, frames, driverName, onPressOptions }: Props) {
  const saludo = driverName ? `${greeting()}, ${driverName}` : greeting();

  return (
    <LinearGradient
      colors={['#141C28', '#0A1018', '#06090E']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{saludo}</Text>
          <Text style={styles.model} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {vehicle.model}
          </Text>
          <Text style={styles.trim} numberOfLines={1}>
            {vehicle.trim} · {vehicle.powerCv} CV
          </Text>
        </View>
        {onPressOptions && (
          <Pressable
            onPress={onPressOptions}
            hitSlop={10}
            style={({ pressed }) => [styles.optionsButton, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Fotos del carro"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.stage}>
        {/* Resplandor del piso: da la sensación de que el carro flota sobre la tarjeta */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="floorGlow" cx="50%" cy="72%" rx="52%" ry="34%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0.34" />
              <Stop offset="0.6" stopColor={colors.accent} stopOpacity="0.10" />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="72%" rx="52%" ry="34%" fill="url(#floorGlow)" />
        </Svg>

        <CarSpinner frames={frames} height={190} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.xl },
  greeting: { fontSize: 13, color: colors.accent, fontWeight: '600', letterSpacing: 0.2 },
  model: {
    ...font.title,
    fontSize: 38,
    lineHeight: 42,
    color: colors.text,
    letterSpacing: -1.2,
    marginTop: 2,
  },
  trim: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 3 },
  optionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { marginTop: spacing.md, height: 190 },
});

export const CarHero = memo(CarHeroBase);
