import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

import { RESOURCE_CATEGORIES_WITH_ALL, RESOURCE_CATEGORY_COLORS } from '../constants/categories';

const CATEGORIES = RESOURCE_CATEGORIES_WITH_ALL;
const CATEGORY_COLORS = RESOURCE_CATEGORY_COLORS;

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

interface ResourcesScreenProps {
  navigation: any;
}

export const ResourcesScreen: React.FC<ResourcesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

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
      console.error('Error loading resources:', error);
      Alert.alert('Error', 'Failed to load resources');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="book-open-variant" size={28} color={theme.colors.primary} />
          <Text style={styles.headerTitle}>Collaboration Information Hub</Text>
        </View>
        <Text style={styles.sponsorTag}>Your Logo Here</Text>
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
      ) : (
        <FlatList
          data={filteredResources}
          keyExtractor={(item) => item.id}
          renderItem={renderResource}
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
  sponsorTag: {
    fontSize: 9,
    color: theme.colors.gray,
    opacity: 0.6,
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
});
