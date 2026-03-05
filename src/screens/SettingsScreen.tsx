import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform, Image, Animated } from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../config/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, getDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../config/keys';

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Organization state
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgCoordinates, setOrgCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const placesRef = useRef<any>(null);

  // Demo mode state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoPassword, setDemoPassword] = useState('');
  const [demoError, setDemoError] = useState('');
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleTitleTap = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 500) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setShowDemoModal(true);
      setDemoPassword('');
      setDemoError('');
    }
  };

  const handleDemoSubmit = () => {
    if (demoPassword === 'HG#Platform2026!') {
      setShowDemoModal(false);
      setDemoPassword('');
      setDemoError('');
      navigation.navigate('DemoSelector');
    } else {
      setDemoError('Invalid code');
      setDemoPassword('');
      // Shake animation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  };

  // Load organization on mount
  useEffect(() => {
    loadOrganization();
  }, [user?.organizationId]);

  // Reset modal state when opening
  useEffect(() => {
    if (showOrgModal && currentOrg) {
      setOrgName(currentOrg.name || '');
      setOrgAddress(currentOrg.address || '');
      setOrgCoordinates(currentOrg.latitude && currentOrg.longitude ? {
        latitude: currentOrg.latitude,
        longitude: currentOrg.longitude,
      } : null);
    }
  }, [showOrgModal]);

  const loadOrganization = async () => {
    if (!user?.organizationId) return;
    
    try {
      // Try to get by document ID first
      let orgDoc = await getDoc(doc(db, 'organizations', user.organizationId));
      
      // If not found, try querying by id field
      if (!orgDoc.exists()) {
        const orgsQuery = query(
          collection(db, 'organizations'),
          where('id', '==', user.organizationId)
        );
        const snapshot = await getDocs(orgsQuery);
        if (!snapshot.empty) {
          orgDoc = snapshot.docs[0];
        }
      }
      
      if (orgDoc.exists()) {
        const orgData = orgDoc.data();
        setCurrentOrg({ id: orgDoc.id, ...orgData });
        setOrgName(orgData.name || '');
        setOrgAddress(orgData.address || '');
      }
    } catch (error) {
      logger.error('Error loading organization:', error);
    }
  };

  const handleUpdateOrganization = async () => {
    if (!orgName.trim()) {
      Alert.alert('Error', 'Please enter organization name');
      return;
    }
    
    if (!orgAddress || !orgCoordinates) {
      Alert.alert('Error', 'Please select an address from the dropdown');
      return;
    }
    
    setLoadingOrg(true);
    try {
      if (!currentOrg) throw new Error('Organization not found');
      
      const orgRef = doc(db, 'organizations', currentOrg.id);
      await updateDoc(orgRef, {
        name: orgName.trim(),
        address: orgAddress,
        latitude: orgCoordinates.latitude,
        longitude: orgCoordinates.longitude,
      });
      
      Alert.alert('Success', 'Organization updated successfully');
      setShowOrgModal(false);
      await loadOrganization(); // Reload
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update organization');
    } finally {
      setLoadingOrg(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Not authenticated');
      }

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      Alert.alert('Success', 'Password updated successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Error', 'New password is too weak');
      } else {
        Alert.alert('Error', error.message || 'Failed to update password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'This will permanently delete your account and all associated data. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete My Account',
          style: 'destructive',
          onPress: () => executeDeleteAccount(),
        },
      ]
    );
  };

  const executeDeleteAccount = async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !user) {
        throw new Error('Not authenticated');
      }

      const uid = currentUser.uid;

      // Cascade delete: remove all user-owned data across collections
      const collectionsToClean = [
        { name: 'alerts', field: 'reporterId' },
        { name: 'team_messages', field: 'senderId' },
        { name: 'watchlist', field: 'createdBy' },
        { name: 'resources', field: 'postedBy' },
        { name: 'direct_messages', field: 'senderId' },
        { name: 'invite_codes', field: 'createdBy' },
      ];

      for (const { name, field } of collectionsToClean) {
        const q = query(collection(db, name), where(field, '==', uid));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
        }
      }

      // Delete conversations where user is a participant
      const convsQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
      const convsSnap = await getDocs(convsQuery);
      for (const docSnap of convsSnap.docs) {
        await deleteDoc(docSnap.ref);
      }

      // Delete Firestore user document
      await deleteDoc(doc(db, 'users', uid));

      // Delete Firebase Auth account (must be last — after this, user loses access)
      await deleteUser(currentUser);

      Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Re-authentication Required',
          'For security reasons, please log out and log back in before deleting your account.'
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to delete account');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{user?.name || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{auth.currentUser?.email || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={[styles.infoValue, styles.roleBadge]}>
                {user?.role?.toUpperCase() || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY</Text>
          
          {!showChangePassword ? (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowChangePassword(true)}
            >
              <MaterialCommunityIcons name="lock-reset" size={24} color={theme.colors.primary} />
              <Text style={styles.settingsButtonText}>Change Password</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.gray} />
            </TouchableOpacity>
          ) : (
            <View style={styles.changePasswordCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Change Password</Text>
                <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={theme.colors.gray}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min 8 chars)"
                placeholderTextColor={theme.colors.gray}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.gray}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.updateButton, loading && styles.updateButtonDisabled]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.updateButtonText}>UPDATE PASSWORD</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            disabled={loading}
          >
            <MaterialCommunityIcons name="delete-forever" size={24} color={theme.colors.danger} />
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.deleteWarning}>
            This will permanently delete your account and all associated data. This action cannot be undone.
          </Text>
        </View>

        {/* Organization Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORGANIZATION</Text>
          {currentOrg ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{currentOrg.name || 'N/A'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                  {currentOrg.address || 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.updateOrgButton}
                onPress={() => setShowOrgModal(true)}
              >
                <MaterialCommunityIcons name="map-marker-edit" size={20} color={theme.colors.primary} />
                <Text style={styles.updateOrgButtonText}>Update Organization</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.aboutCard}>
            <TouchableOpacity activeOpacity={1} onPress={handleTitleTap}>
              <Text style={styles.appTitle}>HolyGuard</Text>
            </TouchableOpacity>
            <Text style={styles.appTagline}>Security Network Application</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            
            <View style={styles.sponsorSection}>
              <Text style={styles.sponsorLabel}>Sponsored By</Text>
              <View style={styles.sponsorLogosLarge}>
                <Image source={require('../../assets/uscca_logo.png')} style={styles.sponsorLogoLarge} resizeMode="contain" />
              </View>
              <Text style={styles.sponsorDescription}>
                Providing secure communication and alert systems for communities and organizations.
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <Text style={styles.copyrightText}>© 2026 HolyGuard. All rights reserved.</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Demo Access Modal */}
      <Modal
        visible={showDemoModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDemoModal(false)}
      >
        <View style={styles.demoOverlay}>
          <Animated.View style={[styles.demoModalBox, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.demoModalTitle}>Enter Access Code</Text>
            <TextInput
              style={styles.demoModalInput}
              value={demoPassword}
              onChangeText={(text) => {
                setDemoPassword(text);
                setDemoError('');
              }}
              placeholder="Access code"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoFocus
              onSubmitEditing={handleDemoSubmit}
            />
            {demoError !== '' && (
              <Text style={styles.demoErrorText}>{demoError}</Text>
            )}
            <View style={styles.demoModalButtons}>
              <TouchableOpacity
                style={styles.demoCancelButton}
                onPress={() => setShowDemoModal(false)}
              >
                <Text style={styles.demoCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoSubmitButton}
                onPress={handleDemoSubmit}
              >
                <Text style={styles.demoSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Organization Update Modal */}
      <Modal
        visible={showOrgModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowOrgModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowOrgModal(false)}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={28} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Update Organization</Text>
            <View style={{ width: 28 }} />
          </View>
          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >

          <ScrollView 
            style={styles.modalContent} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContentContainer}
          >
            <Text style={styles.modalLabel}>Organization Name</Text>
            <TextInput
              style={styles.modalInput}
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Enter organization name"
              placeholderTextColor="#999"
            />

            <Text style={[styles.modalLabel, { marginTop: 20 }]}>Organization Address</Text>
            <View style={styles.placesContainer}>
              <GooglePlacesAutocomplete
                ref={placesRef}
                placeholder="Search for address"
                onPress={(data, details = null) => {
                  if (details) {
                    setOrgAddress(data.description);
                    setOrgCoordinates({
                      latitude: details.geometry.location.lat,
                      longitude: details.geometry.location.lng,
                    });
                  }
                }}
                query={{
                  key: GOOGLE_PLACES_API_KEY,
                  language: 'en',
                }}
                fetchDetails={true}
                enablePoweredByContainer={false}
                textInputProps={{
                  placeholderTextColor: '#999',
                }}
                styles={{
                  container: {
                    flex: 0,
                    zIndex: 1000,
                  },
                  textInputContainer: {
                    backgroundColor: 'transparent',
                  },
                  textInput: {
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    paddingHorizontal: 15,
                    height: 50,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: '#ddd',
                  },
                  listView: {
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    marginTop: 4,
                    elevation: 3,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                  },
                  row: {
                    backgroundColor: '#fff',
                    padding: 13,
                    height: 60,
                  },
                  separator: {
                    height: 1,
                    backgroundColor: '#f0f0f0',
                  },
                }}
              />
            </View>

            {orgAddress && (
              <View style={styles.selectedAddressContainer}>
                <MaterialCommunityIcons name="map-marker" size={20} color={theme.colors.primary} />
                <Text style={styles.selectedAddressText}>{orgAddress}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalButton, (!orgName || !orgAddress || loadingOrg) && styles.modalButtonDisabled]}
              onPress={handleUpdateOrganization}
              disabled={!orgName || !orgAddress || loadingOrg}
            >
              {loadingOrg ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Update Organization</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.m,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    padding: theme.spacing.m,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  roleBadge: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceDark,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.m,
    borderRadius: 8,
    marginBottom: 8,
  },
  settingsButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginLeft: 12,
  },
  changePasswordCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    padding: theme.spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  updateButton: {
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  updateButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  updateButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.m,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.danger,
  },
  deleteButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.danger,
    marginLeft: 12,
  },
  deleteWarning: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: theme.colors.danger,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: theme.spacing.m,
    marginTop: 24,
  },
  logoutText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  aboutCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    padding: theme.spacing.l,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 24,
  },
  sponsorSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  sponsorLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sponsorLogosLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  sponsorLogoLarge: {
    width: 160,
    height: 120,
  },
  sponsorDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  copyrightText: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 16,
  },
  updateOrgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  updateOrgButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
    backgroundColor: theme.colors.background,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: theme.spacing.m,
    paddingBottom: 100,
  },
  placesContainer: {
    minHeight: 300,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  selectedAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  selectedAddressText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginLeft: 8,
  },
  modalButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  modalButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.5,
  },
  modalButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  // Demo modal styles
  demoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  demoModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  demoModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  demoModalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#DDD',
    textAlign: 'center',
    letterSpacing: 2,
  },
  demoErrorText: {
    color: '#B22222',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  demoModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  demoCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  demoCancelText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 15,
  },
  demoSubmitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  demoSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
