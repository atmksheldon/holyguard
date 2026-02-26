import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, FlatList } from 'react-native';
import { theme } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { INCIDENT_CATEGORIES, INCIDENT_CATEGORY_COLORS, ALERT_LEVELS, ALERT_LEVEL_COLORS } from '../constants/categories';

interface IncidentReportModalProps {
    visible: boolean;
    photoUri: string | null;
    onClose: () => void;
    onSubmit: (description: string, addToWatchlist: boolean, category: string, allPhotoUris: string[], alertLevel: 'yellow' | 'red') => void;
    isSubmitting: boolean;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
    visible,
    photoUri,
    onClose,
    onSubmit,
    isSubmitting
}) => {
    const [description, setDescription] = useState('');
    const [addToWatchlist, setAddToWatchlist] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [alertLevel, setAlertLevel] = useState<'yellow' | 'red' | null>(null);
    const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);

    const allPhotos = [
        ...(photoUri ? [photoUri] : []),
        ...additionalPhotos,
    ];

    const handleSubmit = () => {
        if (description.trim().length === 0 || !selectedCategory || !alertLevel) return;
        onSubmit(description, addToWatchlist, selectedCategory, allPhotos, alertLevel);
        setDescription('');
        setAddToWatchlist(false);
        setSelectedCategory('');
        setAlertLevel(null);
        setAdditionalPhotos([]);
    };

    const handleAddPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setAdditionalPhotos(prev => [...prev, result.assets[0].uri]);
            }
        } catch (error) {
            console.error('Error adding photo:', error);
        }
    };

    const handleRemovePhoto = (index: number) => {
        // Index 0 is the original photo, don't allow removing it
        if (photoUri && index === 0) return;
        const additionalIndex = photoUri ? index - 1 : index;
        setAdditionalPhotos(prev => prev.filter((_, i) => i !== additionalIndex));
    };

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
                            <Text style={styles.modalTitle}>REPORT THREAT</Text>
                            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
                                <MaterialCommunityIcons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Alert Level Selector */}
                        <Text style={styles.label}>Alert Level:</Text>
                        <View style={styles.alertLevelRow}>
                            {ALERT_LEVELS.map((level) => {
                                const isSelected = alertLevel === level.value;
                                const color = ALERT_LEVEL_COLORS[level.value];
                                return (
                                    <TouchableOpacity
                                        key={level.value}
                                        style={[
                                            styles.alertLevelButton,
                                            { borderColor: color },
                                            isSelected && { backgroundColor: color },
                                        ]}
                                        onPress={() => setAlertLevel(level.value)}
                                        disabled={isSubmitting}
                                    >
                                        <MaterialCommunityIcons
                                            name={level.icon as any}
                                            size={24}
                                            color={isSelected ? theme.colors.white : color}
                                        />
                                        <Text style={[
                                            styles.alertLevelTitle,
                                            { color: isSelected ? theme.colors.white : color },
                                        ]}>
                                            {level.label}
                                        </Text>
                                        <Text style={[
                                            styles.alertLevelSubtitle,
                                            { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary },
                                        ]}>
                                            {level.subtitle}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Photo Gallery */}
                        {allPhotos.length > 0 && (
                            <View style={styles.photoSection}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                                    {allPhotos.map((uri, index) => (
                                        <View key={index} style={styles.photoThumbnailContainer}>
                                            <Image source={{ uri }} style={styles.photoThumbnail} />
                                            {(index > 0 || !photoUri) && (
                                                <TouchableOpacity
                                                    style={styles.removePhotoButton}
                                                    onPress={() => handleRemovePhoto(index)}
                                                    disabled={isSubmitting}
                                                >
                                                    <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.danger} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        style={styles.addPhotoButton}
                                        onPress={handleAddPhoto}
                                        disabled={isSubmitting}
                                    >
                                        <MaterialCommunityIcons name="camera-plus" size={28} color={theme.colors.primary} />
                                        <Text style={styles.addPhotoText}>Add Photo</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                                <Text style={styles.photoCount}>{allPhotos.length} photo{allPhotos.length !== 1 ? 's' : ''}</Text>
                            </View>
                        )}

                        {/* Incident Category */}
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
                                    disabled={isSubmitting}
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

                        <Text style={styles.label}>Describe the Incident:</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Suspicious individual near north entrance..."
                            placeholderTextColor={theme.colors.gray}
                            multiline
                            numberOfLines={3}
                            value={description}
                            onChangeText={setDescription}
                            editable={!isSubmitting}
                        />

                        <TouchableOpacity
                            style={styles.watchlistContainer}
                            onPress={() => setAddToWatchlist(!addToWatchlist)}
                            disabled={isSubmitting}
                        >
                            <View style={[styles.checkbox, addToWatchlist && styles.checkboxChecked]}>
                                {addToWatchlist && (
                                    <MaterialCommunityIcons name="check" size={18} color={theme.colors.white} />
                                )}
                            </View>
                            <View style={styles.watchlistTextContainer}>
                                <Text style={styles.watchlistLabel}>Add to Watchlist</Text>
                                <Text style={styles.watchlistSubtext}>Post to #watchlist channel & create watchlist entry</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.emergencyReminder}>
                            <MaterialCommunityIcons name="phone-alert" size={14} color={theme.colors.danger} style={{ marginRight: 6 }} />
                            <Text style={styles.emergencyReminderText}>
                                In a life-threatening emergency, <Text style={{ fontWeight: 'bold' }}>call 911 first</Text>.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitButton, (isSubmitting || !selectedCategory || !alertLevel) && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={isSubmitting || description.trim().length === 0 || !selectedCategory || !alertLevel}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color={theme.colors.white} />
                            ) : (
                                <Text style={styles.submitButtonText}>SEND ALERT</Text>
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
        color: theme.colors.danger,
        letterSpacing: 1,
    },
    photoSection: {
        marginBottom: theme.spacing.m,
    },
    photoScroll: {
        flexDirection: 'row',
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
    alertLevelRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: theme.spacing.m,
    },
    alertLevelButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 2,
        backgroundColor: theme.colors.surface,
    },
    alertLevelTitle: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginTop: 6,
    },
    alertLevelSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
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
        minHeight: 80,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: theme.spacing.m,
    },
    submitButton: {
        backgroundColor: theme.colors.danger,
        padding: theme.spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: theme.colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        marginBottom: theme.spacing.m,
    },
    disabledButton: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: theme.colors.white,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    watchlistContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: 8,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.m,
    },
    checkboxChecked: {
        backgroundColor: theme.colors.primary,
    },
    watchlistTextContainer: {
        flex: 1,
    },
    watchlistLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginBottom: 2,
    },
    watchlistSubtext: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    emergencyReminder: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    emergencyReminderText: {
        fontSize: 12,
        color: theme.colors.danger,
        flex: 1,
    },
});
