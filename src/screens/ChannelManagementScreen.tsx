import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';

interface Channel {
  id: string;
  name: string;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  isDefault: boolean;
}

interface ChannelManagementScreenProps {
  navigation: any;
  route: any;
}

export const ChannelManagementScreen: React.FC<ChannelManagementScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [creating, setCreating] = useState(false);
  const currentChannelId = route.params?.currentChannelId;

  // Load channels
  useEffect(() => {
    if (!user?.organizationId) return;

    const channelsQuery = query(
      collection(db, 'channels'),
      where('organizationId', '==', user.organizationId)
    );

    const unsubscribe = onSnapshot(channelsQuery, (snapshot) => {
      const channelsData: Channel[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          organizationId: data.organizationId,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          isDefault: data.isDefault || false,
        };
      });
      // Sort channels alphabetically by name
      channelsData.sort((a, b) => a.name.localeCompare(b.name));
      setChannels(channelsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.organizationId]);

  const validateChannelName = (name: string): string | null => {
    if (!name.trim()) return 'Channel name is required';
    if (name.length < 2) return 'Channel name must be at least 2 characters';
    if (name.length > 30) return 'Channel name must be less than 30 characters';
    if (!/^[a-z0-9-]+$/.test(name)) return 'Channel name must be lowercase letters, numbers, and hyphens only';
    if (channels.some(ch => ch.name === name)) return 'Channel name already exists';
    return null;
  };

  const handleCreateChannel = async () => {
    if (!user) return;

    const channelName = newChannelName.trim().toLowerCase();
    const error = validateChannelName(channelName);
    
    if (error) {
      Alert.alert('Invalid Channel Name', error);
      return;
    }

    setCreating(true);
    try {
      await addDoc(collection(db, 'channels'), {
        name: channelName,
        organizationId: user.organizationId,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        isDefault: false,
      });
      
      setNewChannelName('');
      setShowCreateForm(false);
      Alert.alert('Success', `Channel #${channelName} created!`);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create channel. Please try again.');
      console.error('Error creating channel:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteChannel = (channel: Channel) => {
    if (channel.isDefault) {
      Alert.alert('Cannot Delete', 'The default channel cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Channel',
      `Are you sure you want to delete #${channel.name}? All messages in this channel will remain but won't be accessible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'channels', channel.id));
              Alert.alert('Deleted', `Channel #${channel.name} has been deleted.`);
              
              // If deleted channel was current, navigate back to general
              if (channel.id === currentChannelId) {
                const generalChannel = channels.find(ch => ch.isDefault);
                if (generalChannel) {
                  navigation.navigate('TeamMain', { selectedChannelId: generalChannel.id });
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete channel.');
              console.error('Error deleting channel:', error);
            }
          }
        }
      ]
    );
  };

  const handleSelectChannel = (channel: Channel) => {
    navigation.navigate('TeamMain', { selectedChannelId: channel.id });
  };

  const renderChannel = ({ item }: { item: Channel }) => {
    const isCurrentChannel = item.id === currentChannelId;
    const isAdmin = user?.role === 'admin';

    return (
      <TouchableOpacity
        style={[styles.channelItem, isCurrentChannel && styles.currentChannel]}
        onPress={() => handleSelectChannel(item)}
      >
        <View style={styles.channelInfo}>
          <Text style={styles.channelName}>
            #{item.name}
            {item.isDefault && <Text style={styles.defaultBadge}> (default)</Text>}
          </Text>
          {isCurrentChannel && <Text style={styles.currentBadge}>CURRENT</Text>}
        </View>
        
        {isAdmin && !item.isDefault && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteChannel(item)}
          >
            <MaterialCommunityIcons name="delete" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Channels</Text>
        {user?.role === 'admin' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateForm(!showCreateForm)}
          >
            <MaterialCommunityIcons 
              name={showCreateForm ? "close" : "plus"} 
              size={24} 
              color={theme.colors.primary} 
            />
          </TouchableOpacity>
        )}
      </View>

      {showCreateForm && user?.role === 'admin' && (
        <View style={styles.createForm}>
          <Text style={styles.createFormTitle}>Create New Channel</Text>
          <TextInput
            style={styles.input}
            value={newChannelName}
            onChangeText={setNewChannelName}
            placeholder="channel-name"
            placeholderTextColor={theme.colors.gray}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <Text style={styles.inputHint}>Use lowercase letters, numbers, and hyphens only</Text>
          <TouchableOpacity
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreateChannel}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.createButtonText}>CREATE CHANNEL</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={channels}
        renderItem={renderChannel}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.channelList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No channels yet</Text>
            {user?.role === 'admin' && (
              <Text style={styles.emptySubtext}>Create your first channel</Text>
            )}
          </View>
        }
      />
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  createForm: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
  },
  createFormTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  createButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  channelList: {
    padding: theme.spacing.m,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: 8,
    marginBottom: theme.spacing.s,
  },
  currentChannel: {
    backgroundColor: theme.colors.primary,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  defaultBadge: {
    fontSize: 12,
    color: theme.colors.gray,
    fontWeight: 'normal',
  },
  currentBadge: {
    fontSize: 10,
    color: theme.colors.success,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 1,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.gray,
  },
});
