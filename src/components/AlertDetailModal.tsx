import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, ActivityIndicator, Linking, Platform, Alert as RNAlert, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { theme } from '../theme';
import { Alert } from '../types';
import { db } from '../config/firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { INCIDENT_CATEGORIES, ALERT_LEVEL_COLORS } from '../constants/categories';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AlertDetailModalProps {
  alert: Alert | null;
  visible: boolean;
  onClose: () => void;
  onEdit?: (alert: Alert) => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({ alert, visible, onClose, onEdit }) => {
  const { user } = useAuth();
  const [orgDetails, setOrgDetails] = useState<{ name: string; address: string; latitude?: number; longitude?: number } | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);

  // Zoom gesture shared values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const closeZoom = () => {
    setZoomPhotoUri(null);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.8, Math.min(6, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (savedScale.value <= 1) {
        resetZoom();
      } else {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        resetZoom();
      } else {
        scale.value = withSpring(3);
        savedScale.value = 3;
      }
    });

  const zoomGestures = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Reset zoom values when opening a new photo
  useEffect(() => {
    if (zoomPhotoUri) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [zoomPhotoUri]);

  // Normalize photos: support both imageUrls array and legacy imageUrl string
  const photos = alert?.imageUrls?.length
    ? alert.imageUrls
    : alert?.imageUrl
      ? [alert.imageUrl]
      : [];

  const categoryInfo = alert?.category
    ? INCIDENT_CATEGORIES.find(c => c.value === alert.category)
    : null;

  const canEdit = user && alert && (
    user.id === alert.reporterId || user.role === 'admin'
  );

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!alert || !visible) {
        setOrgDetails(null);
        return;
      }

      setLoadingOrg(true);
      try {
        const orgId = alert.location;
        let orgDoc = await getDoc(doc(db, 'organizations', orgId));

        if (!orgDoc.exists()) {
          const orgQuery = query(
            collection(db, 'organizations'),
            where('id', '==', orgId)
          );
          const querySnapshot = await getDocs(orgQuery);
          if (!querySnapshot.empty) {
            orgDoc = querySnapshot.docs[0];
          }
        }

        if (orgDoc.exists()) {
          const data = orgDoc.data();
          setOrgDetails({
            name: data.name || 'Unknown',
            address: data.address || 'Address not available',
            latitude: data.latitude,
            longitude: data.longitude,
          });
        } else {
          setOrgDetails({
            name: orgId,
            address: 'Organization details not found',
          });
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
        setOrgDetails({
          name: alert.location,
          address: 'Unable to load details',
        });
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchOrganization();
    setActivePhotoIndex(0);
  }, [alert, visible]);

  const getIconName = (type: Alert['type']) => {
    switch (type) {
      case 'alert': return 'alert-circle';
      case 'warning': return 'alert-octagon';
      case 'info': return 'information';
      default: return 'bell';
    }
  };

  const getIconColor = (type: Alert['type']) => {
    switch (type) {
      case 'alert': return theme.colors.error;
      case 'warning': return theme.colors.warning;
      case 'info': return theme.colors.primary;
      default: return theme.colors.textSecondary;
    }
  };

  if (!alert) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons
                name={getIconName(alert.type)}
                size={32}
                color={getIconColor(alert.type)}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.headerTitle}>ALERT DETAILS</Text>
            </View>
            <View style={styles.headerRight}>
              {canEdit && onEdit && (
                <TouchableOpacity onPress={() => onEdit(alert)} style={styles.editButton}>
                  <MaterialCommunityIcons name="pencil" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Alert Level Banner */}
          {(() => {
            const level = alert.alertLevel || 'yellow';
            const isRed = level === 'red';
            const bannerColor = ALERT_LEVEL_COLORS[level];
            return (
              <View style={[styles.alertLevelBanner, { backgroundColor: bannerColor }]}>
                <MaterialCommunityIcons
                  name={isRed ? 'alert-octagon' : 'eye-outline'}
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.alertLevelBannerText}>
                  {isRed ? 'IMMINENT THREAT' : 'SITUATIONAL AWARENESS'}
                </Text>
              </View>
            );
          })()}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Photo Gallery */}
            {photos.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / (screenWidth * 0.9));
                    setActivePhotoIndex(index);
                  }}
                >
                  {photos.map((uri, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.9}
                      onPress={() => setZoomPhotoUri(uri)}
                    >
                      <Image
                        source={{ uri }}
                        style={[styles.image, { width: screenWidth * 0.9 }]}
                        resizeMode="cover"
                      />
                      <View style={styles.zoomHint}>
                        <MaterialCommunityIcons name="magnify-plus-outline" size={20} color="rgba(255,255,255,0.9)" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {photos.length > 1 && (
                  <View style={styles.photoIndicator}>
                    {photos.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.dot,
                          index === activePhotoIndex && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.infoSection}>
              <Text style={styles.title}>{alert.title}</Text>

              {/* Category Badge */}
              {categoryInfo && (
                <View style={[styles.categoryBadge, { backgroundColor: categoryInfo.color }]}>
                  <MaterialCommunityIcons name={categoryInfo.icon as any} size={14} color={theme.colors.white} style={{ marginRight: 4 }} />
                  <Text style={styles.categoryBadgeText}>{categoryInfo.label}</Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.metaText}>{alert.timestamp}</Text>
                </View>
              </View>

              {/* Updated info */}
              {alert.updatedAt && (
                <View style={styles.updatedRow}>
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.updatedText}>
                    Edited{alert.updatedByName ? ` by ${alert.updatedByName}` : ''}
                  </Text>
                </View>
              )}

              {/* GPS Location */}
              {alert.latitude && alert.longitude && (
                <View style={styles.gpsSection}>
                  <Text style={styles.gpsSectionLabel}>INCIDENT LOCATION (GPS)</Text>
                  <View style={styles.gpsRow}>
                    <MaterialCommunityIcons name="crosshairs-gps" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={styles.gpsCoordinates}>
                        {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                      </Text>
                      <TouchableOpacity
                        onPress={async () => {
                          if (!alert.latitude || !alert.longitude) return;
                          const url = Platform.OS === 'ios'
                            ? `maps://0,0?q=${alert.latitude},${alert.longitude}`
                            : `https://maps.google.com/?q=${alert.latitude},${alert.longitude}`;

                          try {
                            const supported = await Linking.canOpenURL(url);
                            if (supported) {
                              await Linking.openURL(url);
                            } else {
                              RNAlert.alert('Error', 'Unable to open maps application');
                            }
                          } catch (error) {
                            RNAlert.alert('Error', 'Failed to open maps');
                          }
                        }}
                      >
                        <Text style={styles.gpsLink}>View on Maps</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Organization Details */}
              <View style={styles.orgSection}>
                <Text style={styles.orgSectionLabel}>ORGANIZATION</Text>
                {loadingOrg ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 8 }} />
                ) : orgDetails ? (
                  <>
                    <View style={styles.orgRow}>
                      <MaterialCommunityIcons name="office-building" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.orgText}>{orgDetails.name}</Text>
                    </View>
                    <View style={styles.orgRow}>
                      <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.orgText}>{orgDetails.address}</Text>
                    </View>
                  </>
                ) : null}
              </View>

              {alert.reporterName && (
                <View style={styles.reporterRow}>
                  <MaterialCommunityIcons name="account" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.metaText}>Reported by: {alert.reporterName}</Text>
                </View>
              )}

              {alert.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.descriptionLabel}>DESCRIPTION</Text>
                  <Text style={styles.descriptionText}>{alert.description}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.dismissButton} onPress={onClose}>
            <Text style={styles.dismissButtonText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fullscreen Photo Zoom Viewer */}
      {zoomPhotoUri && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={closeZoom}
        >
          <GestureHandlerRootView style={styles.zoomOverlay}>
            <TouchableOpacity style={styles.zoomCloseButton} onPress={closeZoom}>
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.zoomTip}>Pinch to zoom  |  Double-tap to toggle</Text>
            <GestureDetector gesture={zoomGestures}>
              <Animated.View style={[styles.zoomImageContainer, zoomAnimatedStyle]}>
                <Animated.Image
                  source={{ uri: zoomPhotoUri }}
                  style={styles.zoomImage}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  editButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  alertLevelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  alertLevelBannerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  content: {
    flexGrow: 1,
  },
  image: {
    height: 250,
    backgroundColor: theme.colors.surfaceDark,
  },
  photoIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.gray,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 20,
  },
  infoSection: {
    padding: theme.spacing.l,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.s,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.white,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.s,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.m,
  },
  metaText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  updatedText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  orgSection: {
    marginTop: theme.spacing.s,
    marginBottom: theme.spacing.m,
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  orgSectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.s,
    letterSpacing: 1,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  orgText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  gpsSection: {
    marginTop: theme.spacing.s,
    marginBottom: theme.spacing.m,
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error,
  },
  gpsSectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.s,
    letterSpacing: 1,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsCoordinates: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  gpsLink: {
    fontSize: 12,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  descriptionSection: {
    marginTop: theme.spacing.m,
    paddingTop: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceDark,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.s,
    letterSpacing: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  dismissButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    alignItems: 'center',
    margin: theme.spacing.m,
    borderRadius: 8,
  },
  dismissButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 6,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  zoomTip: {
    position: 'absolute',
    bottom: 40,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    zIndex: 10,
  },
  zoomImageContainer: {
    width: screenWidth,
    height: screenHeight * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
});
