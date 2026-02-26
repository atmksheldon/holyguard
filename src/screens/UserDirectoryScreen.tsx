import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName?: string;
}

interface UserStatus {
  hasConversation: boolean;
  hasPendingInvite: boolean;
  inviteDirection?: 'sent' | 'received';
  conversationId?: string;
}

interface UserDirectoryScreenProps {
  navigation: any;
}

export const UserDirectoryScreen: React.FC<UserDirectoryScreenProps> = ({ navigation }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map());

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.organizationName && u.organizationName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      // Load all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];

      for (const userDoc of usersSnapshot.docs) {
        if (userDoc.id === currentUser?.id) continue; // Skip current user

        const userData = userDoc.data();
        let organizationName = '';

        // Fetch organization name
        if (userData.organizationId) {
          try {
            const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
            if (orgDoc.exists()) {
              organizationName = orgDoc.data().name || '';
            }
          } catch (error) {
            console.error('Error loading org:', error);
          }
        }

        usersData.push({
          id: userDoc.id,
          name: userData.name || 'Unknown',
          email: userData.email || '',
          role: userData.role || 'user',
          organizationId: userData.organizationId || '',
          organizationName,
        });
      }

      setUsers(usersData);
      setFilteredUsers(usersData);

      // Load statuses for all users
      await loadUserStatuses(usersData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

  const loadUserStatuses = async (usersList: User[]) => {
    if (!currentUser?.id) return;

    const statusMap = new Map<string, UserStatus>();

    try {
      // Load conversations
      const convQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUser.id)
      );
      const convSnapshot = await getDocs(convQuery);

      convSnapshot.docs.forEach(convDoc => {
        const participants = convDoc.data().participants as string[];
        const otherUserId = participants.find(id => id !== currentUser.id);
        if (otherUserId) {
          statusMap.set(otherUserId, {
            hasConversation: true,
            hasPendingInvite: false,
            conversationId: convDoc.id,
          });
        }
      });

      // Load pending invites (sent by me)
      const sentInvitesQuery = query(
        collection(db, 'dm_invites'),
        where('fromUserId', '==', currentUser.id),
        where('status', '==', 'pending')
      );
      const sentSnapshot = await getDocs(sentInvitesQuery);

      sentSnapshot.docs.forEach(inviteDoc => {
        const toUserId = inviteDoc.data().toUserId;
        if (!statusMap.has(toUserId)) {
          statusMap.set(toUserId, {
            hasConversation: false,
            hasPendingInvite: true,
            inviteDirection: 'sent',
          });
        }
      });

      // Load pending invites (received by me)
      const receivedInvitesQuery = query(
        collection(db, 'dm_invites'),
        where('toUserId', '==', currentUser.id),
        where('status', '==', 'pending')
      );
      const receivedSnapshot = await getDocs(receivedInvitesQuery);

      receivedSnapshot.docs.forEach(inviteDoc => {
        const fromUserId = inviteDoc.data().fromUserId;
        if (!statusMap.has(fromUserId)) {
          statusMap.set(fromUserId, {
            hasConversation: false,
            hasPendingInvite: true,
            inviteDirection: 'received',
          });
        }
      });

      setUserStatuses(statusMap);
    } catch (error) {
      console.error('Error loading user statuses:', error);
    }
  };

  const handleSendInvite = async (user: User) => {
    if (!currentUser) return;

    try {
      // Fetch current user's organization name
      let currentOrgName = '';
      if (currentUser.organizationId) {
        const orgDoc = await getDoc(doc(db, 'organizations', currentUser.organizationId));
        if (orgDoc.exists()) {
          currentOrgName = orgDoc.data().name || '';
        }
      }

      await addDoc(collection(db, 'dm_invites'), {
        fromUserId: currentUser.id,
        toUserId: user.id,
        fromUserDetails: {
          name: currentUser.name,
          organizationId: currentUser.organizationId,
          organizationName: currentOrgName,
        },
        toUserDetails: {
          name: user.name,
          organizationId: user.organizationId,
          organizationName: user.organizationName || '',
        },
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Invite Sent', `Message request sent to ${user.name}`);
      
      // Reload statuses
      await loadUserStatuses(users);
    } catch (error) {
      console.error('Error sending invite:', error);
      Alert.alert('Error', 'Failed to send invite');
    }
  };

  const handleOpenChat = (user: User, conversationId: string) => {
    navigation.navigate('DirectMessageChat', {
      conversationId,
      otherUser: {
        name: user.name,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
      },
    });
  };

  const renderUser = ({ item }: { item: User }) => {
    const status = userStatuses.get(item.id) || {
      hasConversation: false,
      hasPendingInvite: false,
    };

    const isDifferentOrg = item.organizationId !== currentUser?.organizationId;

    return (
      <View style={styles.userItem}>
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="account-circle" size={50} color={theme.colors.gray} />
          {isDifferentOrg && (
            <View style={styles.orgBadge}>
              <MaterialCommunityIcons name="office-building" size={12} color={theme.colors.white} />
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.organizationName && (
            <Text style={styles.organizationName}>{item.organizationName}</Text>
          )}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          {status.hasConversation ? (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => handleOpenChat(item, status.conversationId!)}
            >
              <MaterialCommunityIcons name="message" size={20} color={theme.colors.white} />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          ) : status.hasPendingInvite ? (
            status.inviteDirection === 'sent' ? (
              <View style={styles.pendingButton}>
                <Text style={styles.pendingButtonText}>Invite Sent</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => navigation.navigate('DirectMessages', { activeTab: 'invites' })}
              >
                <Text style={styles.acceptButtonText}>View Invite</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => handleSendInvite(item)}
            >
              <MaterialCommunityIcons name="account-plus" size={20} color={theme.colors.primary} />
              <Text style={styles.inviteButtonText}>Send Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Users</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or organization..."
          placeholderTextColor={theme.colors.gray}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.userList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-search" size={80} color={theme.colors.gray} />
            <Text style={styles.emptyText}>No users found</Text>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    margin: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  userList: {
    paddingHorizontal: theme.spacing.m,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.m,
    borderRadius: 8,
    marginBottom: theme.spacing.s,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.m,
  },
  orgBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  organizationName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  roleBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  actionContainer: {
    marginLeft: theme.spacing.s,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: 4,
  },
  inviteButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  messageButtonText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  pendingButton: {
    backgroundColor: theme.colors.gray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pendingButtonText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.m,
  },
});
