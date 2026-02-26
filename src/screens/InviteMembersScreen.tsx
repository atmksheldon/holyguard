import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    FlatList,
    Share,
} from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getAuth } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

interface InviteCode {
    code: string;
    organizationId: string;
    organizationName?: string;
    role: string;
    createdBy: string;
    createdAt: any;
    expiresAt: any;
    maxUses: number;
    usedCount: number;
    isActive: boolean;
}

export default function InviteMembersScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
    const [loadingCodes, setLoadingCodes] = useState(true);

    useEffect(() => {
        if (!user?.organizationId) return;

        const q = query(
            collection(db, 'invite_codes'),
            where('organizationId', '==', user.organizationId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const codes: InviteCode[] = [];
            snapshot.forEach((doc) => {
                codes.push({ ...doc.data() } as InviteCode);
            });
            setInviteCodes(codes);
            setLoadingCodes(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId]);

    const generateInviteCode = async () => {
        if (!user?.organizationId) {
            Alert.alert('Error', 'Organization information not found');
            return;
        }

        setLoading(true);
        try {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const idToken = await currentUser.getIdToken();
            const response = await fetch(
                'https://us-central1-holyguard-app.cloudfunctions.net/generateInviteCode',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        organizationId: user.organizationId,
                        role: 'member',
                        maxUses: 10,
                        expiresInDays: 30,
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const result = await response.json();
            Alert.alert(
                'Invite Code Generated',
                `Code: ${result.code}\n\nShare this code with new members to join your organization.`,
                [
                    { text: 'Copy', onPress: () => shareCode(result.code) }
                ]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to generate invite code');
        } finally {
            setLoading(false);
        }
    };

    const shareCode = async (code: string) => {
        try {
            await Share.share({
                message: `Join our security network on HolyGuard!\n\nInvite Code: ${code}\n\nDownload HolyGuard and use this code to join our organization.`,
            });
        } catch (error) {
            console.error('Error sharing code:', error);
        }
    };

    const renderInviteCode = ({ item }: { item: InviteCode }) => {
        const isExpired = item.expiresAt && new Date(item.expiresAt.seconds * 1000) < new Date();
        const isMaxedOut = item.usedCount >= item.maxUses;
        const isInactive = !item.isActive || isExpired || isMaxedOut;

        return (
            <View style={[styles.inviteCard, isInactive && styles.inviteCardInactive]}>
                <View style={styles.inviteHeader}>
                    <Text style={styles.inviteCode}>{item.code}</Text>
                    <View style={[
                        styles.statusBadge,
                        isInactive ? styles.statusInactive : styles.statusActive
                    ]}>
                        <Text style={styles.statusText}>
                            {isInactive ? 'INACTIVE' : 'ACTIVE'}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.inviteDetails}>
                    <Text style={styles.inviteDetailText}>
                        Role: <Text style={styles.inviteDetailValue}>{item.role}</Text>
                    </Text>
                    <Text style={styles.inviteDetailText}>
                        Uses: <Text style={styles.inviteDetailValue}>{item.usedCount}/{item.maxUses}</Text>
                    </Text>
                    <Text style={styles.inviteDetailText}>
                        Expires: <Text style={styles.inviteDetailValue}>
                            {item.expiresAt ? new Date(item.expiresAt.seconds * 1000).toLocaleDateString() : 'Never'}
                        </Text>
                    </Text>
                </View>

                {!isInactive && (
                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => shareCode(item.code)}
                    >
                        <Text style={styles.shareButtonText}>SHARE CODE</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>INVITE MEMBERS</Text>
                <Text style={styles.subtitle}>
                    Generate codes for new members to join your organization
                </Text>
            </View>

            <TouchableOpacity
                style={styles.generateButton}
                onPress={generateInviteCode}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={theme.colors.white} />
                ) : (
                    <Text style={styles.generateButtonText}>+ GENERATE NEW CODE</Text>
                )}
            </TouchableOpacity>

            <View style={styles.codesSection}>
                <Text style={styles.sectionTitle}>ACTIVE INVITE CODES</Text>
                {loadingCodes ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
                ) : inviteCodes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            No invite codes yet. Generate one to invite members!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={inviteCodes}
                        renderItem={renderInviteCode}
                        keyExtractor={(item) => item.code}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        padding: theme.spacing.l,
        paddingTop: 60,
        backgroundColor: theme.colors.white,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceDark,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 8,
    },
    generateButton: {
        backgroundColor: theme.colors.primary,
        margin: theme.spacing.l,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    generateButtonText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    codesSection: {
        flex: 1,
        padding: theme.spacing.l,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 20,
    },
    inviteCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
    },
    inviteCardInactive: {
        opacity: 0.6,
        backgroundColor: '#f5f5f5',
    },
    inviteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    inviteCode: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        letterSpacing: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusActive: {
        backgroundColor: '#e6f7e6',
    },
    statusInactive: {
        backgroundColor: '#ffe6e6',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    inviteDetails: {
        marginBottom: 12,
    },
    inviteDetailText: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    inviteDetailValue: {
        fontWeight: '600',
        color: theme.colors.textPrimary,
    },
    shareButton: {
        backgroundColor: theme.colors.primary,
        padding: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    shareButtonText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyStateText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
});
