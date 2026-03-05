import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert as RNAlert, KeyboardAvoidingView, Platform } from 'react-native';
import { logger } from '../utils/logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { WATCHLIST_STATUSES } from '../constants/categories';

export const CreateWatchlistEntryScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const prefill = route?.params || {};

  const [name, setName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState(prefill.prefillDescription || '');
  const [status, setStatus] = useState<'active' | 'resolved' | 'monitoring'>('active');
  const [location, setLocation] = useState(prefill.prefillLocation || '');
  const [notes, setNotes] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>(prefill.prefillImageUrls || []);
  const [isSaving, setIsSaving] = useState(false);

  const linkedAlertId = prefill.linkedAlertId || null;

  const handleAddPhoto = async () => {
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
        setPhotoUris(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      logger.error('Error adding photo:', error);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      RNAlert.alert('Required', 'Name is required.');
      return;
    }
    if (!user) return;

    setIsSaving(true);
    try {
      // Upload photos that are local URIs (not already Firebase URLs)
      const imageUrls: string[] = [];
      for (const uri of photoUris) {
        if (uri.startsWith('https://')) {
          // Already a Firebase URL (from prefill)
          imageUrls.push(uri);
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          if (!blob.type.startsWith('image/') || blob.size > 5 * 1024 * 1024) continue;

          const filename = uri.substring(uri.lastIndexOf('/') + 1);
          const storageRef = ref(storage, `watchlist/${Date.now()}_${filename}`);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        }
      }

      await addDoc(collection(db, 'watchlist'), {
        name: name.trim(),
        licensePlate: licensePlate.trim() || null,
        physicalDescription: physicalDescription.trim() || null,
        status,
        location: location.trim() || null,
        notes: notes.trim() || null,
        imageUrls,
        organizationId: user.organizationId,
        createdBy: user.id,
        createdByName: user.name,
        linkedAlertId,
        createdAt: serverTimestamp(),
      });

      RNAlert.alert('Success', 'Watchlist entry created.');
      navigation.goBack();
    } catch (error) {
      logger.error('Error creating watchlist entry:', error);
      RNAlert.alert('Error', 'Failed to create watchlist entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>NEW WATCHLIST ENTRY</Text>
          </View>

          {linkedAlertId && (
            <View style={styles.linkedBanner}>
              <MaterialCommunityIcons name="link" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.linkedText}>Linked to incident report</Text>
            </View>
          )}

          {/* Photos */}
          <Text style={styles.label}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photoUris.map((uri, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => handleRemovePhoto(index)}
                  disabled={isSaving}
                >
                  <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addPhoto} onPress={handleAddPhoto} disabled={isSaving}>
              <MaterialCommunityIcons name="camera-plus" size={28} color={theme.colors.primary} />
              <Text style={styles.addPhotoLabel}>Add</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Name */}
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Person's name or alias"
            placeholderTextColor={theme.colors.gray}
            value={name}
            onChangeText={setName}
            editable={!isSaving}
          />

          {/* License Plate */}
          <Text style={styles.label}>License Plate</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. ABC-1234"
            placeholderTextColor={theme.colors.gray}
            value={licensePlate}
            onChangeText={setLicensePlate}
            autoCapitalize="characters"
            editable={!isSaving}
          />

          {/* Physical Description */}
          <Text style={styles.label}>Physical Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Height, build, distinguishing features..."
            placeholderTextColor={theme.colors.gray}
            value={physicalDescription}
            onChangeText={setPhysicalDescription}
            multiline
            numberOfLines={3}
            editable={!isSaving}
          />

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            {WATCHLIST_STATUSES.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[
                  styles.statusChip,
                  status === s.value && { backgroundColor: s.color },
                ]}
                onPress={() => setStatus(s.value)}
                disabled={isSaving}
              >
                <Text style={[
                  styles.statusChipText,
                  status === s.value && { color: theme.colors.white },
                ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location */}
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Where was this person seen?"
            placeholderTextColor={theme.colors.gray}
            value={location}
            onChangeText={setLocation}
            editable={!isSaving}
          />

          {/* Notes */}
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Any other relevant information..."
            placeholderTextColor={theme.colors.gray}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            editable={!isSaving}
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, (isSaving || !name.trim()) && styles.disabledButton]}
            onPress={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>CREATE ENTRY</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
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
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  linkedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.m,
    padding: theme.spacing.s,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  linkedText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 6,
    marginHorizontal: theme.spacing.l,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    padding: theme.spacing.m,
    fontSize: 15,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
    marginHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.m,
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  photoRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.m,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceDark,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.white,
    borderRadius: 11,
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  addPhotoLabel: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.m,
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceDark,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: theme.spacing.l,
    marginTop: theme.spacing.s,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
