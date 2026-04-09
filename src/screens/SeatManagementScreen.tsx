import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';

interface OrgMember {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at?: string;
}

interface SeatManagementScreenProps {
    navigation: any;
}

export const SeatManagementScreen: React.FC<SeatManagementScreenProps> = ({ navigation }) => {
    const { user } = useAuth();
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        if (!user?.organizationId) return;

        try {
            const usersQuery = query(
                collection(db, 'users'),
                where('organization_id', '==', user.organizationId)
            );
            const snapshot = await getDocs(usersQuery);
            const memberList: OrgMember[] = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || 'Unknown',
                email: doc.data().email || '',
                role: doc.data().role || 'member',
                created_at: doc.data().created_at || '',
            }));

            // Sort: admins first, then by name
            memberList.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (b.role === 'admin' && a.role !== 'admin') return 1;
                return a.name.localeCompare(b.name);
            });

            setMembers(memberList);
        } catch (error) {
            logger.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = (member: OrgMember) => {
        if (member.id === user?.id) {
            Alert.alert('Error', 'You cannot remove yourself.');
            return;
        }

        Alert.alert(
            'Remove Member',
            `Remove ${member.name} from the organization? They will lose access to HolyGuard.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Set their org to a removed state
                            await updateDoc(doc(db, 'users', member.id), {
                                organization_id: 'removed',
                                role: 'member',
                            });
                            setMembers(prev => prev.filter(m => m.id !== member.id));
                            Alert.alert('Removed', `${member.name} has been removed from the organization.`);
                        } catch (error) {
                            logger.error('Error removing member:', error);
                            Alert.alert('Error', 'Failed to remove member. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return 'shield-account';
            case 'security': return 'shield';
            case 'super_admin': return 'shield-star';
            default: return 'account';
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return theme.colors.primary;
            case 'security': return theme.colors.accent;
            case 'super_admin': return theme.colors.danger;
            default: return theme.colors.textSecondary;
        }
    };

    const renderMember = ({ item }: { item: OrgMember }) => (
        <View style={styles.memberCard}>
            <View style={styles.memberInfo}>
                <MaterialCommunityIcons
                    name={getRoleIcon(item.role)}
                    size={28}
                    color={getRoleColor(item.role)}
                />
                <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                        {item.name}
                        {item.id === user?.id && <Text style={styles.youBadge}> (You)</Text>}
                    </Text>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                    <Text style={[styles.memberRole, { color: getRoleColor(item.role) }]}>
                        {item.role.toUpperCase()}
                    </Text>
                </View>
            </View>
            {item.id !== user?.id && (user?.role === 'admin' || user?.role === 'super_admin') && (
                <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(item)}
                >
                    <MaterialCommunityIcons name="close-circle" size={24} color={theme.colors.error} />
                </TouchableOpacity>
            )}
        </View>
    );

    const maxSeats = user?.maxSeats || 3;
    const usedSeats = members.length;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>SEAT MANAGEMENT</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.seatCounter}>
                <View style={styles.seatBarBackground}>
                    <View style={[styles.seatBarFill, { width: `${Math.min(100, (usedSeats / maxSeats) * 100)}%` }]} />
                </View>
                <Text style={styles.seatText}>
                    <Text style={styles.seatCount}>{usedSeats}</Text> / {maxSeats} seats used
                </Text>
                {user?.subscriptionPlan && (
                    <Text style={styles.planLabel}>
                        {user.subscriptionPlan.charAt(0).toUpperCase() + user.subscriptionPlan.slice(1)} Plan
                    </Text>
                )}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={members}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMember}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No members found.</Text>
                    }
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
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.m,
        paddingVertical: 12,
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
    },
    seatCounter: {
        backgroundColor: theme.colors.white,
        marginHorizontal: theme.spacing.m,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: 16,
    },
    seatBarBackground: {
        height: 8,
        backgroundColor: theme.colors.surfaceDark,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    seatBarFill: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 4,
    },
    seatText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    seatCount: {
        fontWeight: '900',
        color: theme.colors.textPrimary,
        fontSize: 16,
    },
    planLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.primary,
        marginTop: 4,
    },
    listContent: {
        paddingHorizontal: theme.spacing.m,
        paddingBottom: 20,
    },
    memberCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 10,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
    },
    memberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    memberDetails: {
        marginLeft: 12,
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.colors.textPrimary,
    },
    youBadge: {
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    memberEmail: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    memberRole: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginTop: 4,
    },
    removeButton: {
        padding: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: theme.colors.textSecondary,
        marginTop: 40,
        fontSize: 14,
    },
});
