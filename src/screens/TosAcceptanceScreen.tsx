import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';

export const TosAcceptanceScreen = () => {
    const [accepted, setAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user, refreshProfile } = useAuth();

    const handleAccept = async () => {
        if (!accepted || !user) return;

        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', user.id);
            await updateDoc(userDocRef, {
                tos_accepted_at: new Date().toISOString(),
            });
            await refreshProfile();
        } catch (error: any) {
            logger.error('Error accepting TOS:', error);
            // If updateDoc fails (e.g. doc not found), try setDoc with merge
            if (error?.code === 'not-found') {
                try {
                    const userDocRef = doc(db, 'users', user.id);
                    await setDoc(userDocRef, {
                        tos_accepted_at: new Date().toISOString(),
                    }, { merge: true });
                    await refreshProfile();
                    return;
                } catch (retryError) {
                    logger.error('Retry error:', retryError);
                }
            }
            Alert.alert(
                'Error',
                'Unable to accept Terms of Service. Please check your connection and try again.',
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="shield-lock" size={64} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>TERMS OF SERVICE UPDATE</Text>
            <Text style={styles.subtitle}>
                Please review and accept our updated Terms of Service and Privacy Policy to continue using HolyGuard.
            </Text>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Key Points</Text>

                <View style={styles.bulletRow}>
                    <MaterialCommunityIcons name="shield-check" size={20} color={theme.colors.primary} />
                    <Text style={styles.bulletText}>
                        HolyGuard is exclusively for authorized security team members designated by their organization.
                    </Text>
                </View>

                <View style={styles.bulletRow}>
                    <MaterialCommunityIcons name="account-check" size={20} color={theme.colors.primary} />
                    <Text style={styles.bulletText}>
                        Organizations must certify that all members have passed appropriate background checks.
                    </Text>
                </View>

                <View style={styles.bulletRow}>
                    <MaterialCommunityIcons name="gavel" size={20} color={theme.colors.primary} />
                    <Text style={styles.bulletText}>
                        Misuse of the platform may result in immediate termination and legal action.
                    </Text>
                </View>

                <View style={styles.bulletRow}>
                    <MaterialCommunityIcons name="phone-alert" size={20} color={theme.colors.primary} />
                    <Text style={styles.bulletText}>
                        HolyGuard does not replace 911. Always call emergency services first.
                    </Text>
                </View>
            </View>

            <View style={styles.linkRow}>
                <TouchableOpacity onPress={() => Linking.openURL('https://atmksheldon.github.io/holyguard/terms.html')}>
                    <Text style={styles.docLink}>Read Full Terms of Service</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL('https://atmksheldon.github.io/holyguard/privacy.html')}>
                    <Text style={styles.docLink}>Read Privacy Policy</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.tosRow}
                onPress={() => setAccepted(!accepted)}
                activeOpacity={0.7}
            >
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                    {accepted && (
                        <MaterialCommunityIcons name="check" size={16} color={theme.colors.white} />
                    )}
                </View>
                <Text style={styles.tosText}>
                    I have read and agree to the{' '}
                    <Text style={styles.tosLink}>Terms of Service</Text>
                    {' '}and{' '}
                    <Text style={styles.tosLink}>Privacy Policy</Text>
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, !accepted && styles.buttonDisabled]}
                onPress={handleAccept}
                disabled={loading || !accepted}
            >
                {loading ? (
                    <ActivityIndicator color={theme.colors.white} />
                ) : (
                    <Text style={styles.buttonText}>CONTINUE</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.l,
        justifyContent: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 10,
    },
    card: {
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 12,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bulletText: {
        flex: 1,
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginLeft: 10,
        lineHeight: 18,
    },
    linkRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 24,
    },
    docLink: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    tosRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: theme.colors.surfaceDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        marginTop: 1,
    },
    checkboxChecked: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    tosText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
    },
    tosLink: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: theme.colors.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
});
