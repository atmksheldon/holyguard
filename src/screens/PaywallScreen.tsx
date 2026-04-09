import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getOfferings, PLAN_CONFIG } from '../config/revenuecat';
import { logger } from '../utils/logger';

type PlanKey = 'individual' | 'team' | 'enterprise';

interface PlanCardProps {
    planKey: PlanKey;
    selected: boolean;
    onSelect: () => void;
    rcPackage?: PurchasesPackage;
    popular?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ planKey, selected, onSelect, rcPackage, popular }) => {
    const config = PLAN_CONFIG[planKey];
    const displayPrice = rcPackage?.product?.priceString || config.price;

    return (
        <TouchableOpacity
            style={[styles.planCard, selected && styles.planCardSelected, popular && styles.planCardPopular]}
            onPress={onSelect}
            activeOpacity={0.7}
        >
            {popular && (
                <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                </View>
            )}
            <View style={styles.planHeader}>
                <Text style={[styles.planName, selected && styles.planNameSelected]}>{config.name}</Text>
                <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{displayPrice}</Text>
            </View>
            <Text style={styles.planDescription}>{config.description}</Text>
            <View style={styles.planFeatures}>
                <View style={styles.featureRow}>
                    <MaterialCommunityIcons name="account-group" size={16} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={styles.featureText}>{config.seats === 1 ? '1 seat' : `Up to ${config.seats} seats`}</Text>
                </View>
                <View style={styles.featureRow}>
                    <MaterialCommunityIcons name="shield-check" size={16} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={styles.featureText}>All security features</Text>
                </View>
                <View style={styles.featureRow}>
                    <MaterialCommunityIcons name="map-marker-radius" size={16} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={styles.featureText}>Network map access</Text>
                </View>
                {config.seats > 1 && (
                    <View style={styles.featureRow}>
                        <MaterialCommunityIcons name="cash" size={16} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
                        <Text style={styles.featureText}>
                            ${(parseFloat(config.price.replace(/[^0-9.]/g, '')) / config.seats).toFixed(2)}/seat/mo
                        </Text>
                    </View>
                )}
            </View>
            <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected && <View style={styles.radioInner} />}
            </View>
        </TouchableOpacity>
    );
};

export const PaywallScreen = () => {
    const { user, refreshProfile } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState<PlanKey>('team');
    const [loading, setLoading] = useState(false);
    const [loadingOfferings, setLoadingOfferings] = useState(true);
    const [packages, setPackages] = useState<Record<string, PurchasesPackage>>({});
    useEffect(() => {
        loadOfferings();
    }, []);

    const loadOfferings = async () => {
        try {
            const offering = await getOfferings();
            if (offering?.availablePackages) {
                const pkgMap: Record<string, PurchasesPackage> = {};
                for (const pkg of offering.availablePackages) {
                    pkgMap[pkg.product.identifier] = pkg;
                }
                setPackages(pkgMap);
            }
        } catch (error) {
            logger.error('Error loading offerings:', error);
        } finally {
            setLoadingOfferings(false);
        }
    };

    const handleSubscribe = async () => {
        const config = PLAN_CONFIG[selectedPlan];
        const pkg = packages[config.productId];

        if (!pkg) {
            Alert.alert('Not Available', 'This plan is not yet available for purchase. Please try again later.');
            return;
        }

        setLoading(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);

            if (typeof customerInfo.entitlements.active['active'] !== 'undefined') {
                // Purchase successful — update org document
                await updateOrgSubscription(selectedPlan, config.seats);
                await refreshProfile();
            }
        } catch (error: any) {
            if (!error.userCancelled) {
                logger.error('Purchase error:', error);
                Alert.alert('Purchase Failed', 'Unable to complete purchase. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const updateOrgSubscription = async (plan: PlanKey, seats: number) => {
        if (!user?.organizationId) return;

        try {
            const orgsQuery = query(collection(db, 'organizations'), where('id', '==', user.organizationId));
            const orgSnapshot = await getDocs(orgsQuery);

            if (!orgSnapshot.empty) {
                const orgDocRef = orgSnapshot.docs[0].ref;
                await updateDoc(orgDocRef, {
                    subscriptionPlan: plan,
                    subscriptionStatus: 'active',
                    maxSeats: seats,
                    subscribedAt: new Date().toISOString(),
                });
            }
        } catch (error) {
            logger.error('Error updating org subscription:', error);
        }
    };

    const handleRestorePurchases = async () => {
        setLoading(true);
        try {
            const customerInfo = await Purchases.restorePurchases();
            if (typeof customerInfo.entitlements.active['active'] !== 'undefined') {
                Alert.alert('Restored', 'Your subscription has been restored.');
                await refreshProfile();
            } else {
                Alert.alert('No Subscription Found', 'No active subscription was found for this account.');
            }
        } catch (error) {
            logger.error('Restore error:', error);
            Alert.alert('Error', 'Unable to restore purchases. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="shield-star" size={56} color={theme.colors.primary} />
                <Text style={styles.title}>CHOOSE YOUR PLAN</Text>
                <Text style={styles.brandLine}>HolyGuard by Cowboy State</Text>
                <Text style={styles.subtitle}>Subscribe to start protecting your community.</Text>
            </View>

            {loadingOfferings ? (
                <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 40 }} />
            ) : (
                <View style={styles.plansContainer}>
                    <PlanCard
                        planKey="individual"
                        selected={selectedPlan === 'individual'}
                        onSelect={() => setSelectedPlan('individual')}
                        rcPackage={packages[PLAN_CONFIG.individual.productId]}
                    />
                    <PlanCard
                        planKey="team"
                        selected={selectedPlan === 'team'}
                        onSelect={() => setSelectedPlan('team')}
                        rcPackage={packages[PLAN_CONFIG.team.productId]}
                        popular
                    />
                    <PlanCard
                        planKey="enterprise"
                        selected={selectedPlan === 'enterprise'}
                        onSelect={() => setSelectedPlan('enterprise')}
                        rcPackage={packages[PLAN_CONFIG.enterprise.productId]}
                    />
                </View>
            )}

            <TouchableOpacity
                style={[styles.subscribeButton, loading && styles.buttonDisabled]}
                onPress={handleSubscribe}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={theme.colors.white} />
                ) : (
                    <Text style={styles.subscribeButtonText}>SUBSCRIBE NOW</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRestorePurchases} style={styles.restoreButton}>
                <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
                Subscriptions auto-renew monthly. Cancel anytime in your Apple ID settings. Payment is charged to your App Store account at confirmation of purchase.
            </Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.l,
        paddingTop: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
        marginTop: 12,
    },
    brandLine: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.accent,
        letterSpacing: 1,
        marginTop: 6,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    plansContainer: {
        gap: 12,
        marginBottom: 24,
    },
    planCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: theme.colors.surfaceDark,
        position: 'relative',
    },
    planCardSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: '#FDF8F4',
    },
    planCardPopular: {
        borderColor: theme.colors.accent,
    },
    popularBadge: {
        position: 'absolute',
        top: -10,
        right: 16,
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    popularBadgeText: {
        color: theme.colors.white,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    planName: {
        fontSize: 18,
        fontWeight: '900',
        color: theme.colors.textPrimary,
    },
    planNameSelected: {
        color: theme.colors.primary,
    },
    planPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: theme.colors.textPrimary,
    },
    planPriceSelected: {
        color: theme.colors.primary,
    },
    planDescription: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 10,
    },
    planFeatures: {
        gap: 6,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureText: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginLeft: 8,
    },
    radioOuter: {
        position: 'absolute',
        top: 16,
        left: 16,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: theme.colors.surfaceDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: theme.colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.primary,
    },
    subscribeButton: {
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
    subscribeButtonText: {
        color: theme.colors.white,
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 1,
    },
    restoreButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    restoreText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    disclaimer: {
        fontSize: 11,
        color: theme.colors.gray,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 16,
        paddingHorizontal: 10,
    },
});
