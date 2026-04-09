import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Keyboard, Platform } from 'react-native';
import { logger } from '../utils/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Mapbox, { MapView, Camera, ShapeSource, SymbolLayer, CircleLayer, HeatmapLayer, MarkerView, Images } from '@rnmapbox/maps';
import { theme } from '../theme';
import { db } from '../config/firebase';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { INCIDENT_CATEGORY_COLORS } from '../constants/categories';
import { useAuth } from '../context/AuthContext';
import { MAPBOX_ACCESS_TOKEN } from '../config/keys';
import { haversineDistanceMiles } from '../utils/geo';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

interface Organization {
  id: string;
  orgId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status?: string;
  phone?: string;
  website?: string;
  orgEmail?: string;
}

interface MapAlert {
  id: string;
  title: string;
  category?: string;
  alertLevel?: 'yellow' | 'red';
  latitude: number;
  longitude: number;
  location: string;
  reporterName?: string;
  timestamp: Date;
  description?: string;
}

export const MapScreen = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [alerts, setAlerts] = useState<MapAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<MapAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const cameraRef = useRef<Camera>(null);

  // Organizations listener
  useEffect(() => {
    const orgsQuery = query(collection(db, 'organizations'));

    const unsubscribe = onSnapshot(orgsQuery, (snapshot) => {
      logger.log('[MapScreen] Total organizations in database:', snapshot.docs.length);

      const allOrgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          orgId: data.id || doc.id,
          name: data.name,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          status: data.status || 'Active',
          phone: data.phone || undefined,
          website: data.website || undefined,
          orgEmail: data.orgEmail || undefined,
        };
      });

      const orgsData: Organization[] = allOrgs.filter(org =>
        typeof org.latitude === 'number' &&
        typeof org.longitude === 'number' &&
        !isNaN(org.latitude) &&
        !isNaN(org.longitude) &&
        (org.latitude !== 0 || org.longitude !== 0)
      );

      logger.log('[MapScreen] Valid organizations for map:', orgsData.length);
      setOrganizations(orgsData);
      setLoading(false);
    }, (error) => {
      logger.error('[MapScreen] Error loading organizations:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Active alerts listener (org-scoped)
  useEffect(() => {
    if (!user?.organizationId) return;

    const alertsQuery = query(
      collection(db, 'alerts'),
      where('organizationId', '==', user.organizationId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const alertsData: MapAlert[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          const ts = data.timestamp?.toDate?.() || new Date();
          return {
            id: doc.id,
            title: data.title || 'Incident',
            category: data.category,
            alertLevel: data.alertLevel,
            latitude: data.latitude,
            longitude: data.longitude,
            location: data.location || 'Unknown',
            reporterName: data.reporterName,
            timestamp: ts,
            description: data.description,
          };
        })
        .filter(alert =>
          typeof alert.latitude === 'number' &&
          typeof alert.longitude === 'number' &&
          !isNaN(alert.latitude) &&
          !isNaN(alert.longitude) &&
          alert.timestamp >= twentyFourHoursAgo
        );

      logger.log('[MapScreen] Active alerts on map:', alertsData.length);
      setAlerts(alertsData);
    });

    return () => unsubscribe();
  }, [user?.organizationId]);

  // ── My org (for distance calculations) ──
  const myOrg = useMemo(() =>
    organizations.find(org => user?.organizationId === org.orgId),
    [organizations, user?.organizationId]
  );

  const getDistanceFromMyOrg = (lat: number, lng: number): string | null => {
    if (!myOrg) return null;
    if (myOrg.latitude === lat && myOrg.longitude === lng) return null;
    const miles = haversineDistanceMiles(myOrg.latitude, myOrg.longitude, lat, lng);
    if (miles < 1) return `${(miles * 5280).toFixed(0)} ft away`;
    if (miles < 100) return `${miles.toFixed(1)} mi away`;
    return `${miles.toFixed(0)} mi away`;
  };

  // ── GeoJSON Sources ──

  const orgsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: organizations.map(org => ({
      type: 'Feature' as const,
      id: org.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [org.longitude, org.latitude],
      },
      properties: {
        id: org.id,
        orgId: org.orgId,
        name: org.name,
        isMyOrg: user?.organizationId === org.orgId,
      },
    })),
  }), [organizations, user?.organizationId]);

  const alertsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: alerts.map(alert => ({
      type: 'Feature' as const,
      id: alert.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [alert.longitude, alert.latitude],
      },
      properties: {
        id: alert.id,
        alertLevel: alert.alertLevel || 'yellow',
        title: alert.title,
        category: alert.category || '',
      },
    })),
  }), [alerts]);

  // ── Helpers ──

  const getOrgStatusColor = (status?: string): string => {
    if (status === 'verified' || status === 'Active') return theme.colors.verificationVerified;
    if (status === 'pending') return theme.colors.verificationPending;
    if (status === 'rejected') return theme.colors.verificationRejected;
    return theme.colors.gray;
  };

  const getOrgStatusLabel = (status?: string): string => {
    if (status === 'verified' || status === 'Active') return 'Verified';
    if (status === 'pending') return 'Pending';
    if (status === 'rejected') return 'Rejected';
    return 'Unknown';
  };

  const getAlertMarkerColor = (alert: MapAlert): string => {
    if (alert.alertLevel === 'red') return theme.colors.danger;
    if (alert.alertLevel === 'yellow') return theme.colors.alertYellow;
    if (alert.category && INCIDENT_CATEGORY_COLORS[alert.category]) {
      return INCIDENT_CATEGORY_COLORS[alert.category];
    }
    return theme.colors.warning;
  };

  const formatAlertTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];
    const q = searchText.toLowerCase();
    return organizations.filter(org =>
      org.name.toLowerCase().includes(q) ||
      org.address.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchText, organizations]);

  const flyToOrg = (org: Organization) => {
    setSearchText('');
    setSearchFocused(false);
    setSelectedOrg(null);
    setSelectedAlert(null);
    Keyboard.dismiss();
    cameraRef.current?.setCamera({
      centerCoordinate: [org.longitude, org.latitude],
      zoomLevel: 14,
      animationDuration: 800,
    });
    setTimeout(() => setSelectedOrg(org), 900);
  };

  const fitAllMarkers = () => {
    if (organizations.length === 0) return;
    const lngs = organizations.map(o => o.longitude);
    const lats = organizations.map(o => o.latitude);
    const ne: [number, number] = [Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5];
    const sw: [number, number] = [Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5];
    cameraRef.current?.fitBounds(ne, sw, 50, 800);
  };

  const handleOrgPress = (org: Organization) => {
    setSelectedAlert(null);
    setSelectedOrg(prev => prev?.id === org.id ? null : org);
  };

  const handleAlertPress = (alert: MapAlert) => {
    setSelectedOrg(null);
    setSelectedAlert(prev => prev?.id === alert.id ? null : alert);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading network...</Text>
        </View>
      ) : (
        <>
          <MapView
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            logoEnabled={false}
            attributionEnabled={false}
            compassEnabled={true}
            compassPosition={{ top: 100, right: 16 }}
            onPress={() => { setSelectedOrg(null); setSelectedAlert(null); }}
          >
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: organizations.length === 1
                  ? [organizations[0].longitude, organizations[0].latitude]
                  : [-98.5795, 39.8283],
                zoomLevel: organizations.length === 1 ? 12 : 3,
              }}
            />

            {/* Heatmap layer */}
            {showHeatmap && alerts.length > 0 && (
              <ShapeSource id="heatmap-source" shape={alertsGeoJSON}>
                <HeatmapLayer
                  id="heatmap-layer"
                  style={{
                    heatmapRadius: 30,
                    heatmapOpacity: 0.7,
                    heatmapIntensity: 1,
                    heatmapColor: [
                      'interpolate',
                      ['linear'],
                      ['heatmap-density'],
                      0, 'rgba(0,0,0,0)',
                      0.2, '#F59E0B',
                      0.4, '#e67e22',
                      0.6, '#e74c3c',
                      0.8, '#c0392b',
                      1, '#B22222',
                    ],
                  }}
                />
              </ShapeSource>
            )}

            {/* Organization markers */}
            {organizations.map(org => {
              const isMyOrg = user?.organizationId === org.orgId;
              return (
                <MarkerView
                  key={org.id}
                  coordinate={[org.longitude, org.latitude]}
                  allowOverlap={isMyOrg}
                >
                  <TouchableOpacity
                    onPress={() => handleOrgPress(org)}
                    activeOpacity={0.8}
                    style={[styles.orgMarker, isMyOrg && styles.myOrgMarker]}
                  >
                    <MaterialCommunityIcons
                      name={isMyOrg ? 'church' : 'shield-check'}
                      size={isMyOrg ? 22 : 18}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                </MarkerView>
              );
            })}

            {/* Alert markers */}
            {showAlerts && !showHeatmap && alerts.map(alert => (
              <MarkerView
                key={`alert-${alert.id}`}
                coordinate={[alert.longitude, alert.latitude]}
              >
                <TouchableOpacity
                  onPress={() => handleAlertPress(alert)}
                  activeOpacity={0.8}
                  style={[
                    styles.alertMarker,
                    { backgroundColor: getAlertMarkerColor(alert) },
                    alert.alertLevel === 'red' && styles.alertMarkerRed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={alert.alertLevel === 'red' ? 'alert-octagon' : 'alert'}
                    size={16}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </MarkerView>
            ))}
          </MapView>

          {/* Selected org callout */}
          {selectedOrg && (
            <View style={styles.calloutOverlay}>
              <View style={styles.orgCalloutBubble}>
                {user?.organizationId === selectedOrg.orgId && (
                  <View style={styles.myOrgBadge}>
                    <MaterialCommunityIcons name="star" size={12} color="#FFF" />
                    <Text style={styles.myOrgBadgeText}>YOUR ORGANIZATION</Text>
                  </View>
                )}
                <View style={styles.orgCalloutHeader}>
                  <MaterialCommunityIcons
                    name={user?.organizationId === selectedOrg.orgId ? 'church' : 'shield-check'}
                    size={20}
                    color={user?.organizationId === selectedOrg.orgId ? theme.colors.primary : theme.colors.accent}
                  />
                  <Text style={styles.orgCalloutName} numberOfLines={1}>{selectedOrg.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedOrg(null)}>
                    <MaterialCommunityIcons name="close" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.orgCalloutDivider} />
                <View style={styles.orgCalloutBody}>
                  <View style={styles.orgCalloutRow}>
                    <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.orgCalloutText} numberOfLines={2}>{selectedOrg.address}</Text>
                  </View>
                  {getDistanceFromMyOrg(selectedOrg.latitude, selectedOrg.longitude) && (
                    <View style={styles.orgCalloutRow}>
                      <MaterialCommunityIcons name="map-marker-distance" size={14} color={theme.colors.primary} />
                      <Text style={[styles.orgCalloutText, styles.distanceText]}>
                        {getDistanceFromMyOrg(selectedOrg.latitude, selectedOrg.longitude)}
                      </Text>
                    </View>
                  )}
                  {selectedOrg.phone && (
                    <View style={styles.orgCalloutRow}>
                      <MaterialCommunityIcons name="phone" size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.orgCalloutText}>{selectedOrg.phone}</Text>
                    </View>
                  )}
                  {selectedOrg.website && (
                    <View style={styles.orgCalloutRow}>
                      <MaterialCommunityIcons name="web" size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.orgCalloutText} numberOfLines={1}>{selectedOrg.website}</Text>
                    </View>
                  )}
                  {selectedOrg.orgEmail && (
                    <View style={styles.orgCalloutRow}>
                      <MaterialCommunityIcons name="email-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.orgCalloutText} numberOfLines={1}>{selectedOrg.orgEmail}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.orgCalloutStatusBar, { backgroundColor: getOrgStatusColor(selectedOrg.status) }]}>
                  <MaterialCommunityIcons
                    name={selectedOrg.status === 'verified' || selectedOrg.status === 'Active' ? 'check-circle' : 'clock-outline'}
                    size={12}
                    color="#FFF"
                  />
                  <Text style={styles.orgCalloutStatus}>{getOrgStatusLabel(selectedOrg.status)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Selected alert callout */}
          {selectedAlert && (
            <View style={styles.calloutOverlay}>
              <View style={styles.alertCalloutBubble}>
                <View style={[styles.alertCalloutHeader, { backgroundColor: getAlertMarkerColor(selectedAlert) }]}>
                  <Text style={styles.alertCalloutLevel}>
                    {selectedAlert.alertLevel === 'red' ? 'RED ALERT' : 'YELLOW ALERT'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.alertCalloutTime}>{formatAlertTime(selectedAlert.timestamp)}</Text>
                    <TouchableOpacity onPress={() => setSelectedAlert(null)} style={{ marginLeft: 8 }}>
                      <MaterialCommunityIcons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.alertCalloutBody}>
                  <Text style={styles.alertCalloutTitle} numberOfLines={1}>{selectedAlert.title}</Text>
                  {selectedAlert.category && (
                    <Text style={styles.alertCalloutCategory}>{selectedAlert.category}</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <MaterialCommunityIcons name="map-marker" size={12} color={theme.colors.textSecondary} />
                    <Text style={styles.alertCalloutLocation} numberOfLines={1}>{' '}{selectedAlert.location}</Text>
                  </View>
                  {getDistanceFromMyOrg(selectedAlert.latitude, selectedAlert.longitude) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialCommunityIcons name="map-marker-distance" size={12} color={theme.colors.primary} />
                      <Text style={styles.alertCalloutDistance}>
                        {' '}{getDistanceFromMyOrg(selectedAlert.latitude, selectedAlert.longitude)}
                      </Text>
                    </View>
                  )}
                  {selectedAlert.description && (
                    <Text style={styles.alertCalloutDesc} numberOfLines={3}>{selectedAlert.description}</Text>
                  )}
                  {selectedAlert.reporterName && (
                    <Text style={styles.alertCalloutReporter}>Reported by {selectedAlert.reporterName}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search organizations..."
                placeholderTextColor={theme.colors.gray}
                value={searchText}
                onChangeText={setSearchText}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchText(''); Keyboard.dismiss(); }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            {searchResults.length > 0 && searchFocused && (
              <View style={styles.searchResults}>
                {searchResults.map((org) => {
                  const isMyOrg = user?.organizationId === org.orgId;
                  return (
                    <TouchableOpacity
                      key={org.id}
                      style={styles.searchResultItem}
                      onPress={() => flyToOrg(org)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={isMyOrg ? 'church' : 'shield-check'}
                        size={16}
                        color={isMyOrg ? theme.colors.primary : theme.colors.accent}
                      />
                      <View style={styles.searchResultTextWrap}>
                        <Text style={styles.searchResultName} numberOfLines={1}>
                          {org.name}{isMyOrg ? '  (You)' : ''}
                        </Text>
                        <Text style={styles.searchResultAddress} numberOfLines={1}>{org.address}</Text>
                        {getDistanceFromMyOrg(org.latitude, org.longitude) && (
                          <Text style={styles.searchResultDistance}>
                            {getDistanceFromMyOrg(org.latitude, org.longitude)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Right side controls */}
          <View style={styles.controlsColumn}>
            {/* Alert toggle */}
            <TouchableOpacity
              style={[styles.controlBtn, showAlerts && styles.controlBtnActive]}
              onPress={() => { setShowAlerts(!showAlerts); if (showHeatmap && !showAlerts) setShowHeatmap(false); }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={showAlerts ? 'alert-circle' : 'alert-circle-outline'}
                size={20}
                color={showAlerts ? '#FFF' : theme.colors.textPrimary}
              />
              <Text style={[styles.controlBtnText, showAlerts && styles.controlBtnTextActive]}>
                Alerts
              </Text>
            </TouchableOpacity>

            {/* Heatmap toggle */}
            <TouchableOpacity
              style={[styles.controlBtn, showHeatmap && styles.controlBtnHeatmap]}
              onPress={() => setShowHeatmap(!showHeatmap)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={showHeatmap ? 'fire' : 'fire'}
                size={20}
                color={showHeatmap ? '#FFF' : theme.colors.textPrimary}
              />
              <Text style={[styles.controlBtnText, showHeatmap && styles.controlBtnTextActive]}>
                Heat
              </Text>
            </TouchableOpacity>

            {/* Re-center button */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={fitAllMarkers}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.controlBtnText}>Fit All</Text>
            </TouchableOpacity>
          </View>

          {/* Overlay: location count */}
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {organizations.length} {organizations.length === 1 ? 'Location' : 'Locations'} in Network
            </Text>
            {showAlerts && alerts.length > 0 && (
              <Text style={styles.overlayAlertCount}>
                {alerts.length} Active {alerts.length === 1 ? 'Alert' : 'Alerts'} (24h)
              </Text>
            )}
            <Text style={styles.sponsorTag}>Your Logo Here</Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.m,
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  map: {
    flex: 1,
  },

  // ── Search ──
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 80,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingVertical: 2,
  },
  searchResults: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  searchResultAddress: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  searchResultDistance: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },

  // ── Controls column (right side) ──
  controlsColumn: {
    position: 'absolute',
    top: 50,
    right: 12,
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    width: 56,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  controlBtnActive: {
    backgroundColor: theme.colors.danger,
  },
  controlBtnHeatmap: {
    backgroundColor: '#e67e22',
  },
  controlBtnText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  controlBtnTextActive: {
    color: '#FFF',
  },

  // ── Overlay ──
  overlay: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: theme.colors.surfaceDark,
    padding: theme.spacing.s,
    borderRadius: 8,
    opacity: 0.9,
  },
  overlayText: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  sponsorTag: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    textAlign: 'center',
  },
  overlayAlertCount: {
    color: theme.colors.alertYellow,
    fontWeight: '600',
    fontSize: 12,
    marginTop: 2,
  },

  // ── Org markers ──
  orgMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  myOrgMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.alertYellow,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },

  // ── Alert markers ──
  alertMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  alertMarkerRed: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
  },

  // ── Callout overlay (bottom card) ──
  calloutOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 20,
  },

  // ── Org callout ──
  orgCalloutBubble: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  myOrgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  myOrgBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  orgCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  orgCalloutName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginLeft: 8,
    flex: 1,
  },
  orgCalloutDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  orgCalloutBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orgCalloutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  orgCalloutText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  distanceText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  orgCalloutStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  orgCalloutStatus: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  // ── Alert callout ──
  alertCalloutBubble: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  alertCalloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alertCalloutLevel: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  alertCalloutTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  alertCalloutBody: {
    padding: 12,
  },
  alertCalloutTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  alertCalloutCategory: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertCalloutLocation: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  alertCalloutDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  alertCalloutDistance: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  alertCalloutReporter: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});
