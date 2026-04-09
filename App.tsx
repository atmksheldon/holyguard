import React, { useEffect } from 'react';
console.log('[App] JS Bundle is executing!');
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Purchases from 'react-native-purchases';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { REVENUECAT_API_KEY } from './src/config/keys';
import { logger } from './src/utils/logger';

export default function App() {
  useEffect(() => {
    const initRC = async () => {
      try {
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        logger.log('RevenueCat configured');
      } catch (error) {
        logger.error('RevenueCat config error:', error);
      }
    };
    initRC();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
