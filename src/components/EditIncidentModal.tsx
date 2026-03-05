import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Alert as RNAlert } from 'react-native';
import { logger } from '../utils/logger';
import { theme } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../types';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { INCIDENT_CATEGORIES } from '../constants/categories';

interface EditIncidentModalProps {
    visible: boolean;
    alert: Alert | null;
    onClose: () => void;
    onSaved: () => void;
}

export const EditIncidentModal: React.FC<EditIncidentModalProps> = ({
    visible,
    alert,
    onClose,
    onSaved,
}) => {
    const { user } = useAuth();
    const [description, setDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
    const [policeIncidentNumber, setPoliceIncidentNumber] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (alert && visible) {
            setDescription(alert.description || '');
            setSelectedCategory(alert.category || '');
            setPoliceIncidentNumber(alert.policeIncidentNumber || '');
            const photos = alert.imageUrls?.length
                ? [...alert.imageUrls]
                : alert.imageUrl
                    ? [alert.imageUrl]
                    : [];
            setExistingPhotos(photos);
            setNewPhotoUris([]);
        }
    }, [alert, visible]);

    const handleAddPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setNewPhotoUris(prev => [...prev, result.assets[0].uri]);
            }
        } catch (error) {
            logger.error('Error adding photo:', error);
        }
    };

    const handleRemoveNewPhoto = (index: number) => {
        setNewPhotoUris(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!alert || !user) return;
        if (description.trim().length === 0) {
            RNAlert.alert('Error', 'Description cannot be empty.');
            return;
        }

        setIsSaving(true);
        try {
            // Upload new photos
            const uploadedUrls: string[] = [];
            for (const uri of newPhotoUris) {
                const response = await fetch(uri);
                const blob = await response.blob();

                if (!blob.type.startsWith('image/')) continue;
                const maxSize = 5 * 1024 * 1024;
                if (blob.size > maxSize) {
                    RNAlert.alert('File Too Large', 'One or more images exceed the 5MB limit.');
                    setIsSaving(false);
                    return;
                }

                const filename = uri.substring(uri.lastIndexOf('/') + 1);
                const storageRef = ref(storage, `incidents/${Date.now()}_${filename}`);
                await uploadBytes(storageRef, blob);
                const url = await getDownloadURL(storageRef);
                uploadedUrls.push(url);
            }

            const allImageUrls = [...existingPhotos, ...uploadedUrls];

            await updateDoc(doc(db, 'alerts', alert.id), {
                description: description.trim(),
                category: selectedCategory,
                imageUrls: allImageUrls,
                imageUrl: allImageUrls[0] || null,
                policeIncidentNumber: policeIncidentNumber.trim() || null,
                updatedAt: serverTimestamp(),
                updatedBy: user.id,
                updatedByName: user.name,
            });

            onSaved();
            onClose();
        } catch (error) {
            logger.error('Error updating incident:', error);
            RNAlert.alert('Error', 'Failed to update incident. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!alert) return null;

    const allPhotos = [...existingPhotos, ...newPhotoUris];

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.centeredView}
            >
                <View style={styles.modalView}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Text style={styles.modalTitle}>EDIT INCIDENT</Text>
                            <TouchableOpacity onPress={onClose} disabled={isSaving}>
                                <MaterialCommunityIcons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Photo Gallery */}
                        {allPhotos.length > 0 && (
                            <View style={styles.photoSection}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {existingPhotos.map((uri, index) => (
                                        <View key={`existing-${index}`} style={styles.photoThumbnailContainer}>
                                            <Image source={{ uri }} style={styles.photoThumbnail} />
                                        </View>
                                    ))}
                                    {newPhotoUris.map((uri, index) => (
                                        <View key={`new-${index}`} style={styles.photoThumbnailContainer}>
                                            <Image source={{ uri }} style={styles.photoThumbnail} />
                                            <View style={styles.newBadge}>
                                                <Text style={styles.newBadgeText}>NEW</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.removePhotoButton}
                                                onPress={() => handleRemoveNewPhoto(index)}
                                                disabled={isSaving}
                                            >
                                                <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        style={styles.addPhotoButton}
                                        onPress={handleAddPhoto}
                                        disabled={isSaving}
                                    >
                                        <MaterialCommunityIcons name="camera-plus" size={28} color={theme.colors.primary} />
                                        <Text style={styles.addPhotoText}>Add Photo</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                                <Text style={styles.photoCount}>{allPhotos.length} photo{allPhotos.length !== 1 ? 's' : ''}</Text>
                            </View>
                        )}

                        {/* Category Picker */}
                        <Text style={styles.label}>Incident Type:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                            {INCIDENT_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.value}
                                    style={[
                                        styles.categoryChip,
                                        selectedCategory === cat.value && { backgroundColor: cat.color },
                                    ]}
                                    onPress={() => setSelectedCategory(cat.value)}
                                    disabled={isSaving}
                                >
                                    <MaterialCommunityIcons
                                        name={cat.icon as any}
                                        size={16}
                                        color={selectedCategory === cat.value ? theme.colors.white : cat.color}
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text style={[
                                        styles.categoryChipText,
                                        selectedCategory === cat.value && { color: theme.colors.white },
                                    ]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Description */}
                        <Text style={styles.label}>Description:</Text>
                        <TextInput
                            style={styles.input}
                            multiline
                            numberOfLines={4}
                            value={description}
                            onChangeText={setDescription}
                            editable={!isSaving}
                        />

                        {/* Police Incident Number */}
                        <Text style={styles.label}>Police Incident #:</Text>
                        <TextInput
                            style={styles.policeNumberInput}
                            placeholder="Optional — enter if available"
                            placeholderTextColor={theme.colors.gray}
                            value={policeIncidentNumber}
                            onChangeText={setPoliceIncidentNumber}
                            editable={!isSaving}
                        />

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[styles.saveButton, isSaving && styles.disabledButton]}
                            onPress={handleSave}
                            disabled={isSaving || description.trim().length === 0}
                        >
                            {isSaving ? (
                                <ActivityIndicator color={theme.colors.white} />
                            ) : (
                                <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: theme.spacing.l,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: theme.colors.primary,
        letterSpacing: 1,
    },
    photoSection: {
        marginBottom: theme.spacing.m,
    },
    photoThumbnailContainer: {
        position: 'relative',
        marginRight: 8,
    },
    photoThumbnail: {
        width: 100,
        height: 100,
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceDark,
    },
    newBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        backgroundColor: theme.colors.success,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    newBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: theme.colors.white,
    },
    removePhotoButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: theme.colors.white,
        borderRadius: 11,
    },
    addPhotoButton: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
    },
    addPhotoText: {
        fontSize: 11,
        color: theme.colors.primary,
        fontWeight: '600',
        marginTop: 4,
    },
    photoCount: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 8,
    },
    categoryScroll: {
        marginBottom: theme.spacing.m,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textPrimary,
    },
    input: {
        backgroundColor: theme.colors.white,
        borderRadius: 8,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.textPrimary,
        textAlignVertical: 'top',
        minHeight: 100,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: theme.spacing.l,
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: theme.spacing.m,
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
    policeNumberInput: {
        backgroundColor: theme.colors.white,
        borderRadius: 8,
        padding: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.textPrimary,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: theme.spacing.l,
    },
});
