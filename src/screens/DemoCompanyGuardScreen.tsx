import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// CompanyGuard Theme
const CG = {
  primary: '#2D3748',
  accent: '#0D9488',
  background: '#F1F5F9',
  surface: '#FFFFFF',
  danger: '#B22222',
};

const MOCK_ALERTS = [
  {
    id: '1',
    title: 'Unauthorized Access',
    location: 'Server Room',
    time: '5m ago',
    level: 'red' as const,
    category: 'Unauthorized Access',
    icon: 'server-security' as const,
  },
  {
    id: '2',
    title: 'Tailgating Detected',
    location: 'Lobby Entrance',
    time: '20m ago',
    level: 'yellow' as const,
    category: 'Badge Violation',
    icon: 'account-multiple-check' as const,
  },
  {
    id: '3',
    title: 'Badge Not Scanned',
    location: 'Parking Garage B2',
    time: '45m ago',
    level: 'yellow' as const,
    category: 'Badge Violation',
    icon: 'card-account-details-outline' as const,
  },
  {
    id: '4',
    title: 'Workplace Threat',
    location: '3rd Floor',
    time: '1h ago',
    level: 'red' as const,
    category: 'Workplace Violence',
    icon: 'alert-octagon' as const,
  },
];

const MOCK_VISITORS = [
  { name: 'Sarah Chen', destination: 'Meeting Rm 4A', status: 'Checked In', time: '9:15 AM' },
  { name: 'Mike Torres', destination: 'IT Dept', status: 'Checked In', time: '10:30 AM' },
  { name: 'Jennifer Wu', destination: 'Executive Suite', status: 'Checked Out', time: '11:00 AM' },
];

interface DemoCompanyGuardScreenProps {
  navigation: any;
}

export const DemoCompanyGuardScreen: React.FC<DemoCompanyGuardScreenProps> = ({ navigation }) => {
  const handleReport = () => {
    Alert.alert(
      'Report Incident',
      'This would open the incident capture camera with corporate-specific categories:\n\n• Unauthorized Access\n• Workplace Violence\n• Data Breach\n• Evacuation\n• Badge Violation\n\n(This is a demo)',
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
            <MaterialCommunityIcons name="office-building" size={22} color={CG.accent} />
            <Text style={styles.headerTitle}>COMPANY GUARD</Text>
          </View>
          <Text style={styles.orgName}>Acme Corp HQ</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>SECURITY</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Report Incident Button */}
        <TouchableOpacity style={styles.reportButton} activeOpacity={0.8} onPress={handleReport}>
          <MaterialCommunityIcons name="camera-wireless" size={28} color="#FFFFFF" />
          <Text style={styles.reportText}>REPORT INCIDENT</Text>
          <Text style={styles.reportSubtext}>Tap to capture and report</Text>
        </TouchableOpacity>

        {/* Facility Alerts */}
        <View style={styles.feedContainer}>
          <Text style={styles.sectionTitle}>FACILITY ALERTS</Text>

          {MOCK_ALERTS.map((alert) => (
            <View
              key={alert.id}
              style={[
                styles.alertCard,
                {
                  borderLeftColor: alert.level === 'red' ? CG.danger : CG.primary,
                },
              ]}
            >
              <View style={styles.alertHeader}>
                <View style={styles.alertTitleRow}>
                  <MaterialCommunityIcons
                    name={alert.icon}
                    size={20}
                    color={alert.level === 'red' ? CG.danger : CG.primary}
                  />
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                </View>
                <View
                  style={[
                    styles.levelBadge,
                    {
                      backgroundColor: alert.level === 'red' ? CG.danger : '#F59E0B',
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

          {/* Visitor Log */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>VISITOR LOG</Text>
          <View style={styles.visitorTable}>
            {/* Table Header */}
            <View style={styles.visitorHeaderRow}>
              <Text style={[styles.visitorHeaderCell, { flex: 1.2 }]}>Visitor</Text>
              <Text style={[styles.visitorHeaderCell, { flex: 1.2 }]}>Destination</Text>
              <Text style={[styles.visitorHeaderCell, { flex: 1 }]}>Status</Text>
            </View>
            {/* Table Rows */}
            {MOCK_VISITORS.map((visitor, index) => (
              <View
                key={index}
                style={[
                  styles.visitorRow,
                  index === MOCK_VISITORS.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.visitorName}>{visitor.name}</Text>
                </View>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.visitorDest}>{visitor.destination}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.visitorStatusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            visitor.status === 'Checked In' ? CG.accent : '#94A3B8',
                        },
                      ]}
                    />
                    <Text style={styles.visitorStatus}>
                      {visitor.status} {visitor.time}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CG.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CG.primary,
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
    color: CG.accent,
    marginTop: 2,
    fontWeight: '600',
  },
  roleBadge: {
    backgroundColor: CG.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  reportButton: {
    backgroundColor: CG.accent,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: CG.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  reportText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 6,
  },
  reportSubtext: {
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
    color: CG.primary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  alertCard: {
    backgroundColor: CG.surface,
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
    color: CG.primary,
    fontWeight: '600',
    backgroundColor: CG.background,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Visitor Log styles
  visitorTable: {
    backgroundColor: CG.surface,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  visitorHeaderRow: {
    flexDirection: 'row',
    backgroundColor: CG.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  visitorHeaderCell: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  visitorRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  visitorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  visitorDest: {
    fontSize: 13,
    color: '#666',
  },
  visitorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  visitorStatus: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
});
