import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

interface Conversation {
  id: string;
  participants: string[];
  participantDetails: {
    [userId: string]: {
      name: string;
      organizationId: string;
      organizationName?: string;
    };
  };
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageSenderId: string;
}

interface DMInvite {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserDetails: {
    name: string;
    organizationId: string;
    organizationName?: string;
  };
  toUserDetails: {
    name: string;
    organizationId: string;
    organizationName?: string;
  };
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

interface DirectMessagesScreenProps {
  navigation: any;
}

export const DirectMessagesScreen: React.FC<DirectMessagesScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'messages' | 'invites'>('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<DMInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<DMInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.id)
    );

    const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
      const conversationsData: Conversation[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          participants: data.participants || [],
          participantDetails: data.participantDetails || {},
          lastMessage: data.lastMessage || '',
          lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || new Date(),
          lastMessageSenderId: data.lastMessageSenderId || '',
        };
      });
      setConversations(conversationsData);
      setLoading(false);
    }, (error) => {
      logger.error('Error loading conversations:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Load invites
  useEffect(() => {
    if (!user?.id) return;

    // Received invites
    const receivedQuery = query(
      collection(db, 'dm_invites'),
      where('toUserId', '==', user.id),
      where('status', '==', 'pending')
    );

    const unsubReceived = onSnapshot(receivedQuery, (snapshot) => {
      const invites: DMInvite[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as DMInvite));
      setReceivedInvites(invites);
    });

    // Sent invites
    const sentQuery = query(
      collection(db, 'dm_invites'),
      where('fromUserId', '==', user.id),
      where('status', '==', 'pending')
    );

    const unsubSent = onSnapshot(sentQuery, (snapshot) => {
      const invites: DMInvite[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as DMInvite));
      setSentInvites(invites);
    });

    return () => {
      unsubReceived();
      unsubSent();
    };
  }, [user?.id]);

  const getOtherUser = (conversation: Conversation) => {
    const otherUserId = conversation.participants.find(id => id !== user?.id);
    return otherUserId ? conversation.participantDetails[otherUserId] : null;
  };

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

  const handleAcceptInvite = async (invite: DMInvite) => {
    try {
      // Check if conversation already exists
      const convQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user!.id)
      );
      const convSnapshot = await getDocs(convQuery);
      const existingConv = convSnapshot.docs.find(doc => 
        doc.data().participants.includes(invite.fromUserId)
      );

      if (existingConv) {
        Alert.alert('Info', 'Conversation already exists');
        return;
      }

      // Create conversation
      const participantDetails: any = {};
      participantDetails[invite.fromUserId] = invite.fromUserDetails;
      participantDetails[user!.id] = invite.toUserDetails;

      await addDoc(collection(db, 'conversations'), {
        participants: [invite.fromUserId, user!.id],
        participantDetails,
        lastMessage: '',
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update invite status
      await updateDoc(doc(db, 'dm_invites', invite.id), {
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Success', `You can now message ${invite.fromUserDetails.name}`);
      setActiveTab('messages');
    } catch (error) {
      logger.error('Error accepting invite:', error);
      Alert.alert('Error', 'Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (invite: DMInvite) => {
    Alert.alert(
      'Decline Invite',
      `Decline message request from ${invite.fromUserDetails.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'dm_invites', invite.id), {
                status: 'declined',
                updatedAt: serverTimestamp(),
              });
            } catch (error) {
              logger.error('Error declining invite:', error);
              Alert.alert('Error', 'Failed to decline invite');
            }
          },
        },
      ]
    );
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherUser = getOtherUser(item);
    if (!otherUser) return null;

    const isDifferentOrg = otherUser.organizationId !== user?.organizationId;
    const isFromMe = item.lastMessageSenderId === user?.id;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('DirectMessageChat', { 
          conversationId: item.id,
          otherUser: otherUser 
        })}
      >
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="account-circle" size={50} color={theme.colors.gray} />
          {isDifferentOrg && (
            <View style={styles.orgBadge}>
              <MaterialCommunityIcons name="office-building" size={12} color={theme.colors.white} />
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName}>{otherUser.name}</Text>
            <Text style={styles.timestamp}>{getTimeAgo(item.lastMessageTimestamp)}</Text>
          </View>
          
          {otherUser.organizationName && (
            <Text style={styles.organizationName}>{otherUser.organizationName}</Text>
          )}
          
          <Text style={styles.lastMessage} numberOfLines={1}>
            {isFromMe ? 'You: ' : ''}{item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderInvite = ({ item, type }: { item: DMInvite; type: 'received' | 'sent' }) => {
    const otherUser = type === 'received' ? item.fromUserDetails : item.toUserDetails;
    const isDifferentOrg = otherUser.organizationId !== user?.organizationId;

    return (
      <View style={styles.inviteItem}>
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="account-circle" size={50} color={theme.colors.gray} />
          {isDifferentOrg && (
            <View style={styles.orgBadge}>
              <MaterialCommunityIcons name="office-building" size={12} color={theme.colors.white} />
            </View>
          )}
        </View>

        <View style={styles.inviteContent}>
          <Text style={styles.userName}>{otherUser.name}</Text>
          {otherUser.organizationName && (
            <Text style={styles.organizationName}>{otherUser.organizationName}</Text>
          )}
          <Text style={styles.inviteTime}>{getTimeAgo(item.createdAt)}</Text>
        </View>

        {type === 'received' ? (
          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptInvite(item)}
            >
              <MaterialCommunityIcons name="check" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDeclineInvite(item)}
            >
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Sent</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={() => navigation.navigate('UserDirectory')}
        >
          <MaterialCommunityIcons name="message-plus" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            Messages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'invites' && styles.activeTab]}
          onPress={() => setActiveTab('invites')}
        >
          <Text style={[styles.tabText, activeTab === 'invites' && styles.activeTabText]}>
            Invites
            {(receivedInvites.length + sentInvites.length) > 0 && (
              <Text style={styles.inviteBadge}> {receivedInvites.length + sentInvites.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'messages' ? (
        conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="message-text-outline" size={80} color={theme.colors.gray} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation with anyone in the security network
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => navigation.navigate('UserDirectory')}
            >
              <MaterialCommunityIcons name="account-search" size={20} color={theme.colors.white} />
              <Text style={styles.startButtonText}>Find Users</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.conversationList}
          />
        )
      ) : (
        <View style={styles.invitesContainer}>
          {receivedInvites.length > 0 && (
            <View>
              <Text style={styles.invitesSectionTitle}>RECEIVED</Text>
              <FlatList
                data={receivedInvites}
                renderItem={({ item }) => renderInvite({ item, type: 'received' })}
                keyExtractor={item => item.id}
              />
            </View>
          )}
          
          {sentInvites.length > 0 && (
            <View style={{ marginTop: receivedInvites.length > 0 ? 20 : 0 }}>
              <Text style={styles.invitesSectionTitle}>SENT</Text>
              <FlatList
                data={sentInvites}
                renderItem={({ item }) => renderInvite({ item, type: 'sent' })}
                keyExtractor={item => item.id}
              />
            </View>
          )}

          {receivedInvites.length === 0 && sentInvites.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-multiple-outline" size={80} color={theme.colors.gray} />
              <Text style={styles.emptyTitle}>No invites</Text>
              <Text style={styles.emptySubtext}>
                Find users to send message requests
              </Text>
            </View>
          )}
        </View>
      )}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  newMessageButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationList: {
    paddingVertical: theme.spacing.s,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
    backgroundColor: theme.colors.white,
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
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  organizationName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.m,
    marginBottom: theme.spacing.s,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.l,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: 8,
    gap: 8,
  },
  startButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceDark,
    backgroundColor: theme.colors.white,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray,
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  inviteBadge: {
    color: theme.colors.danger,
    fontWeight: 'bold',
  },
  invitesContainer: {
    flex: 1,
    padding: theme.spacing.m,
  },
  invitesSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  inviteItem: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    marginBottom: theme.spacing.s,
    alignItems: 'center',
  },
  inviteContent: {
    flex: 1,
  },
  inviteTime: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: theme.colors.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: theme.colors.danger,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBadge: {
    backgroundColor: theme.colors.gray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
