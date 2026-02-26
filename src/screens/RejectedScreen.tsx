import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const RejectedScreen = () => {
    const { user, logout } = useAuth();
    const [rejectionReason, setRejectionReason] = useState<string>('');

    useEffect(() => {
        const loadRejectionReason = async () => {
            if (!user?.organizationId || user.organizationId === 'default-org') return;

            const orgsQuery = query(collection(db, 'organizations'), where('id', '==', user.organizationId));
            const orgSnapshot = await getDocs(orgsQuery);
            if (!orgSnapshot.empty) {
                const orgData = orgSnapshot.docs[0].data();
                setRejectionReason(orgData.rejectionReason || '');
            }
        };

        loadRejectionReason();
    }, [user?.organizationId]);

    const handleContactSupport = () => {
        Linking.openURL('mailto:support@holyguardapp.com?subject=Organization%20Review%20Appeal');
    };

    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="shield-off-outline" size={80} color={theme.colors.verificationRejected} />

            <Text style={styles.title}>ORGANIZATION NOT APPROVED</Text>

            <Text style={styles.message}>
                Your organization{user?.organizationName ? ` "${user.organizationName}"` : ''} did not pass verification.
            </Text>

            {rejectionReason ? (
                <View style={styles.reasonCard}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText}>{rejectionReason}</Text>
                </View>
            ) : null}

            <Text style={styles.instruction}>
                If you believe this is an error, please contact our support team to appeal this decision.
            </Text>

            <TouchableOpacity style={styles.contactButton} onPress={handleContactSupport}>
                <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.contactButtonText}>CONTACT SUPPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.l,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        marginTop: 20,
        letterSpacing: 1,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginTop: 12,
        textAlign: 'center',
    },
    reasonCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.colors.verificationRejected,
        marginTop: 20,
    },
    reasonLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: theme.colors.verificationRejected,
        marginBottom: 6,
    },
    reasonText: {
        fontSize: 15,
        color: theme.colors.textPrimary,
        lineHeight: 22,
    },
    instruction: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 30,
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    contactButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    contactButtonText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    logoutButton: {
        marginTop: 20,
    },
    logoutText: {
        color: theme.colors.textSecondary,
        textDecorationLine: 'underline',
    },
});
