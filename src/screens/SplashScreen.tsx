import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { theme } from '../theme';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Fade out and finish after 4 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 3500); // 4 seconds total (3.5s show + 0.5s fade out)

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* HolyGuard Logo */}
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        {/* HolyGuard Title */}
        <Text style={styles.appName}>HOLYGUARD</Text>
        <Text style={styles.tagline}>Security Network</Text>

        {/* Sponsor Section */}
        <View style={styles.sponsorSection}>
          <Text style={styles.presentedBy}>Presented by</Text>
          {/* 
            TODO: Replace with actual sponsor logo 
            For now showing placeholder text
          */}
          <View style={styles.sponsorLogoPlaceholder}>
            <Text style={styles.sponsorName}>YOUR SPONSOR</Text>
            <Text style={styles.sponsorTagline}>Tagline goes here</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Dark background
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#c0392b',
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 80,
  },
  sponsorSection: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  presentedBy: {
    fontSize: 14,
    color: '#999',
    fontWeight: '400',
    marginBottom: 15,
    letterSpacing: 1,
  },
  sponsorLogoPlaceholder: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  sponsorName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  sponsorTagline: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    letterSpacing: 1,
  },
});
