import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { Alert } from '../types';
import { INCIDENT_CATEGORY_COLORS, INCIDENT_CATEGORIES, ALERT_LEVEL_COLORS } from '../constants/categories';

interface AlertCardProps {
    alert: Alert;
    onPress?: () => void;
    onDelete?: () => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onPress, onDelete }) => {
    const swipeableRef = useRef<Swipeable>(null);

    const getCategoryInfo = (category?: string) => {
        if (!category) return null;
        const cat = INCIDENT_CATEGORIES.find(c => c.value === category);
        return cat || null;
    };

    const categoryInfo = getCategoryInfo(alert.category);
    const photoCount = alert.imageUrls?.length || (alert.imageUrl ? 1 : 0);
    const level = alert.alertLevel || 'yellow';
    const levelColor = ALERT_LEVEL_COLORS[level];
    const isRedAlert = level === 'red';

    const getIconName = (type: Alert['type']) => {
        switch (type) {
            case 'alert': return 'alert-circle';
            case 'warning': return 'alert-octagon';
            case 'info': return 'information';
            default: return 'bell';
        }
    };

    const getIconColor = (type: Alert['type']) => {
        switch (type) {
            case 'alert': return theme.colors.error;
            case 'warning': return theme.colors.warning;
            case 'info': return theme.colors.primary;
            default: return theme.colors.textSecondary;
        }
    };

    const renderRightActions = () => (
        <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
                swipeableRef.current?.close();
                onDelete?.();
            }}
        >
            <MaterialCommunityIcons name="trash-can" size={28} color="white" />
        </TouchableOpacity>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
        >
            <TouchableOpacity style={[styles.container, { borderLeftColor: levelColor }, isRedAlert && styles.redAlertContainer]} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.iconContainer}>
                 <MaterialCommunityIcons
                    name={getIconName(alert.type)}
                    size={28}
                    color={getIconColor(alert.type)}
                />
            </View>
            <View style={styles.contentContainer}>
                <View style={styles.headerRow}>
                    <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
                    <Text style={styles.time}>{alert.timestamp}</Text>
                </View>
                <View style={styles.metaRow}>
                    <View style={[styles.alertLevelBadge, { backgroundColor: levelColor }]}>
                        <MaterialCommunityIcons
                            name={isRedAlert ? 'alert-octagon' : 'eye-outline'}
                            size={10}
                            color={theme.colors.white}
                            style={{ marginRight: 3 }}
                        />
                        <Text style={styles.alertLevelBadgeText}>
                            {isRedAlert ? 'RED' : 'YELLOW'}
                        </Text>
                    </View>
                    {categoryInfo && (
                        <View style={[styles.categoryBadge, { backgroundColor: categoryInfo.color }]}>
                            <MaterialCommunityIcons name={categoryInfo.icon as any} size={12} color={theme.colors.white} style={{ marginRight: 3 }} />
                            <Text style={styles.categoryBadgeText}>{categoryInfo.label}</Text>
                        </View>
                    )}
                    {photoCount > 1 && (
                        <View style={styles.photoCountBadge}>
                            <MaterialCommunityIcons name="camera" size={12} color={theme.colors.textSecondary} style={{ marginRight: 2 }} />
                            <Text style={styles.photoCountText}>{photoCount}</Text>
                        </View>
                    )}
                </View>
            </View>
            </TouchableOpacity>
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: theme.spacing.m,
        alignItems: 'center',
        marginBottom: theme.spacing.s,

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,

        borderLeftWidth: 4,
        borderLeftColor: theme.colors.surfaceDark,
    },
    iconContainer: {
        marginRight: theme.spacing.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    time: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.white,
    },
    photoCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    photoCountText: {
        fontSize: 11,
        color: theme.colors.textSecondary,
    },
    redAlertContainer: {
        borderLeftWidth: 5,
        backgroundColor: '#FFF5F5',
    },
    alertLevelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    alertLevelBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: theme.colors.white,
        letterSpacing: 0.5,
    },
    deleteButton: {
        backgroundColor: theme.colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        borderRadius: 12,
        marginBottom: theme.spacing.s,
    }
});
