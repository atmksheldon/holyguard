import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';

export const SubscriptionExpiredScreen = () => {
    const { user, logout, refreshProfile } = useAuth();

    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="shield-off-outline" size={64} color={theme.colors.surfaceDark} />

            <Text style={styles.title}>SUBSCRIPTION EXPIRED</Text>

            <Text style={styles.message}>
                Your organization's subscription has expired. Please contact your administrator to renew the subscription.
            </Text>

            {user?.organizationName && (
                <View style={styles.orgCard}>
                    <MaterialCommunityIcons name="church" size={24} color={theme.colors.primary} />
                    <Text style={styles.orgName}>{user.organizationName}</Text>
                </View>
            )}

            <TouchableOpacity style={styles.refreshButton} onPress={refreshProfile}>
                <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.primary} />
                <Text style={styles.refreshText}>Check Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.l,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
        marginTop: 20,
        marginBottom: 12,
    },
    message: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    orgCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.white,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: 24,
    },
    orgName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginLeft: 10,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        marginBottom: 16,
    },
    refreshText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
        marginLeft: 8,
    },
    logoutButton: {
        paddingVertical: 12,
    },
    logoutText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
});
