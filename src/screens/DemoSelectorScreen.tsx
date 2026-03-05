import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DemoSelectorScreenProps {
  navigation: any;
}

export const DemoSelectorScreen: React.FC<DemoSelectorScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PLATFORM DEMOS</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Tap a vertical to explore the platform
        </Text>

        <View style={styles.cardsRow}>
          {/* School Guard Card */}
          <TouchableOpacity
            style={[styles.card, { borderColor: '#1B3A5C' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DemoSchool Guard')}
          >
            <Image
              source={require('../../assets/schoolguard_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.cardTitle, { color: '#1B3A5C' }]}>School Guard</Text>
            <Text style={styles.cardSubtitle}>K-12 & Campus Security</Text>
            <View style={[styles.enterButton, { backgroundColor: '#1B3A5C' }]}>
              <Text style={styles.enterButtonText}>ENTER DEMO</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Company Guard Card */}
          <TouchableOpacity
            style={[styles.card, { borderColor: '#2D3748' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DemoCompany Guard')}
          >
            <Image
              source={require('../../assets/companyguard_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.cardTitle, { color: '#2D3748' }]}>Company Guard</Text>
            <Text style={styles.cardSubtitle}>Corporate & Enterprise Security</Text>
            <View style={[styles.enterButton, { backgroundColor: '#2D3748' }]}>
              <Text style={styles.enterButtonText}>ENTER DEMO</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8888AA',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  enterButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginRight: 4,
  },
});
