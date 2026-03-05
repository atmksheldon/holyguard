import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderOrganizationId: string;
  text: string;
  imageUrl?: string;
  timestamp: Date;
}

interface DirectMessageChatScreenProps {
  navigation: any;
  route: any;
}

export const DirectMessageChatScreen: React.FC<DirectMessageChatScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { conversationId, otherUser } = route.params;
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isDifferentOrg = otherUser.organizationId !== user?.organizationId;

  useEffect(() => {
    if (!conversationId) return;

    const messagesQuery = query(
      collection(db, 'direct_messages'),
      where('conversationId', '==', conversationId)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData: DirectMessage[] = snapshot.docs.map(doc => ({
        id: doc.id,
        conversationId: doc.data().conversationId,
        senderId: doc.data().senderId,
        senderName: doc.data().senderName,
        senderOrganizationId: doc.data().senderOrganizationId,
        text: doc.data().text,
        imageUrl: doc.data().imageUrl,
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
      // Sort by timestamp descending (newest first)
      messagesData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setMessages(messagesData);
    }, (error) => {
      logger.error('Error loading messages:', error);
    });

    return () => unsubscribe();
  }, [conversationId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || sending) return;

    const text = messageText.trim();
    if (text.length > 500) {
      alert('Message is too long. Maximum 500 characters.');
      return;
    }

    logger.log('[DM] Sending message:', { text, conversationId, userId: user.id });
    setSending(true);
    setMessageText('');

    try {
      // Add message
      logger.log('[DM] Adding message to Firestore...');
      await addDoc(collection(db, 'direct_messages'), {
        conversationId,
        senderId: user.id,
        senderName: user.name,
        senderOrganizationId: user.organizationId,
        text,
        timestamp: serverTimestamp(),
      });

      logger.log('[DM] Message added successfully');
      
      // Update conversation
      logger.log('[DM] Updating conversation...');
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: text,
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: user.id,
        updatedAt: serverTimestamp(),
      });
      
      logger.log('[DM] Conversation updated successfully');

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      logger.error('Error sending message:', error);
      setMessageText(text); // Restore message on error
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async () => {
    if (!user) return;

    Alert.alert(
      'Send Photo',
      'Choose photo source',
      [
        {
          text: 'Camera',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Photo Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          alert('Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.7,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          alert('Photo library permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      alert('Failed to select image. Please try again.');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;

    setUploadingImage(true);

    try {
      // Fetch the image
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference
      const filename = `direct_messages/${conversationId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      // Upload
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      // Send message with image
      await addDoc(collection(db, 'direct_messages'), {
        conversationId,
        senderId: user.id,
        senderName: user.name,
        senderOrganizationId: user.organizationId,
        text: '',
        imageUrl: downloadUrl,
        timestamp: serverTimestamp(),
      });

      // Update conversation
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: '📷 Photo',
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: user.id,
        updatedAt: serverTimestamp(),
      });

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      logger.error('Error uploading image:', error);
      alert('Failed to send photo. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isMyMessage = item.senderId === user?.id;
    const showSenderName = !isMyMessage;

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
        ]}>
          {showSenderName && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          {item.text ? (
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText
            ]}>
              {item.text}
            </Text>
          ) : null}
          <Text style={[
            styles.timestamp,
            isMyMessage ? styles.myTimestamp : styles.theirTimestamp
          ]}>
            {item.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{otherUser.name}</Text>
              {isDifferentOrg && (
                <View style={styles.crossOrgBadge}>
                  <MaterialCommunityIcons name="office-building" size={12} color={theme.colors.white} />
                </View>
              )}
            </View>
            {otherUser.organizationName && (
              <Text style={styles.headerSubtitle}>{otherUser.organizationName}</Text>
            )}
          </View>

          <View style={{ width: 24 }} />
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          extraData={messages}
          inverted
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="message-text-outline" size={60} color={theme.colors.gray} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          {uploadingImage ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.uploadingText}>Sending photo...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.imageButton}
                onPress={handleImagePick}
                disabled={sending}
              >
                <MaterialCommunityIcons
                  name="camera"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.gray}
                multiline
                maxLength={500}
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sending}
              >
                <MaterialCommunityIcons
                  name="send"
                  size={24}
                  color={messageText.trim() && !sending ? theme.colors.white : theme.colors.gray}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: theme.colors.white,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  crossOrgBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: theme.colors.white,
  },
  theirMessageText: {
    color: theme.colors.textPrimary,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  theirTimestamp: {
    color: theme.colors.gray,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    transform: [{ scaleY: -1 }], // Flip back since list is inverted
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceDark,
    backgroundColor: theme.colors.white,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.s,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.surface,
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.s,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  uploadingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadingText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
