import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, StatusBar, Alert as RNAlert, ActivityIndicator, TouchableOpacity, TextInput, Image } from 'react-native';
import { logger } from '../utils/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { AlertCard } from '../components/AlertCard';
import { IncidentButton } from '../components/IncidentButton';
import { IncidentReportModal } from '../components/IncidentReportModal';
import { AlertDetailModal } from '../components/AlertDetailModal';
import { EditIncidentModal } from '../components/EditIncidentModal';
import { Alert } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions, CameraView, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../config/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, deleteDoc, doc, where, getDocs, updateDoc } from 'firebase/firestore';
import { INCIDENT_CATEGORY_COLORS, INCIDENT_CATEGORY_LABELS } from '../constants/categories';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DashboardScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoLocation, setPhotoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showEmergencyBanner, setShowEmergencyBanner] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('emergencyBannerDismissed').then(val => {
      if (val !== 'true') setShowEmergencyBanner(true);
    });
  }, []);

  const dismissEmergencyBanner = async () => {
    setShowEmergencyBanner(false);
    await AsyncStorage.setItem('emergencyBannerDismissed', 'true');
  };

  const filteredAlerts = useMemo(() => {
    let results = alerts;

    if (selectedCategory !== 'All') {
      results = results.filter(a => a.category === selectedCategory);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      results = results.filter(a =>
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.reporterName && a.reporterName.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.title && a.title.toLowerCase().includes(q))
      );
    }

    return results;
  }, [alerts, searchText, selectedCategory]);

  // Real-time listener for alerts from Firestore
  useEffect(() => {
    logger.log('[Dashboard] Setting up alerts listener...');
    
    const alertsQuery = query(
      collection(db, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const alertsData: Alert[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate();
        const now = new Date();
        const diffMs = now.getTime() - (timestamp?.getTime() || now.getTime());
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        let timeAgo = 'Just now';
        if (diffDays > 0) timeAgo = `${diffDays}d ago`;
        else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
        else if (diffMins > 0) timeAgo = `${diffMins}m ago`;
        
        // Backward compat: normalize imageUrl to imageUrls array
        const imageUrls = data.imageUrls || (data.imageUrl ? [data.imageUrl] : []);

        return {
          id: doc.id,
          title: data.title || 'Incident',
          timestamp: timeAgo,
          location: data.location || 'Unknown',
          type: data.type || 'alert',
          category: data.category,
          imageUrl: data.imageUrl,
          imageUrls,
          description: data.description,
          reporterId: data.reporterId,
          reporterName: data.reporterName,
          latitude: data.latitude,
          longitude: data.longitude,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
          updatedByName: data.updatedByName,
          alertLevel: data.alertLevel,
          policeIncidentNumber: data.policeIncidentNumber,
        };
      });
      
      setAlerts(alertsData);
      setLoadingAlerts(false);
    }, (error) => {
      setLoadingAlerts(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, 'alerts', alertId));
    } catch (error) {
      RNAlert.alert('Error', 'Unable to delete alert. Please try again.');
    }
  };

  const handleIncidentReport = async () => {
    if (!permission) {
        // Permissions are still loading
        return;
    }
    
    if (!permission.granted) {
        const result = await requestPermission();
        if (!result.granted) {
            RNAlert.alert("Permission Denied", "Camera access is needed to report incidents.");
            return;
        }
    }
    
    // Open Camera Overlay
    setIsCameraVisible(true);
  };

  const takePicture = async () => {
      if (!cameraRef) return;
      
      logger.log('[Camera] Taking picture...');
      
      try {
        // Take picture first (don't block on GPS)
        const photo = await cameraRef.takePictureAsync({
          quality: 0.8,
          skipProcessing: true,
        });
        
        if (photo) {
          logger.log('[Camera] Picture taken successfully');
          setCapturedPhoto(photo.uri);
          setIsCameraVisible(false);
          setIsModalVisible(true);
          
          // Get location in background (non-blocking)
          getLocationInBackground();
        }
      } catch (error) {
        logger.error('[Camera] Error taking picture:', error);
        RNAlert.alert('Error', 'Failed to take picture. Please try again.');
      }
  };
  
  const getLocationInBackground = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 0,
        });
        setPhotoLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        logger.log('[GPS] Location captured:', location.coords.latitude, location.coords.longitude);
      } else {
        logger.log('[GPS] Location permission not granted');
        setPhotoLocation(null);
      }
    } catch (error) {
      logger.error('[GPS] Error getting location:', error);
      setPhotoLocation(null);
    }
  };

  const handleChoosePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permission Denied', 'Photo library permission is required');
        return;
      }

      // Open photo picker immediately (don't wait for GPS)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedPhoto(result.assets[0].uri);
        setIsModalVisible(true);
        
        // Get location in background (non-blocking)
        getLocationInBackground();
      }
    } catch (error) {
      logger.error('Error choosing photo:', error);
      RNAlert.alert('Error', 'Failed to select photo');
    }
  };

  const uploadPhoto = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();

    if (!blob.type.startsWith('image/')) {
      throw new Error('Invalid file type');
    }

    const maxSize = 5 * 1024 * 1024;
    if (blob.size > maxSize) {
      throw new Error('File too large');
    }

    const filename = uri.substring(uri.lastIndexOf('/') + 1);
    const storageRef = ref(storage, `incidents/${Date.now()}_${filename}`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handleSubmitReport = async (description: string, addToWatchlist: boolean, category: string, allPhotoUris: string[], alertLevel: 'yellow' | 'red', policeIncidentNumber: string) => {
      if (allPhotoUris.length === 0) {
          return;
      }
      setIsSubmitting(true);

      try {
        // 1. Upload all photos
        const imageUrls: string[] = [];
        for (const uri of allPhotoUris) {
          try {
            const url = await uploadPhoto(uri);
            imageUrls.push(url);
          } catch (error: any) {
            if (error.message === 'File too large') {
              RNAlert.alert("File Too Large", "One or more images exceed the 5MB limit. Please try again.");
              setIsSubmitting(false);
              return;
            }
            if (error.message === 'Invalid file type') {
              RNAlert.alert("Invalid File", "Only image files are allowed.");
              setIsSubmitting(false);
              return;
            }
            throw error;
          }
        }

        // 2. Save Alert to Firestore
        const alertData: any = {
            title: "Security Incident",
            description: description,
            category: category,
            imageUrl: imageUrls[0], // backward compat: keep first image as imageUrl
            imageUrls: imageUrls,
            timestamp: serverTimestamp(),
            type: 'alert',
            alertLevel: alertLevel,
            location: user?.organizationId || 'Unknown Location',
            reporterId: user?.id || 'unknown',
            reporterName: user?.name || 'Unknown',
        };

        if (policeIncidentNumber) {
          alertData.policeIncidentNumber = policeIncidentNumber;
        }

        if (photoLocation) {
          alertData.latitude = photoLocation.latitude;
          alertData.longitude = photoLocation.longitude;
        }

        const alertRef = await addDoc(collection(db, "alerts"), alertData);

        // 3. If watchlist is checked, post to #watchlist channel
        if (addToWatchlist && user?.organizationId) {
          try {
            const watchlistQuery = query(
              collection(db, 'channels'),
              where('organizationId', '==', user.organizationId),
              where('name', '==', 'watchlist')
            );
            const watchlistSnapshot = await getDocs(watchlistQuery);

            if (!watchlistSnapshot.empty) {
              const watchlistChannel = watchlistSnapshot.docs[0];

              await addDoc(collection(db, 'team_messages'), {
                text: `🚨 ${category}: ${description}\n\n📸 ${imageUrls.length} photo(s) attached`,
                senderId: user.id,
                senderName: user.name,
                senderRole: user.role || 'member',
                organizationId: user.organizationId,
                channelId: watchlistChannel.id,
                timestamp: serverTimestamp(),
              });
            }
          } catch (watchlistError) {
            logger.error('Error posting to watchlist:', watchlistError);
          }
        }

        setIsModalVisible(false);
        setCapturedPhoto(null);
        setPhotoLocation(null);

        // 4. If watchlist checked, navigate to create watchlist entry
        if (addToWatchlist) {
          RNAlert.alert("Incident Reported", "Would you like to create a detailed watchlist entry?", [
            { text: "Skip", style: "cancel" },
            {
              text: "Create Entry",
              onPress: () => {
                navigation.navigate('CreateWatchlistEntry', {
                  linkedAlertId: alertRef.id,
                  prefillDescription: description,
                  prefillImageUrls: imageUrls,
                  prefillLocation: photoLocation ? `${photoLocation.latitude}, ${photoLocation.longitude}` : undefined,
                  prefillCategory: category,
                });
              }
            },
          ]);
        } else {
          RNAlert.alert("Success", "Incident reported successfully.");
        }

      } catch (error: any) {
          RNAlert.alert("Error", "Failed to submit report. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isCameraVisible) {
      return (
          <View style={{ flex: 1 }}>
             <CameraView 
                style={StyleSheet.absoluteFill} 
                facing="back"
                ref={(ref) => setCameraRef(ref)}
             />
             <View style={styles.cameraOverlay}>
                 <View style={styles.cameraTopSection}>
                   <TouchableOpacity 
                     style={styles.closeCamera}
                     onPress={() => {
                       setIsCameraVisible(false);
                       setPhotoLocation(null);
                     }}
                   >
                     <MaterialCommunityIcons name="close" size={32} color={theme.colors.white} />
                   </TouchableOpacity>
                   
                   <Text style={styles.cameraText}>ALIGN THREAT IN VIEW</Text>
                   
                   <TouchableOpacity 
                     style={styles.choosePhotoOverlay}
                     onPress={() => {
                       setIsCameraVisible(false);
                       handleChoosePhoto();
                     }}
                   >
                     <MaterialCommunityIcons name="image" size={20} color={theme.colors.white} />
                     <Text style={styles.choosePhotoOverlayText}>Choose Existing Photo</Text>
                   </TouchableOpacity>
                 </View>
                 
                 <TouchableOpacity 
                   style={styles.shutterButton}
                   onPress={takePicture}
                   activeOpacity={0.7}
                 >
                   <View style={styles.shutterButtonInner} />
                 </TouchableOpacity>
             </View>
          </View>
      );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
            <Text style={styles.appName}>HOLYGUARD</Text>
            <Text style={styles.networkStatus}>
                NETWORK: <Text style={styles.onlineStatus}>ONLINE</Text>
            </Text>
            <View style={styles.headerSponsorRow}>
              <Image source={require('../../assets/uscca_logo.png')} style={styles.headerSponsorLogo} resizeMode="contain" />
            </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <MaterialCommunityIcons name="cog" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.userBadge}>
              <Text style={styles.userBadgeText}>{user?.role.toUpperCase() || 'USER'}</Text>
          </View>
        </View>
      </View>

      {showEmergencyBanner && (
        <View style={styles.emergencyBanner}>
          <View style={styles.emergencyBannerContent}>
            <MaterialCommunityIcons name="phone-alert" size={20} color={theme.colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.emergencyBannerText}>
              If you are experiencing a life-threatening emergency, please <Text style={styles.emergencyBold}>call 911 immediately</Text>. This app is a security coordination tool and is not a substitute for emergency services.
            </Text>
          </View>
          <TouchableOpacity onPress={dismissEmergencyBanner} style={styles.emergencyDismiss}>
            <MaterialCommunityIcons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mainContent}>
        <IncidentButton onPress={handleIncidentReport} />

        <View style={styles.feedContainer}>
            <Text style={styles.sectionTitle}>LIVE FEED</Text>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search incidents..."
                placeholderTextColor={theme.colors.gray}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.gray} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Dropdown */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedCategory === 'All' ? 'All Incident Types' : selectedCategory}
                </Text>
                <MaterialCommunityIcons
                  name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
              {showCategoryDropdown && (
                <View style={styles.dropdownList}>
                  {INCIDENT_CATEGORY_LABELS.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.dropdownItem,
                        selectedCategory === cat && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        selectedCategory === cat && styles.dropdownItemTextActive,
                      ]}>
                        {cat}
                      </Text>
                      {selectedCategory === cat && (
                        <MaterialCommunityIcons name="check" size={16} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {loadingAlerts ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
            ) : filteredAlerts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {searchText || selectedCategory !== 'All' ? 'No matching incidents' : 'No alerts yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchText || selectedCategory !== 'All' ? 'Try a different search or filter' : 'Tap the red button to report an incident'}
                </Text>
              </View>
            ) : (
              <FlatList
                  data={filteredAlerts}
                  renderItem={({ item }) => (
                    <AlertCard 
                      alert={item} 
                      onPress={() => {
                        setSelectedAlert(item);
                        setTimeout(() => setAlertModalVisible(true), 0);
                      }}
                      onDelete={() => handleDeleteAlert(item.id)}
                    />
                  )}
                  keyExtractor={item => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  ListFooterComponent={
                    <View style={styles.sponsorFooter}>
                      <Text style={styles.sponsorText}>Security Network powered by</Text>
                      <View style={styles.sponsorFooterLogos}>
                        <Image source={require('../../assets/uscca_logo.png')} style={styles.sponsorFooterLogo} resizeMode="contain" />
                      </View>
                    </View>
                  }
              />
            )}
        </View>
      </View>

      <IncidentReportModal
        visible={isModalVisible}
        photoUri={capturedPhoto}
        onClose={() => setIsModalVisible(false)}
        onSubmit={handleSubmitReport}
        isSubmitting={isSubmitting}
      />

      <AlertDetailModal
        alert={selectedAlert}
        visible={alertModalVisible}
        onClose={() => {
          setAlertModalVisible(false);
          setTimeout(() => setSelectedAlert(null), 300);
        }}
        onEdit={(alert) => {
          setAlertModalVisible(false);
          setEditingAlert(alert);
          setTimeout(() => setEditModalVisible(true), 300);
        }}
      />

      <EditIncidentModal
        visible={editModalVisible}
        alert={editingAlert}
        onClose={() => {
          setEditModalVisible(false);
          setTimeout(() => setEditingAlert(null), 300);
        }}
        onSaved={() => {
          // Real-time listener will auto-update the feed
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerSponsorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  headerSponsorLogo: {
    width: 50,
    height: 25,
  },
  networkStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  onlineStatus: {
    color: theme.colors.success,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    padding: 8,
  },
  userBadge: {
    backgroundColor: theme.colors.surfaceDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  userBadgeText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  emergencyBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3F3',
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.s,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD4D4',
    alignItems: 'flex-start',
  },
  emergencyBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emergencyBannerText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  emergencyBold: {
    fontWeight: 'bold',
    color: theme.colors.danger,
  },
  emergencyDismiss: {
    padding: 4,
    marginLeft: 4,
  },
  mainContent: {
      flex: 1,
      justifyContent: 'flex-start',
  },
  feedContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.4)', // Glassmorphism-lite
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: theme.spacing.l,
    paddingBottom: 0,
    marginTop: theme.spacing.m,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.surfaceDark,
    marginBottom: theme.spacing.s,
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
    height: 40,
    marginBottom: theme.spacing.s,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  dropdownContainer: {
    marginBottom: theme.spacing.m,
    zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  dropdownList: {
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface,
  },
  dropdownItemActive: {
    backgroundColor: theme.colors.surface,
  },
  dropdownItemText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  dropdownItemTextActive: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  listContent: {
    paddingBottom: 20,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    zIndex: 1,
  },
  cameraTopSection: {
    alignItems: 'center',
    marginTop: 40,
    width: '100%',
    paddingHorizontal: 20,
  },
  closeCamera: {
    position: 'absolute',
    top: 0,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  cameraText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  choosePhotoOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  choosePhotoOverlayText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  shutterButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 5,
    borderColor: theme.colors.white,
  },
  shutterButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.white,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: theme.spacing.l,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: 'center',
  },
  sponsorFooter: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
    marginTop: 16,
  },
  sponsorText: {
    fontSize: 11,
    color: theme.colors.gray,
    marginBottom: 8,
  },
  sponsorFooterLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sponsorFooterLogo: {
    width: 80,
    height: 34,
  }
});
