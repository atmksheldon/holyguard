import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { writeAuditLog } from '../utils/auditLog';

interface PendingOrg {
    id: string;
    name: string;
    address: string;
    ein?: string;
    website?: string;
    orgEmail?: string;
    phone?: string;
    verificationScore: number;
    created_at: Date;
    checks?: any;
}

export const AdminReviewScreen = () => {
    const { user } = useAuth();
    const [pendingOrgs, setPendingOrgs] = useState<PendingOrg[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingOrgId, setRejectingOrgId] = useState<string | null>(null);

    useEffect(() => {
        const pendingQuery = query(
            collection(db, 'organizations'),
            where('status', '==', 'pending'),
            orderBy('created_at', 'desc')
        );

        const unsubscribe = onSnapshot(pendingQuery, async (snapshot) => {
            const orgs: PendingOrg[] = [];
            for (const orgDoc of snapshot.docs) {
                const data = orgDoc.data();

                // Load verification checks
                let checks = null;
                try {
                    const checksDoc = await getDoc(doc(db, 'organizations', orgDoc.id, 'verification', 'checks'));
                    if (checksDoc.exists()) {
                        checks = checksDoc.data();
                    }
                } catch (e) {
                    // Checks may not exist yet
                }

                orgs.push({
                    id: orgDoc.id,
                    name: data.name || 'Unknown',
                    address: data.address || '',
                    ein: data.ein,
                    website: data.website,
                    orgEmail: data.orgEmail,
                    phone: data.phone,
                    verificationScore: data.verificationScore || 0,
                    created_at: data.created_at?.toDate() || new Date(),
                    checks,
                });
            }
            setPendingOrgs(orgs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleReview = async (orgId: string, action: 'approve' | 'reject') => {
        if (action === 'reject' && !rejectReason.trim() && rejectingOrgId === orgId) {
            Alert.alert('Reason Required', 'Please provide a reason for rejection');
            return;
        }

        if (action === 'reject' && rejectingOrgId !== orgId) {
            setRejectingOrgId(orgId);
            return;
        }

        setActionLoading(orgId);
        try {
            const idToken = await auth.currentUser!.getIdToken();
            const response = await fetch(
                'https://us-central1-holyguard-app.cloudfunctions.net/reviewOrganization',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        organizationId: orgId,
                        action,
                        reason: action === 'reject' ? rejectReason.trim() : undefined,
                    }),
                }
            );

            const data = await response.json();
            if (response.ok && data.success) {
                await writeAuditLog({
                    action: action === 'approve' ? 'approve_organization' : 'reject_organization',
                    performedBy: auth.currentUser!.uid,
                    targetId: orgId,
                    targetType: 'organization',
                    details: action === 'reject' ? `Rejected: ${rejectReason.trim()}` : 'Approved',
                });
                Alert.alert('Success', `Organization ${action === 'approve' ? 'approved' : 'rejected'}`);
                setRejectingOrgId(null);
                setRejectReason('');
            } else {
                Alert.alert('Error', data.error || `Failed to ${action} organization`);
            }
        } catch (error) {
            Alert.alert('Error', `Failed to ${action} organization`);
        } finally {
            setActionLoading(null);
        }
    };

    const getCheckIcon = (status: string) => {
        if (status === 'passed') return { name: 'check-circle' as const, color: theme.colors.success };
        if (status === 'failed') return { name: 'close-circle' as const, color: theme.colors.error };
        if (status === 'pending') return { name: 'clock-outline' as const, color: theme.colors.verificationPending };
        return { name: 'minus-circle-outline' as const, color: theme.colors.gray };
    };

    const getTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        return 'Just now';
    };

    const renderOrgCard = ({ item }: { item: PendingOrg }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.timeAgo}>{getTimeAgo(item.created_at)}</Text>
            </View>

            <Text style={styles.orgAddress} numberOfLines={2}>{item.address}</Text>

            {(item.ein || item.website || item.orgEmail || item.phone) && (
                <View style={styles.detailsRow}>
                    {item.ein && <Text style={styles.detailChip}>EIN: {item.ein}</Text>}
                    {item.website && <Text style={styles.detailChip}>{item.website}</Text>}
                    {item.orgEmail && <Text style={styles.detailChip}>{item.orgEmail}</Text>}
                    {item.phone && <Text style={styles.detailChip}>{item.phone}</Text>}
                </View>
            )}

            <View style={styles.scoreBar}>
                <Text style={styles.scoreLabel}>Score</Text>
                <View style={styles.scoreTrack}>
                    <View style={[styles.scoreFill, { width: `${Math.min(item.verificationScore, 100)}%` }]} />
                </View>
                <Text style={styles.scoreValue}>{item.verificationScore}/100</Text>
            </View>

            {item.checks && (
                <View style={styles.checksContainer}>
                    {[
                        { key: 'googlePlaces', label: 'Places' },
                        { key: 'einVerification', label: 'EIN' },
                        { key: 'emailDomain', label: 'Email' },
                        { key: 'phoneSms', label: 'Phone' },
                    ].map(({ key, label }) => {
                        const check = item.checks[key];
                        const icon = getCheckIcon(check?.status || 'skipped');
                        return (
                            <View key={key} style={styles.miniCheck}>
                                <MaterialCommunityIcons name={icon.name} size={16} color={icon.color} />
                                <Text style={[styles.miniCheckLabel, { color: icon.color }]}>{label}</Text>
                            </View>
                        );
                    })}
                </View>
            )}

            {rejectingOrgId === item.id && (
                <View style={styles.rejectReasonContainer}>
                    <TextInput
                        style={styles.rejectInput}
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        placeholder="Reason for rejection..."
                        placeholderTextColor={theme.colors.gray}
                        multiline
                    />
                </View>
            )}

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleReview(item.id, 'approve')}
                    disabled={actionLoading === item.id}
                >
                    {actionLoading === item.id ? (
                        <ActivityIndicator color={theme.colors.white} size="small" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="check" size={18} color={theme.colors.white} />
                            <Text style={styles.actionText}>APPROVE</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReview(item.id, 'reject')}
                    disabled={actionLoading === item.id}
                >
                    <MaterialCommunityIcons name="close" size={18} color={theme.colors.white} />
                    <Text style={styles.actionText}>REJECT</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="shield-check" size={28} color={theme.colors.primary} />
                <Text style={styles.headerTitle}>Organization Review</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingOrgs.length}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : pendingOrgs.length === 0 ? (
                <View style={styles.centerContainer}>
                    <MaterialCommunityIcons name="check-decagram" size={64} color={theme.colors.success} />
                    <Text style={styles.emptyText}>All caught up!</Text>
                    <Text style={styles.emptySubtext}>No organizations pending review</Text>
                </View>
            ) : (
                <FlatList
                    data={pendingOrgs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderOrgCard}
                    contentContainerStyle={styles.listContent}
                />
            )}
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
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceDark,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginLeft: 12,
        flex: 1,
    },
    badge: {
        backgroundColor: theme.colors.verificationPending,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    badgeText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 14,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 8,
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    orgName: {
        fontSize: 17,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    timeAgo: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    orgAddress: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 10,
        lineHeight: 20,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    detailChip: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginRight: 6,
        marginBottom: 4,
    },
    scoreBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    scoreLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        marginRight: 8,
    },
    scoreTrack: {
        flex: 1,
        height: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 4,
        overflow: 'hidden',
    },
    scoreFill: {
        height: '100%',
        backgroundColor: theme.colors.verificationPending,
        borderRadius: 4,
    },
    scoreValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginLeft: 8,
    },
    checksContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
        paddingVertical: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
    },
    miniCheck: {
        alignItems: 'center',
    },
    miniCheckLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    rejectReasonContainer: {
        marginBottom: 10,
    },
    rejectInput: {
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: theme.colors.textPrimary,
        borderWidth: 1,
        borderColor: theme.colors.verificationRejected,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    approveButton: {
        flex: 1,
        backgroundColor: theme.colors.success,
        paddingVertical: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectButton: {
        flex: 1,
        backgroundColor: theme.colors.error,
        paddingVertical: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 0.5,
        marginLeft: 4,
    },
});
