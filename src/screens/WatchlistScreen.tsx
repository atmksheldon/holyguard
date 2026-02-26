import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { WatchlistEntry } from '../types';
import { WATCHLIST_STATUSES, WATCHLIST_STATUS_COLORS } from '../constants/categories';

export const WatchlistScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.organizationId) return;

    const q = query(
      collection(db, 'watchlist'),
      where('organizationId', '==', user.organizationId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: WatchlistEntry[] = snapshot.docs.map(d => {
        const raw = d.data();
        const ts = raw.createdAt?.toDate();
        return {
          id: d.id,
          name: raw.name || '',
          licensePlate: raw.licensePlate,
          physicalDescription: raw.physicalDescription,
          status: raw.status || 'active',
          date: ts ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          location: raw.location,
          latitude: raw.latitude,
          longitude: raw.longitude,
          imageUrls: raw.imageUrls || [],
          organizationId: raw.organizationId,
          createdBy: raw.createdBy,
          createdByName: raw.createdByName,
          linkedAlertId: raw.linkedAlertId,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          notes: raw.notes,
        };
      });
      setEntries(data);
      setError(null);
      setLoading(false);
    }, (err) => {
      console.error('Watchlist query error:', err);
      setError('Unable to load watchlist. Please try again.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.organizationId]);

  const filteredEntries = useMemo(() => {
    let results = entries;

    if (selectedStatus !== 'All') {
      results = results.filter(e => e.status === selectedStatus);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      results = results.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.licensePlate && e.licensePlate.toLowerCase().includes(q)) ||
        (e.physicalDescription && e.physicalDescription.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    return results;
  }, [entries, searchText, selectedStatus]);

  const handleDelete = (entryId: string) => {
    RNAlert.alert('Delete Entry', 'Are you sure you want to delete this watchlist entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'watchlist', entryId));
          } catch (error) {
            RNAlert.alert('Error', 'Failed to delete entry.');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => WATCHLIST_STATUS_COLORS[status] || theme.colors.gray;

  const renderEntry = ({ item }: { item: WatchlistEntry }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('WatchlistDetail', { entryId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {item.imageUrls.length > 0 ? (
          <Image source={{ uri: item.imageUrls[0] }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <MaterialCommunityIcons name="account-outline" size={28} color={theme.colors.gray} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>
          </View>
          {item.licensePlate && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="car" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.detailText}>{item.licensePlate}</Text>
            </View>
          )}
          {item.location && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.detailText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>WATCHLIST</Text>
        <Text style={styles.headerSubtitle}>Persons of Interest</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, plate, description..."
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

      {/* Status Filter Chips */}
      <View style={styles.filterRow}>
        {['All', ...WATCHLIST_STATUSES.map(s => s.value)].map((status) => {
          const isSelected = selectedStatus === status;
          const statusInfo = WATCHLIST_STATUSES.find(s => s.value === status);
          const label = statusInfo ? statusInfo.label : 'All';
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                isSelected && { backgroundColor: status === 'All' ? theme.colors.primary : getStatusColor(status) },
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[
                styles.filterChipText,
                isSelected && { color: theme.colors.white },
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : filteredEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="shield-search" size={48} color={theme.colors.gray} />
          <Text style={styles.emptyText}>
            {searchText || selectedStatus !== 'All' ? 'No matching entries found' : 'No watchlist entries yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          renderItem={renderEntry}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateWatchlistEntry')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.colors.white} />
      </TouchableOpacity>
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
    paddingTop: theme.spacing.m,
    paddingBottom: theme.spacing.s,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.l,
    marginVertical: theme.spacing.s,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.m,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: theme.spacing.l,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.s,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.surfaceDark,
  },
  cardContent: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceDark,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F3',
    marginHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.s,
    padding: theme.spacing.m,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.error,
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});
