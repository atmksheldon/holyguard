import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Linking, Platform } from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { GOOGLE_PLACES_API_KEY } from '../config/keys';
import { haversineDistanceMiles } from '../utils/geo';

import { RESOURCE_CATEGORIES_WITH_ALL, RESOURCE_CATEGORY_COLORS } from '../constants/categories';

const CATEGORIES = RESOURCE_CATEGORIES_WITH_ALL;
const CATEGORY_COLORS = RESOURCE_CATEGORY_COLORS;

const USCCA_TRAINING_URL = 'https://www.usconcealedcarry.com/firearms-training/range-retailer/texas-partners/uscca/event-allen-tx-should-i-shoot-25cbc/';

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  organizationId: string;
  organizationName?: string;
  postedBy: string;
  postedByName?: string;
  timestamp: Date;
}

interface NearbyPlace {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  geometry: { location: { lat: number; lng: number } };
  distanceMiles: number;
}

interface ResourcesScreenProps {
  navigation: any;
}

export const ResourcesScreen: React.FC<ResourcesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [searchRadiusMiles, setSearchRadiusMiles] = useState(25);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const resourcesQuery = query(
      collection(db, 'resources'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(resourcesQuery, (snapshot) => {
      const resourcesData: Resource[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'Other',
          imageUrl: data.imageUrl,
          organizationId: data.organizationId || '',
          organizationName: data.organizationName,
          postedBy: data.postedBy || '',
          postedByName: data.postedByName,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      });
      setResources(resourcesData);
      setLoading(false);
    }, (error) => {
      logger.error('Error loading resources:', error);
      Alert.alert('Error', 'Failed to load resources');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Get user location on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPlacesError('Location permission needed to find nearby training');
            setPlacesLoading(false);
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setUserLocation(position.coords);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Error getting user location:', err);
          setPlacesError('Unable to get your location');
          setPlacesLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Fetch nearby firearms training locations when location or radius changes
  useEffect(() => {
    if (!userLocation) return;

    let cancelled = false;
    setPlacesLoading(true);
    setPlacesError(null);
    setNearbyPlaces([]);

    const radiusMeters = Math.round(searchRadiusMiles * 1609.34);

    (async () => {
      try {
        const { latitude, longitude } = userLocation;

        const url =
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
          `?location=${latitude},${longitude}` +
          `&radius=${radiusMeters}` +
          `&keyword=${encodeURIComponent('firearms training')}` +
          `&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (cancelled) return;

        if (data.status === 'OK' && data.results?.length > 0) {
          const places: NearbyPlace[] = data.results.map((place: any) => ({
            ...place,
            distanceMiles: haversineDistanceMiles(
              latitude,
              longitude,
              place.geometry.location.lat,
              place.geometry.location.lng
            ),
          }));
          places.sort((a, b) => a.distanceMiles - b.distanceMiles);
          setNearbyPlaces(places);
        } else if (data.status === 'ZERO_RESULTS') {
          setPlacesError('No training locations found within ' + searchRadiusMiles + ' miles');
        } else {
          setPlacesError('Unable to load nearby training locations');
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Error fetching nearby places:', err);
          setPlacesError('Unable to load nearby training locations');
        }
      } finally {
        if (!cancelled) setPlacesLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userLocation, searchRadiusMiles]);

  const filteredResources = useMemo(() => {
    let results = resources;

    if (selectedCategory !== 'All') {
      results = results.filter(r => r.category === selectedCategory);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      results = results.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }

    return results;
  }, [resources, selectedCategory, searchText]);

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const renderCategoryFilter = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === item && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(item)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === item && styles.filterChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderResource = ({ item }: { item: Resource }) => (
    <TouchableOpacity
      style={styles.resourceCard}
      onPress={() => navigation.navigate('ResourceDetail', { resourceId: item.id })}
    >
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.resourceImage} />
      )}
      <View style={styles.resourceContent}>
        <View style={styles.resourceHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Other'] },
            ]}
          >
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
          <Text style={styles.resourceTime}>{getTimeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.resourceTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.resourceDescription} numberOfLines={3}>
          {item.description}
        </Text>
        <View style={styles.resourceFooter}>
          <MaterialCommunityIcons name="office-building" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.resourceOrg} numberOfLines={1}>
            {item.organizationName || 'Unknown Org'}
          </Text>
          <Text style={styles.resourceDivider}>•</Text>
          <Text style={styles.resourcePostedBy} numberOfLines={1}>
            {item.postedByName || 'Unknown User'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const openDirections = (place: NearbyPlace) => {
    const { lat, lng } = place.geometry.location;
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}&q=${label}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${place.place_id}`,
    })!;
    Linking.openURL(url);
  };

  const renderNearbyPlace = (place: NearbyPlace) => (
    <TouchableOpacity
      key={place.place_id}
      style={styles.nearbyCard}
      onPress={() => openDirections(place)}
      activeOpacity={0.8}
    >
      <View style={styles.nearbyHeader}>
        <Text style={styles.nearbyName} numberOfLines={1}>{place.name}</Text>
        <View style={styles.distanceBadge}>
          <MaterialCommunityIcons name="map-marker-distance" size={12} color="#fff" />
          <Text style={styles.distanceText}>{place.distanceMiles.toFixed(1)} mi</Text>
        </View>
      </View>
      <Text style={styles.nearbyAddress} numberOfLines={1}>{place.vicinity}</Text>
      <View style={styles.nearbyFooter}>
        {place.rating != null && (
          <View style={styles.ratingContainer}>
            <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {place.rating.toFixed(1)}
              {place.user_ratings_total != null && (
                <Text style={styles.ratingCount}> ({place.user_ratings_total})</Text>
              )}
            </Text>
          </View>
        )}
        {place.opening_hours != null && (
          <Text style={[styles.openStatus, { color: place.opening_hours.open_now ? theme.colors.success : theme.colors.error }]}>
            {place.opening_hours.open_now ? 'Open Now' : 'Closed'}
          </Text>
        )}
        <View style={styles.directionsLink}>
          <MaterialCommunityIcons name="directions" size={14} color={theme.colors.primary} />
          <Text style={styles.directionsText}>Directions</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const RADIUS_OPTIONS = [10, 25, 50, 100];

  const renderNearbyTrainingSection = () => (
    <View style={styles.nearbySection}>
      <View style={styles.nearbySectionHeader}>
        <MaterialCommunityIcons name="crosshairs-gps" size={20} color={theme.colors.primary} />
        <Text style={styles.nearbySectionTitle}>Training Near You</Text>
      </View>
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((miles) => (
          <TouchableOpacity
            key={miles}
            style={[
              styles.radiusChip,
              searchRadiusMiles === miles && styles.radiusChipActive,
            ]}
            onPress={() => setSearchRadiusMiles(miles)}
          >
            <Text
              style={[
                styles.radiusChipText,
                searchRadiusMiles === miles && styles.radiusChipTextActive,
              ]}
            >
              {miles} mi
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {placesLoading ? (
        <View style={styles.nearbyLoading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.nearbyLoadingText}>Finding nearby training locations...</Text>
        </View>
      ) : placesError ? (
        <View style={styles.nearbyError}>
          <MaterialCommunityIcons name="map-marker-off" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.nearbyErrorText}>{placesError}</Text>
        </View>
      ) : (
        nearbyPlaces.map(renderNearbyPlace)
      )}
    </View>
  );

  const renderListHeader = () => (
    <>
      {renderTrainingCard()}
      {renderNearbyTrainingSection()}
    </>
  );

  const renderTrainingCard = () => (
    <TouchableOpacity
      style={styles.trainingCard}
      onPress={() => Linking.openURL(USCCA_TRAINING_URL)}
      activeOpacity={0.8}
    >
      <View style={styles.trainingBadge}>
        <MaterialCommunityIcons name="star" size={14} color="#fff" />
        <Text style={styles.trainingBadgeText}>SPONSORED</Text>
      </View>
      <Image source={require('../../assets/uscca_logo.png')} style={styles.trainingLogo} resizeMode="contain" />
      <Text style={styles.trainingTitle}>Should I Shoot?</Text>
      <Text style={styles.trainingSubtitle}>USCCA Firearms Training Event - Allen, TX</Text>
      <Text style={styles.trainingDescription}>
        Join USCCA for an interactive training session covering real-world self-defense scenarios and decision-making.
      </Text>
      <View style={styles.trainingButton}>
        <Text style={styles.trainingButtonText}>View Event Details</Text>
        <MaterialCommunityIcons name="open-in-new" size={16} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="book-open-variant" size={28} color={theme.colors.primary} />
          <Text style={styles.headerTitle}>Collaboration Information Hub</Text>
        </View>
        <Image source={require('../../assets/uscca_logo.png')} style={styles.sponsorLogo} resizeMode="contain" />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search resources..."
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

      {renderCategoryFilter()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filteredResources.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          renderItem={() => null}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="book-open-variant" size={64} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No resources yet</Text>
              <Text style={styles.emptySubtext}>
                {searchText
                  ? 'Try a different search term'
                  : selectedCategory === 'All'
                    ? 'Be the first to share a resource!'
                    : `No resources in ${selectedCategory}`}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={filteredResources}
          keyExtractor={(item) => item.id}
          renderItem={renderResource}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateResource')}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginLeft: 12,
    flex: 1,
  },
  sponsorLogo: {
    width: 60,
    height: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  filterContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  resourceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resourceImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  resourceContent: {
    padding: 16,
  },
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  resourceTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  resourceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  resourceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  resourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceOrg: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  resourceDivider: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: 6,
  },
  resourcePostedBy: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  trainingCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2a435',
  },
  trainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2a435',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  trainingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },
  trainingLogo: {
    width: 120,
    height: 50,
    marginBottom: 12,
  },
  trainingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  trainingSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2a435',
    marginBottom: 8,
    textAlign: 'center',
  },
  trainingDescription: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  trainingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2a435',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  trainingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginRight: 6,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Nearby training section
  nearbySection: {
    marginBottom: 16,
  },
  nearbySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nearbySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginLeft: 8,
  },
  radiusRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  radiusChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radiusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  radiusChipTextActive: {
    color: '#fff',
  },
  nearbyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  nearbyLoadingText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 10,
  },
  nearbyError: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  nearbyErrorText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  nearbyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  nearbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nearbyName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 3,
  },
  nearbyAddress: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  nearbyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginLeft: 3,
    fontWeight: '500',
  },
  ratingCount: {
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  openStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 12,
  },
  directionsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  directionsText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: 3,
  },
});
