import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// El import registra la tarea de segundo plano en el arranque (requisito de
// expo-task-manager: `defineTask` debe ejecutarse antes de que iOS la invoque).
import '@/services/backgroundLocation';

import { SettingsProvider } from '@/state/SettingsContext';
import { TrackingProvider } from '@/state/TrackingContext';
import { colors } from '@/theme/theme';

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <TrackingProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="trip/[id]"
                options={{ presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="car-photos"
                options={{ presentation: 'card', animation: 'slide_from_right' }}
              />
            </Stack>
          </TrackingProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
