import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';

export const PendingApprovalScreen = () => {
    const { user, logout, refreshProfile } = useAuth();
    const [checking, setChecking] = useState(false);
    const [verificationChecks, setVerificationChecks] = useState<any>(null);
    const [loadingChecks, setLoadingChecks] = useState(true);

    // Email verification state
    const [showEmailVerify, setShowEmailVerify] = useState(false);
    const [orgEmailInput, setOrgEmailInput] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailCodeSent, setEmailCodeSent] = useState(false);
    const [emailVerifying, setEmailVerifying] = useState(false);

    // Phone verification state
    const [showPhoneVerify, setShowPhoneVerify] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneVerifying, setPhoneVerifying] = useState(false);

    // Real-time listener on org status
    useEffect(() => {
        if (!user?.organizationId || user.organizationId === 'default-org') return;

        const loadOrgAndListen = async () => {
            // Find org document by id field
            const orgsQuery = query(collection(db, 'organizations'), where('id', '==', user.organizationId));
            const orgSnapshot = await getDocs(orgsQuery);

            if (orgSnapshot.empty) {
                setLoadingChecks(false);
                return;
            }

            const orgDocRef = orgSnapshot.docs[0].ref;

            // Listen for status changes
            const unsubOrg = onSnapshot(orgDocRef, (snapshot) => {
                const data = snapshot.data();
                if (data?.status === 'verified' || data?.status === 'Active') {
                    refreshProfile();
                }
            });

            // Load verification checks
            const checksRef = doc(orgDocRef.path.includes('/') ? db : db, 'organizations', orgSnapshot.docs[0].id, 'verification', 'checks');
            const unsubChecks = onSnapshot(checksRef, (snapshot) => {
                if (snapshot.exists()) {
                    setVerificationChecks(snapshot.data());
                }
                setLoadingChecks(false);
            });

            return () => {
                unsubOrg();
                unsubChecks();
            };
        };

        loadOrgAndListen();
    }, [user?.organizationId]);

    const handleCheckStatus = async () => {
        setChecking(true);
        await refreshProfile();
        setChecking(false);
    };

    const handleSendEmailCode = async () => {
        if (!orgEmailInput.trim()) {
            Alert.alert('Error', 'Please enter your organization email');
            return;
        }

        setEmailSending(true);
        try {
            // Find org Firestore document ID
            const orgsQuery = query(collection(db, 'organizations'), where('id', '==', user!.organizationId));
            const orgSnapshot = await getDocs(orgsQuery);
            if (orgSnapshot.empty) throw new Error('Organization not found');

            const idToken = await auth.currentUser!.getIdToken();
            const response = await fetch(
                'https://us-central1-holyguard-app.cloudfunctions.net/sendOrgEmailVerification',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        organizationId: orgSnapshot.docs[0].id,
                        email: orgEmailInput.trim(),
                    }),
                }
            );

            const data = await response.json();
            if (response.ok) {
                setEmailCodeSent(true);
                Alert.alert('Code Sent', `Verification code sent to ${orgEmailInput}`);
            } else {
                Alert.alert('Error', data.error || 'Failed to send verification code');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to send verification code');
        } finally {
            setEmailSending(false);
        }
    };

    const handleConfirmEmailCode = async () => {
        if (!emailCode.trim()) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }

        setEmailVerifying(true);
        try {
            const orgsQuery = query(collection(db, 'organizations'), where('id', '==', user!.organizationId));
            const orgSnapshot = await getDocs(orgsQuery);
            if (orgSnapshot.empty) throw new Error('Organization not found');

            const idToken = await auth.currentUser!.getIdToken();
            const response = await fetch(
                'https://us-central1-holyguard-app.cloudfunctions.net/confirmOrgEmail',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        organizationId: orgSnapshot.docs[0].id,
                        code: emailCode.trim(),
                    }),
                }
            );

            const data = await response.json();
            if (response.ok && data.success) {
                Alert.alert(
                    data.autoApproved ? 'Verified!' : 'Email Confirmed',
                    data.autoApproved
                        ? 'Your organization has been approved!'
                        : `Email verified! Score: ${data.totalScore}/100`
                );
                setShowEmailVerify(false);
                if (data.autoApproved) {
                    await refreshProfile();
                }
            } else {
                Alert.alert('Error', data.error || 'Invalid code');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to verify code');
        } finally {
            setEmailVerifying(false);
        }
    };

    const handlePhoneVerify = async () => {
        if (!phoneInput.trim()) {
            Alert.alert('Error', 'Please enter the organization phone number');
            return;
        }

        setPhoneVerifying(true);
        try {
            const orgsQuery = query(collection(db, 'organizations'), where('id', '==', user!.organizationId));
            const orgSnapshot = await getDocs(orgsQuery);
            if (orgSnapshot.empty) throw new Error('Organization not found');

            const idToken = await auth.currentUser!.getIdToken();
            const response = await fetch(
                'https://us-central1-holyguard-app.cloudfunctions.net/confirmPhoneVerification',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        organizationId: orgSnapshot.docs[0].id,
                        phoneNumber: phoneInput.trim(),
                    }),
                }
            );

            const data = await response.json();
            if (response.ok && data.success) {
                Alert.alert(
                    data.autoApproved ? 'Verified!' : 'Phone Confirmed',
                    data.autoApproved
                        ? 'Your organization has been approved!'
                        : `Phone verified! Score: ${data.totalScore}/100`
                );
                setShowPhoneVerify(false);
                if (data.autoApproved) {
                    await refreshProfile();
                }
            } else {
                Alert.alert('Error', data.error || 'Failed to verify phone');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to verify phone');
        } finally {
            setPhoneVerifying(false);
        }
    };

    const getCheckIcon = (status: string) => {
        if (status === 'passed') return { name: 'check-circle' as const, color: theme.colors.success };
        if (status === 'failed') return { name: 'close-circle' as const, color: theme.colors.error };
        if (status === 'pending') return { name: 'clock-outline' as const, color: theme.colors.verificationPending };
        return { name: 'minus-circle-outline' as const, color: theme.colors.gray };
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <MaterialCommunityIcons name="shield-lock-outline" size={80} color={theme.colors.verificationPending} />

            <Text style={styles.title}>ORGANIZATION UNDER REVIEW</Text>

            <Text style={styles.message}>
                Your organization{user?.organizationName ? ` "${user.organizationName}"` : ''} is being verified.
            </Text>

            <Text style={styles.instruction}>
                Complete additional verification steps below to speed up approval, or wait for manual review.
            </Text>

            {/* Verification Checks Card */}
            {loadingChecks ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
            ) : verificationChecks ? (
                <View style={styles.checksCard}>
                    <Text style={styles.checksTitle}>Verification Status</Text>

                    {[
                        { key: 'googlePlaces', label: 'Google Places' },
                        { key: 'einVerification', label: 'EIN / 501(c)(3)' },
                        { key: 'emailDomain', label: 'Email Domain' },
                        { key: 'phoneSms', label: 'Phone / SMS' },
                    ].map(({ key, label }) => {
                        const check = verificationChecks[key];
                        const icon = getCheckIcon(check?.status || 'skipped');
                        const canVerify = check?.status === 'pending' || check?.status === 'skipped';
                        return (
                            <View key={key} style={styles.checkRow}>
                                <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
                                <Text style={styles.checkLabel}>{label}</Text>
                                <Text style={[styles.checkScore, { color: icon.color }]}>
                                    {check?.score || 0} pts
                                </Text>
                                {canVerify && key === 'emailDomain' && (
                                    <TouchableOpacity
                                        style={styles.verifyNowBtn}
                                        onPress={() => setShowEmailVerify(!showEmailVerify)}
                                    >
                                        <Text style={styles.verifyNowText}>VERIFY</Text>
                                    </TouchableOpacity>
                                )}
                                {canVerify && key === 'phoneSms' && (
                                    <TouchableOpacity
                                        style={styles.verifyNowBtn}
                                        onPress={() => setShowPhoneVerify(!showPhoneVerify)}
                                    >
                                        <Text style={styles.verifyNowText}>VERIFY</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}

                    <View style={styles.scoreDivider} />
                    <View style={styles.checkRow}>
                        <MaterialCommunityIcons name="sigma" size={20} color={theme.colors.textPrimary} />
                        <Text style={[styles.checkLabel, { fontWeight: 'bold' }]}>Total Score</Text>
                        <Text style={[styles.checkScore, { fontWeight: 'bold', color: theme.colors.textPrimary }]}>
                            {verificationChecks.totalScore || 0} / 100
                        </Text>
                    </View>
                    <Text style={styles.thresholdNote}>60 points needed for auto-approval</Text>
                </View>
            ) : null}

            {/* Email Verification Inline */}
            {showEmailVerify && (
                <View style={styles.inlineVerifyCard}>
                    <Text style={styles.inlineTitle}>Verify Organization Email</Text>
                    {!emailCodeSent ? (
                        <>
                            <Text style={styles.inlineSubtext}>
                                Enter your organization's official email (not gmail, yahoo, etc.)
                            </Text>
                            <TextInput
                                style={styles.inlineInput}
                                value={orgEmailInput}
                                onChangeText={setOrgEmailInput}
                                placeholder="admin@yourchurch.org"
                                placeholderTextColor={theme.colors.gray}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            <TouchableOpacity
                                style={styles.inlineButton}
                                onPress={handleSendEmailCode}
                                disabled={emailSending}
                            >
                                {emailSending ? (
                                    <ActivityIndicator color={theme.colors.white} />
                                ) : (
                                    <Text style={styles.inlineButtonText}>SEND CODE</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.inlineSubtext}>
                                Enter the 6-digit code sent to {orgEmailInput}
                            </Text>
                            <TextInput
                                style={[styles.inlineInput, { textAlign: 'center', letterSpacing: 4, fontSize: 24 }]}
                                value={emailCode}
                                onChangeText={setEmailCode}
                                placeholder="000000"
                                placeholderTextColor={theme.colors.gray}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                            <TouchableOpacity
                                style={styles.inlineButton}
                                onPress={handleConfirmEmailCode}
                                disabled={emailVerifying}
                            >
                                {emailVerifying ? (
                                    <ActivityIndicator color={theme.colors.white} />
                                ) : (
                                    <Text style={styles.inlineButtonText}>CONFIRM CODE</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}

            {/* Phone Verification Inline */}
            {showPhoneVerify && (
                <View style={styles.inlineVerifyCard}>
                    <Text style={styles.inlineTitle}>Verify Organization Phone</Text>
                    <Text style={styles.inlineSubtext}>
                        Enter your organization's phone number
                    </Text>
                    <TextInput
                        style={styles.inlineInput}
                        value={phoneInput}
                        onChangeText={setPhoneInput}
                        placeholder="(555) 123-4567"
                        placeholderTextColor={theme.colors.gray}
                        keyboardType="phone-pad"
                    />
                    <TouchableOpacity
                        style={styles.inlineButton}
                        onPress={handlePhoneVerify}
                        disabled={phoneVerifying}
                    >
                        {phoneVerifying ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.inlineButtonText}>VERIFY PHONE</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                style={styles.checkButton}
                onPress={handleCheckStatus}
                disabled={checking}
            >
                {checking ? (
                    <ActivityIndicator color={theme.colors.white} />
                ) : (
                    <Text style={styles.buttonText}>CHECK STATUS</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
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
    instruction: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    checksCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: 16,
    },
    checksTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 12,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    checkLabel: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.textPrimary,
        marginLeft: 10,
    },
    checkScore: {
        fontSize: 14,
        fontWeight: '600',
        marginRight: 8,
    },
    verifyNowBtn: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    verifyNowText: {
        color: theme.colors.white,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    scoreDivider: {
        height: 1,
        backgroundColor: theme.colors.surfaceDark,
        marginVertical: 6,
    },
    thresholdNote: {
        fontSize: 11,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 6,
        fontStyle: 'italic',
    },
    inlineVerifyCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.colors.primary,
        marginBottom: 16,
    },
    inlineTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 6,
    },
    inlineSubtext: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 12,
    },
    inlineInput: {
        backgroundColor: theme.colors.white,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        fontSize: 16,
        color: theme.colors.textPrimary,
        marginBottom: 12,
    },
    inlineButton: {
        backgroundColor: theme.colors.primary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    inlineButtonText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    checkButton: {
        backgroundColor: theme.colors.success,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: theme.colors.white,
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    logoutButton: {
        marginTop: 10,
    },
    logoutText: {
        color: theme.colors.textSecondary,
        textDecorationLine: 'underline',
    },
});
