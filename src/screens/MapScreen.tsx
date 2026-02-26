import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { theme } from '../theme';
import { db } from '../config/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

interface Organization {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status?: string;
}

export const MapScreen = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 50,
    longitudeDelta: 50,
  });

  useEffect(() => {
    const orgsQuery = query(collection(db, 'organizations'));
    
    const unsubscribe = onSnapshot(orgsQuery, (snapshot) => {
      console.log('[MapScreen] Total organizations in database:', snapshot.docs.length);
      
      const allOrgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          status: data.status || 'Active',
        };
      });
      
      // Log all organizations and their coordinates
      allOrgs.forEach(org => {
        const latType = typeof org.latitude;
        const lngType = typeof org.longitude;
        const isValid = 
          latType === 'number' && 
          lngType === 'number' &&
          !isNaN(org.latitude) &&
          !isNaN(org.longitude) &&
          (org.latitude !== 0 || org.longitude !== 0);
        
        console.log(
          `[MapScreen] ${isValid ? '✅' : '❌'} ${org.name}:`,
          `lat=${org.latitude} (${latType}), lng=${org.longitude} (${lngType})`
        );
      });
      
      // Filter out organizations with invalid coordinates
      const orgsData: Organization[] = allOrgs.filter(org => 
        typeof org.latitude === 'number' && 
        typeof org.longitude === 'number' &&
        !isNaN(org.latitude) &&
        !isNaN(org.longitude) &&
        (org.latitude !== 0 || org.longitude !== 0)
      );
      
      console.log('[MapScreen] Valid organizations for map:', orgsData.length);
      
      setOrganizations(orgsData);
      
      // Fit map to show all organization pins
      if (orgsData.length > 0) {
        // Small delay to ensure map is ready
        setTimeout(() => {
          if (mapRef.current) {
            const coordinates = orgsData.map(org => ({
              latitude: org.latitude,
              longitude: org.longitude,
            }));
            
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            });
          }
        }, 1000);
      }
      
      setLoading(false);
    }, (error) => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
          >
            {organizations.map((org) => (
              <Marker
                key={org.id}
                coordinate={{ latitude: org.latitude, longitude: org.longitude }}
                title={org.name}
                description={org.address}
                pinColor={theme.colors.accent}
              />
            ))}
          </MapView>
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {organizations.length} {organizations.length === 1 ? 'Location' : 'Locations'} in Network
            </Text>
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
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 50,
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
});
