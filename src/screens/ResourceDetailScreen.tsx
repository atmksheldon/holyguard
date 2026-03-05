import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

const CATEGORY_COLORS: { [key: string]: string } = {
  'First Aid': '#e74c3c',
  'Law Enforcement': '#3498db',
  'Fire Safety': '#e67e22',
  'Active Shooter': '#c0392b',
  'Cybersecurity': '#9b59b6',
  'Training': '#27ae60',
  'Best Practices': '#16a085',
  'Past Incidents': '#95a5a6',
  'Equipment': '#34495e',
  'Other': '#7f8c8d',
};

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

interface ResourceDetailScreenProps {
  navigation: any;
  route: {
    params: {
      resourceId: string;
    };
  };
}

export const ResourceDetailScreen: React.FC<ResourceDetailScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { resourceId } = route.params;
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResource();
  }, [resourceId]);

  const loadResource = async () => {
    try {
      const resourceDoc = await getDoc(doc(db, 'resources', resourceId));
      if (resourceDoc.exists()) {
        const data = resourceDoc.data();
        setResource({
          id: resourceDoc.id,
          title: data.title || '',
          description: data.description || '',
          category: data.category || 'Other',
          imageUrl: data.imageUrl,
          organizationId: data.organizationId || '',
          organizationName: data.organizationName,
          postedBy: data.postedBy || '',
          postedByName: data.postedByName,
          timestamp: data.timestamp?.toDate() || new Date(),
        });
      } else {
        Alert.alert('Error', 'Resource not found');
        navigation.goBack();
      }
    } catch (error) {
      logger.error('Error loading resource:', error);
      Alert.alert('Error', 'Failed to load resource');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Resource',
      'Are you sure you want to delete this resource? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'resources', resourceId));
              Alert.alert('Success', 'Resource deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              logger.error('Error deleting resource:', error);
              Alert.alert('Error', 'Failed to delete resource');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!resource) {
    return null;
  }

  const canDelete = user?.id === resource.postedBy || user?.role === 'admin';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resource Details</Text>
        {canDelete && (
          <TouchableOpacity onPress={handleDelete}>
            <MaterialCommunityIcons name="delete" size={24} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {resource.imageUrl && (
          <Image source={{ uri: resource.imageUrl }} style={styles.image} />
        )}

        <View style={styles.detailsContainer}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: CATEGORY_COLORS[resource.category] || CATEGORY_COLORS['Other'] },
            ]}
          >
            <Text style={styles.categoryBadgeText}>{resource.category}</Text>
          </View>

          <Text style={styles.title}>{resource.title}</Text>

          <View style={styles.metaContainer}>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="office-building" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>{resource.organizationName || 'Unknown Org'}</Text>
            </View>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="account" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>{resource.postedByName || 'Unknown User'}</Text>
            </View>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>{formatDate(resource.timestamp)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.descriptionTitle}>Description</Text>
          <Text style={styles.description}>{resource.description}</Text>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  detailsContainer: {
    padding: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  metaContainer: {
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceDark,
    marginVertical: 20,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
});
