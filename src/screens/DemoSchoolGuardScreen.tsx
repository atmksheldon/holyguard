import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// SchoolGuard Theme
const SG = {
  primary: '#1B3A5C',
  accent: '#D4A843',
  background: '#E8EDF2',
  surface: '#FFFFFF',
  danger: '#B22222',
};

const MOCK_ALERTS = [
  {
    id: '1',
    title: 'Unauthorized Vehicle',
    location: 'Parking Lot B',
    time: '2m ago',
    level: 'red' as const,
    category: 'Suspicious Vehicle',
    icon: 'car-emergency' as const,
  },
  {
    id: '2',
    title: 'Unregistered Visitor',
    location: 'Main Office',
    time: '15m ago',
    level: 'yellow' as const,
    category: 'Unauthorized Visitor',
    icon: 'account-alert' as const,
  },
  {
    id: '3',
    title: 'Suspicious Activity',
    location: 'East Wing',
    time: '1h ago',
    level: 'yellow' as const,
    category: 'Suspicious Activity',
    icon: 'alert-circle' as const,
  },
  {
    id: '4',
    title: 'Medical Emergency',
    location: 'Gymnasium',
    time: '2h ago',
    level: 'red' as const,
    category: 'Medical Emergency',
    icon: 'medical-bag' as const,
  },
];

interface DemoSchoolGuardScreenProps {
  navigation: any;
}

export const DemoSchoolGuardScreen: React.FC<DemoSchoolGuardScreenProps> = ({ navigation }) => {
  const handleLockdown = () => {
    Alert.alert(
      '🔒 INITIATE LOCKDOWN',
      'This will send an immediate lockdown alert to all staff, lock all smart-enabled doors, and notify local law enforcement.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CONFIRM LOCKDOWN',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Lockdown Initiated', 'All campus zones have been notified. Doors are locking. Law enforcement has been alerted.\n\n(This is a demo)');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="school" size={22} color={SG.accent} />
            <Text style={styles.headerTitle}>SCHOOL GUARD</Text>
          </View>
          <Text style={styles.orgName}>Lincoln High School</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>ADMIN</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Lockdown Button */}
        <TouchableOpacity style={styles.lockdownButton} activeOpacity={0.8} onPress={handleLockdown}>
          <MaterialCommunityIcons name="lock-alert" size={32} color="#FFFFFF" />
          <Text style={styles.lockdownText}>INITIATE LOCKDOWN</Text>
          <Text style={styles.lockdownSubtext}>Tap to secure all campus zones</Text>
        </TouchableOpacity>

        {/* Campus Alerts */}
        <View style={styles.feedContainer}>
          <Text style={styles.sectionTitle}>CAMPUS ALERTS</Text>

          {MOCK_ALERTS.map((alert) => (
            <View
              key={alert.id}
              style={[
                styles.alertCard,
                {
                  borderLeftColor: alert.level === 'red' ? SG.danger : SG.accent,
                },
              ]}
            >
              <View style={styles.alertHeader}>
                <View style={styles.alertTitleRow}>
                  <MaterialCommunityIcons
                    name={alert.icon}
                    size={20}
                    color={alert.level === 'red' ? SG.danger : SG.accent}
                  />
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                </View>
                <View
                  style={[
                    styles.levelBadge,
                    {
                      backgroundColor: alert.level === 'red' ? SG.danger : '#F59E0B',
                    },
                  ]}
                >
                  <Text style={styles.levelBadgeText}>{alert.level.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.alertDetails}>
                <View style={styles.alertDetailRow}>
                  <MaterialCommunityIcons name="map-marker" size={14} color="#888" />
                  <Text style={styles.alertLocation}>{alert.location}</Text>
                </View>
                <Text style={styles.alertTime}>{alert.time}</Text>
              </View>
              <Text style={styles.alertCategory}>{alert.category}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SG.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SG.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  orgName: {
    fontSize: 12,
    color: SG.accent,
    marginTop: 2,
    fontWeight: '600',
  },
  roleBadge: {
    backgroundColor: SG.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: SG.primary,
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  lockdownButton: {
    backgroundColor: SG.danger,
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: SG.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  lockdownText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 8,
  },
  lockdownSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  feedContainer: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: SG.primary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  alertCard: {
    backgroundColor: SG.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  alertDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertLocation: {
    fontSize: 13,
    color: '#666',
  },
  alertTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  alertCategory: {
    fontSize: 11,
    color: SG.primary,
    fontWeight: '600',
    backgroundColor: SG.background,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
