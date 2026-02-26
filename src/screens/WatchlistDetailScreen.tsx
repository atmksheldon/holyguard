import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert as RNAlert, Dimensions, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../config/firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { WatchlistEntry } from '../types';
import { WATCHLIST_STATUSES, WATCHLIST_STATUS_COLORS } from '../constants/categories';

const { width: screenWidth } = Dimensions.get('window');

export const WatchlistDetailScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const { entryId } = route.params;
  const [entry, setEntry] = useState<WatchlistEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editLicensePlate, setEditLicensePlate] = useState('');
  const [editPhysicalDescription, setEditPhysicalDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'resolved' | 'monitoring'>('active');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editNewPhotos, setEditNewPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = user && entry && (
    user.id === entry.createdBy || user.role === 'admin'
  );

  useEffect(() => {
    const fetchEntry = async () => {
      try {
        const docRef = await getDoc(doc(db, 'watchlist', entryId));
        if (docRef.exists()) {
          const data = docRef.data();
          const ts = data.createdAt?.toDate();
          setEntry({
            id: docRef.id,
            name: data.name || '',
            licensePlate: data.licensePlate,
            physicalDescription: data.physicalDescription,
            status: data.status || 'active',
            date: ts ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
            location: data.location,
            latitude: data.latitude,
            longitude: data.longitude,
            imageUrls: data.imageUrls || [],
            organizationId: data.organizationId,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            linkedAlertId: data.linkedAlertId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            notes: data.notes,
          });
        }
      } catch (error) {
        console.error('Error fetching watchlist entry:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEntry();
  }, [entryId]);

  const openEditModal = () => {
    if (!entry) return;
    setEditName(entry.name);
    setEditLicensePlate(entry.licensePlate || '');
    setEditPhysicalDescription(entry.physicalDescription || '');
    setEditStatus(entry.status);
    setEditLocation(entry.location || '');
    setEditNotes(entry.notes || '');
    setEditNewPhotos([]);
    setEditModalVisible(true);
  };

  const handleAddEditPhoto = async () => {
    try {
      const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permStatus !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setEditNewPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error adding photo:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!entry || !user || !editName.trim()) return;
    setIsSaving(true);
    try {
      const uploadedUrls: string[] = [];
      for (const uri of editNewPhotos) {
        const response = await fetch(uri);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/') || blob.size > 5 * 1024 * 1024) continue;
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        const storageRef = ref(storage, `watchlist/${Date.now()}_${filename}`);
        await uploadBytes(storageRef, blob);
        uploadedUrls.push(await getDownloadURL(storageRef));
      }

      const allImageUrls = [...entry.imageUrls, ...uploadedUrls];

      await updateDoc(doc(db, 'watchlist', entry.id), {
        name: editName.trim(),
        licensePlate: editLicensePlate.trim() || null,
        physicalDescription: editPhysicalDescription.trim() || null,
        status: editStatus,
        location: editLocation.trim() || null,
        notes: editNotes.trim() || null,
        imageUrls: allImageUrls,
        updatedAt: serverTimestamp(),
      });

      // Refresh local state
      setEntry(prev => prev ? {
        ...prev,
        name: editName.trim(),
        licensePlate: editLicensePlate.trim() || undefined,
        physicalDescription: editPhysicalDescription.trim() || undefined,
        status: editStatus,
        location: editLocation.trim() || undefined,
        notes: editNotes.trim() || undefined,
        imageUrls: allImageUrls,
      } : null);

      setEditModalVisible(false);
    } catch (error) {
      console.error('Error updating entry:', error);
      RNAlert.alert('Error', 'Failed to update entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    RNAlert.alert('Delete Entry', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'watchlist', entryId));
            navigation.goBack();
          } catch (error) {
            RNAlert.alert('Error', 'Failed to delete entry.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Entry Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = WATCHLIST_STATUS_COLORS[entry.status] || theme.colors.gray;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WATCHLIST DETAIL</Text>
        <View style={styles.headerActions}>
          {canEdit && (
            <TouchableOpacity onPress={openEditModal} style={styles.headerButton}>
              <MaterialCommunityIcons name="pencil" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <MaterialCommunityIcons name="trash-can" size={22} color={theme.colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo Gallery */}
        {entry.imageUrls.length > 0 && (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                setActivePhotoIndex(index);
              }}
            >
              {entry.imageUrls.map((uri, index) => (
                <Image key={index} source={{ uri }} style={styles.photo} resizeMode="cover" />
              ))}
            </ScrollView>
            {entry.imageUrls.length > 1 && (
              <View style={styles.photoIndicator}>
                {entry.imageUrls.map((_, index) => (
                  <View key={index} style={[styles.dot, index === activePhotoIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.content}>
          {/* Name & Status */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{entry.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{entry.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Details */}
          {entry.licensePlate && (
            <View style={styles.detailCard}>
              <MaterialCommunityIcons name="car" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.detailLabel}>LICENSE PLATE</Text>
                <Text style={styles.detailValue}>{entry.licensePlate}</Text>
              </View>
            </View>
          )}

          {entry.physicalDescription && (
            <View style={styles.detailCard}>
              <MaterialCommunityIcons name="account-details" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>PHYSICAL DESCRIPTION</Text>
                <Text style={styles.detailValue}>{entry.physicalDescription}</Text>
              </View>
            </View>
          )}

          {entry.location && (
            <View style={styles.detailCard}>
              <MaterialCommunityIcons name="map-marker" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>LOCATION</Text>
                <Text style={styles.detailValue}>{entry.location}</Text>
              </View>
            </View>
          )}

          {entry.notes && (
            <View style={styles.detailCard}>
              <MaterialCommunityIcons name="note-text" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>NOTES</Text>
                <Text style={styles.detailValue}>{entry.notes}</Text>
              </View>
            </View>
          )}

          {/* Meta */}
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>Created: {entry.date}</Text>
            </View>
            {entry.createdByName && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="account" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>By: {entry.createdByName}</Text>
              </View>
            )}
            {entry.linkedAlertId && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="link" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.metaText, { color: theme.colors.primary }]}>Linked to incident</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editOverlay}>
          <View style={styles.editModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>EDIT ENTRY</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Add photos */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {entry.imageUrls.map((uri, i) => (
                  <Image key={`ex-${i}`} source={{ uri }} style={styles.editThumb} />
                ))}
                {editNewPhotos.map((uri, i) => (
                  <View key={`new-${i}`} style={{ position: 'relative', marginRight: 8 }}>
                    <Image source={{ uri }} style={styles.editThumb} />
                    <TouchableOpacity
                      style={styles.editRemovePhoto}
                      onPress={() => setEditNewPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.editAddPhoto} onPress={handleAddEditPhoto}>
                  <MaterialCommunityIcons name="camera-plus" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              </ScrollView>

              <Text style={styles.editLabel}>Name *</Text>
              <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} editable={!isSaving} />

              <Text style={styles.editLabel}>License Plate</Text>
              <TextInput style={styles.editInput} value={editLicensePlate} onChangeText={setEditLicensePlate} autoCapitalize="characters" editable={!isSaving} />

              <Text style={styles.editLabel}>Physical Description</Text>
              <TextInput style={[styles.editInput, { minHeight: 60 }]} value={editPhysicalDescription} onChangeText={setEditPhysicalDescription} multiline editable={!isSaving} />

              <Text style={styles.editLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {WATCHLIST_STATUSES.map(s => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.editStatusChip, editStatus === s.value && { backgroundColor: s.color }]}
                    onPress={() => setEditStatus(s.value)}
                  >
                    <Text style={[styles.editStatusText, editStatus === s.value && { color: '#fff' }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.editLabel}>Location</Text>
              <TextInput style={styles.editInput} value={editLocation} onChangeText={setEditLocation} editable={!isSaving} />

              <Text style={styles.editLabel}>Notes</Text>
              <TextInput style={[styles.editInput, { minHeight: 60 }]} value={editNotes} onChangeText={setEditNotes} multiline editable={!isSaving} />

              <TouchableOpacity
                style={[styles.editSaveButton, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={isSaving || !editName.trim()}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.editSaveText}>SAVE CHANGES</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
  },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: 1, flex: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { padding: 4 },
  photo: { width: screenWidth, height: 280, backgroundColor: theme.colors.surfaceDark },
  photoIndicator: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.gray },
  dotActive: { backgroundColor: theme.colors.primary, width: 20 },
  content: { padding: theme.spacing.l },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.m },
  name: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textPrimary, flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: theme.colors.white, letterSpacing: 0.5 },
  detailCard: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: theme.spacing.s,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  detailLabel: { fontSize: 11, fontWeight: 'bold', color: theme.colors.textSecondary, letterSpacing: 1, marginBottom: 2 },
  detailValue: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 20 },
  metaSection: { marginTop: theme.spacing.m, paddingTop: theme.spacing.m, borderTopWidth: 1, borderTopColor: theme.colors.surfaceDark },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaText: { fontSize: 13, color: theme.colors.textSecondary },
  // Edit Modal
  editOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  editModal: { backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: theme.spacing.l, maxHeight: '85%' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.m },
  editTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.primary, letterSpacing: 1 },
  editThumb: { width: 70, height: 70, borderRadius: 8, backgroundColor: theme.colors.surfaceDark, marginRight: 8 },
  editRemovePhoto: { position: 'absolute', top: -6, right: -2, backgroundColor: theme.colors.white, borderRadius: 10 },
  editAddPhoto: { width: 70, height: 70, borderRadius: 8, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surface },
  editLabel: { fontSize: 13, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 4 },
  editInput: { backgroundColor: theme.colors.white, borderRadius: 8, padding: 12, fontSize: 15, color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.surfaceDark, marginBottom: 12 },
  editStatusChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.surfaceDark },
  editStatusText: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  editSaveButton: { backgroundColor: theme.colors.primary, padding: theme.spacing.m, borderRadius: 8, alignItems: 'center', marginTop: 8, marginBottom: theme.spacing.m },
  editSaveText: { color: theme.colors.white, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});
