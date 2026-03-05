import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  senderName: string;
  senderRole: string;
  timestamp: Date;
  channelId: string;
}

interface Channel {
  id: string;
  name: string;
  organizationId: string;
  isDefault: boolean;
}

export const TeamScreen = ({ navigation, route }: any) => {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [loadingChannel, setLoadingChannel] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Handle channel selection from route params
  useEffect(() => {
    const selectedChannelId = route.params?.selectedChannelId;
    if (selectedChannelId && currentChannel?.id !== selectedChannelId) {
      loadChannelById(selectedChannelId);
    }
  }, [route.params?.selectedChannelId]);

  // Load default channel on mount
  useEffect(() => {
    if (currentChannel) return; // Already have a channel
    if (!user?.organizationId) {
      setLoadingChannel(false); // No org ID, stop loading
      return;
    }
    loadDefaultChannel();
  }, [user?.organizationId, currentChannel]);

  const loadDefaultChannel = async () => {
    logger.log('[TeamScreen] Loading default channel...');
    logger.log('[TeamScreen] User organizationId:', user?.organizationId);
    logger.log('[TeamScreen] User data:', user);
    
    if (!user?.organizationId) {
      logger.log('[TeamScreen] No organizationId found!');
      setLoadingChannel(false);
      return;
    }
    
    try {
      const channelsQuery = query(
        collection(db, 'channels'),
        where('organizationId', '==', user.organizationId),
        where('isDefault', '==', true),
        limit(1)
      );
      
      logger.log('[TeamScreen] Executing query...');
      const snapshot = await getDocs(channelsQuery);
      logger.log('[TeamScreen] Query returned', snapshot.size, 'channels');
      
      if (!snapshot.empty) {
        const channelDoc = snapshot.docs[0];
        const data = channelDoc.data();
        logger.log('[TeamScreen] Found channel:', data.name);
        setCurrentChannel({
          id: channelDoc.id,
          name: data.name,
          organizationId: data.organizationId,
          isDefault: data.isDefault || false,
        });
      } else {
        logger.log('[TeamScreen] No channels found');
      }
    } catch (error) {
      logger.error('[TeamScreen] Error loading default channel:', error);
    } finally {
      logger.log('[TeamScreen] Setting loadingChannel to false');
      setLoadingChannel(false);
    }
  };

  const loadChannelById = async (channelId: string) => {
    try {
      const channelsQuery = query(
        collection(db, 'channels'),
        where('__name__', '==', channelId)
      );
      
      const snapshot = await getDocs(channelsQuery);
      if (!snapshot.empty) {
        const channelDoc = snapshot.docs[0];
        const data = channelDoc.data();
        setCurrentChannel({
          id: channelDoc.id,
          name: data.name,
          organizationId: data.organizationId,
          isDefault: data.isDefault || false,
        });
      }
    } catch (error) {
      logger.error('Error loading channel:', error);
    }
  };

  // Real-time listener for messages
  useEffect(() => {
    if (!user?.organizationId || !currentChannel?.id) return;

    const messagesQuery = query(
      collection(db, 'team_messages'),
      where('organizationId', '==', user.organizationId),
      where('channelId', '==', currentChannel.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messagesData: Message[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            senderName: data.senderName,
            senderRole: data.senderRole,
            timestamp: data.timestamp?.toDate() || new Date(),
            channelId: data.channelId,
          };
        }).reverse(); // Reverse to show oldest first
        
        setMessages(messagesData);
      },
      (error) => {
        logger.error('[TeamScreen] Error listening to messages:', error);
        if (error.message.includes('index')) {
          Alert.alert(
            'Setup Required',
            'A database index is needed. Please contact support.'
          );
        }
      }
    );

    return () => unsubscribe();
  }, [user?.organizationId, currentChannel?.id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !currentChannel?.id) return;
    
    setSending(true);
    try {
      await addDoc(collection(db, 'team_messages'), {
        text: newMessage.trim(),
        senderName: user.name,
        senderRole: user.role,
        senderId: user.id,
        organizationId: user.organizationId,
        channelId: currentChannel.id,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
      Keyboard.dismiss();
      // Auto-scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error: any) {
      logger.error('[TeamScreen] Error sending message:', error);
      Alert.alert('Error', error.message || 'Unable to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => logout()
        }
      ]
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderName === user?.name;
    return (
      <View style={[styles.messageBubble, isOwnMessage && styles.ownMessage]}>
        <View style={styles.messageHeader}>
          <Text style={styles.senderName}>{item.senderName}</Text>
          {item.senderRole && (
            <Text style={styles.senderRole}>{item.senderRole.toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.messageTime}>
          {item.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loadingChannel) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading channel...</Text>
          <TouchableOpacity style={[styles.logoutButton, styles.logoutButtonCentered]} onPress={handleLogout}>
            <Text style={styles.logoutText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentChannel) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No channels available</Text>
          {user?.role === 'admin' ? (
            <>
              <Text style={styles.errorSubtext}>Create your first channel to get started</Text>
              <TouchableOpacity 
                style={[styles.logoutButton, { backgroundColor: theme.colors.primary, marginBottom: 12 }]}
                onPress={() => navigation.navigate('ChannelManagement', { currentChannelId: null })}
              >
                <Text style={styles.logoutText}>CREATE CHANNEL</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.errorSubtext}>Ask your admin to create a channel</Text>
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={theme.text.header}>Team Comms</Text>
            {currentChannel && (
              <TouchableOpacity 
                style={styles.channelSelector}
                onPress={() => navigation.navigate('ChannelManagement', { currentChannelId: currentChannel.id })}
              >
                <Text style={styles.channelName}>#{currentChannel.name}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerRight}>
            {user?.role === 'admin' && (
              <TouchableOpacity 
                style={styles.inviteButton}
                onPress={() => navigation.navigate('InviteMembers')}
              >
                <MaterialCommunityIcons name="account-plus" size={20} color={theme.colors.white} />
                <Text style={styles.inviteButtonText}>INVITE</Text>
              </TouchableOpacity>
            )}
            {user && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{user.role.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
      
      <View style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.gray}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Text style={styles.sendButtonText}>SEND</Text>
        </TouchableOpacity>
      </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
    paddingTop: theme.spacing.s,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  channelName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginRight: 4,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 6,
  },
  inviteButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  headerBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  headerBadgeText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderRadius: 12,
    padding: theme.spacing.m,
  },
  messagesList: {
    paddingVertical: theme.spacing.s,
  },
  messageBubble: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.m,
    borderRadius: 12,
    marginBottom: theme.spacing.s,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessage: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginRight: 8,
  },
  senderRole: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.gray,
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: theme.colors.gray,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  inputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceDark,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    marginRight: theme.spacing.s,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  sendButtonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  logoutButton: {
    backgroundColor: theme.colors.danger,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
  },
  logoutButtonCentered: {
    marginTop: theme.spacing.l,
    width: 200,
    marginHorizontal: 0,
  },
  logoutText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
  },
  loadingText: {
    marginTop: theme.spacing.m,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
