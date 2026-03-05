import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { logger } from '../utils/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { validateEmail, validatePassword } from '../utils/validation';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../config/keys';

const formatEIN = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 9);
    if (digits.length > 2) {
        return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }
    return digits;
};

const totalSteps = (creatingOrg: boolean) => creatingOrg ? 4 : 3;

export const SignUpScreen = ({ navigation }: any) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [joiningExistingOrg, setJoiningExistingOrg] = useState(true);
    const [churchName, setChurchName] = useState('');
    const [churchAddress, setChurchAddress] = useState('');
    const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [validatedRole, setValidatedRole] = useState<string>('');
    const [validatedOrgId, setValidatedOrgId] = useState<string>('');
    const [validatedOrgName, setValidatedOrgName] = useState<string>('');
    const placesRef = useRef<any>(null);

    // New verification fields
    const [ein, setEin] = useState('');
    const [website, setWebsite] = useState('');
    const [orgEmail, setOrgEmail] = useState('');
    const [orgPhone, setOrgPhone] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verificationResults, setVerificationResults] = useState<any>(null);

    const validateInviteCode = async (code: string) => {
        try {
            const response = await fetch('https://us-central1-holyguard-app.cloudfunctions.net/validateInviteCode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inviteCode: code }),
            });

            const data = await response.json();
            return {
                valid: data.valid || false,
                role: data.role || 'member',
                organizationId: data.organizationId || '',
                organizationName: data.organizationName || '',
                error: data.error
            };
        } catch (error) {
            return { valid: false, role: 'member', organizationId: '', organizationName: '', error: 'Network error' };
        }
    };

    const handleStep1Next = async () => {
        if (!name || !email || !password) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            Alert.alert("Invalid Email", emailValidation.error || 'Please enter a valid email');
            return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            Alert.alert("Weak Password", passwordValidation.error || 'Please use a stronger password');
            return;
        }

        setStep(2);
    };

    const handleStep2Next = async () => {
        if (joiningExistingOrg) {
            if (!inviteCode) {
                Alert.alert("Error", "Please enter an invite code.");
                return;
            }

            setLoading(true);
            const result = await validateInviteCode(inviteCode);
            setLoading(false);

            if (!result.valid) {
                Alert.alert("Invalid Code", result.error || 'This invite code is not valid.');
                return;
            }

            setValidatedRole(result.role);
            setValidatedOrgId(result.organizationId);
            setValidatedOrgName(result.organizationName);

            await handleJoinExistingOrg();
        } else {
            setValidatedRole('admin');
            setStep(3);
        }
    };

    const handleJoinExistingOrg = async () => {
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const idToken = await user.getIdToken();
            const url = `https://firestore.googleapis.com/v1/projects/holyguard-app/databases/(default)/documents/users?documentId=${user.uid}`;

            const firestoreDoc = {
                fields: {
                    id: { stringValue: user.uid },
                    name: { stringValue: name },
                    email: { stringValue: email },
                    role: { stringValue: validatedRole },
                    organization_id: { stringValue: validatedOrgId },
                    email_verified: { booleanValue: false },
                    created_at: { timestampValue: new Date().toISOString() },
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(firestoreDoc),
            });

            if (!response.ok) {
                throw new Error('Failed to create user profile');
            }

            await sendEmailVerification(user);

            Alert.alert(
                "Welcome to " + validatedOrgName,
                "Please check your email to verify your account."
            );
        } catch (error: any) {
            let errorMessage = "Unable to complete registration. ";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in instead.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your connection and try again.";
            }
            Alert.alert("Registration Failed", errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteSignup = async () => {
        if (!churchName) {
            Alert.alert("Error", "Please enter your church or organization name.");
            return;
        }

        if (!churchAddress || !coordinates) {
            Alert.alert("Error", "Please select an address from the dropdown suggestions.");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Create organization with pending status
            const orgId = `org_${Date.now()}`;
            const orgDocRef = await addDoc(collection(db, 'organizations'), {
                id: orgId,
                name: churchName,
                address: churchAddress,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                status: 'pending',
                ein: ein ? ein.replace(/\D/g, '') : null,
                website: website || null,
                orgEmail: orgEmail || null,
                phone: orgPhone || null,
                verificationScore: 0,
                verificationSubmittedAt: serverTimestamp(),
                created_at: serverTimestamp(),
            });

            // 3. Create default #general channel
            await addDoc(collection(db, 'channels'), {
                name: 'general',
                organizationId: orgId,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                isDefault: true,
            });

            // 4. Create User Profile
            const idToken = await user.getIdToken();
            const url = `https://firestore.googleapis.com/v1/projects/holyguard-app/databases/(default)/documents/users?documentId=${user.uid}`;

            const firestoreDoc = {
                fields: {
                    id: { stringValue: user.uid },
                    name: { stringValue: name },
                    email: { stringValue: email },
                    role: { stringValue: validatedRole },
                    organization_id: { stringValue: orgId },
                    email_verified: { booleanValue: false },
                    created_at: { timestampValue: new Date().toISOString() },
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(firestoreDoc),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create user profile: ${errorText}`);
            }

            // 5. Send Email Verification
            await sendEmailVerification(user);

            // 6. Move to verification step and kick off automated checks
            setStep(4);
            setVerifying(true);

            try {
                const verifyResponse = await fetch(
                    'https://us-central1-holyguard-app.cloudfunctions.net/verifyOrganization',
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${idToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            organizationId: orgDocRef.id,
                            ein: ein ? ein.replace(/\D/g, '') : undefined,
                            orgEmail: orgEmail || undefined,
                            phone: orgPhone || undefined,
                            website: website || undefined,
                        }),
                    }
                );

                const verifyResult = await verifyResponse.json();
                setVerificationResults(verifyResult);
            } catch (verifyError) {
                logger.error('Verification call failed:', verifyError);
                setVerificationResults({
                    status: 'pending',
                    score: 0,
                    checks: {},
                });
            }

            setVerifying(false);
        } catch (error: any) {
            let errorMessage = "Unable to complete registration. ";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in instead.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your connection and try again.";
            } else if (error.message) {
                errorMessage += error.message;
            }
            Alert.alert("Registration Failed", errorMessage);
            setLoading(false);
            return;
        }
        setLoading(false);
    };

    const getStepTitle = () => {
        if (step === 1) return 'CREATE ACCOUNT';
        if (step === 2) return 'JOIN ORGANIZATION';
        if (step === 3) return 'ORGANIZATION INFO';
        if (step === 4) return 'VERIFICATION';
        return '';
    };

    const getStepSubtitle = () => {
        const total = totalSteps(!joiningExistingOrg);
        return `STEP ${step} OF ${total}`;
    };

    const getCheckIcon = (status: string) => {
        if (status === 'passed') return { name: 'check-circle' as const, color: theme.colors.success };
        if (status === 'failed') return { name: 'close-circle' as const, color: theme.colors.error };
        if (status === 'pending') return { name: 'clock-outline' as const, color: theme.colors.verificationPending };
        return { name: 'minus-circle-outline' as const, color: theme.colors.gray };
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>{getStepTitle()}</Text>
                    <Text style={styles.subtitle}>{getStepSubtitle()}</Text>
                </View>

                {step === 1 ? (
                <View style={styles.form}>
                    <Text style={styles.label}>FULL NAME</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="John Doe"
                        placeholderTextColor={theme.colors.gray}
                    />

                    <Text style={styles.label}>EMAIL</Text>
                    <TextInput
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="email@domain.com"
                        placeholderTextColor={theme.colors.gray}
                    />

                    <Text style={styles.label}>PASSWORD</Text>
                    <TextInput
                        style={styles.input}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min 8 chars, with letter and number"
                        placeholderTextColor={theme.colors.gray}
                    />

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleStep1Next}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>NEXT</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkContainer}>
                        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Login</Text></Text>
                    </TouchableOpacity>
                </View>
                ) : step === 2 ? (
                <View style={styles.form}>
                    <Text style={styles.label}>I WANT TO:</Text>

                    <TouchableOpacity
                        style={[styles.toggleOption, joiningExistingOrg && styles.toggleOptionSelected]}
                        onPress={() => setJoiningExistingOrg(true)}
                    >
                        <View style={styles.toggleOptionContent}>
                            <Text style={[styles.toggleOptionTitle, joiningExistingOrg && styles.toggleOptionTitleSelected]}>
                                Join Existing Organization
                            </Text>
                            <Text style={styles.toggleOptionSubtitle}>I have an invite code</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toggleOption, !joiningExistingOrg && styles.toggleOptionSelected]}
                        onPress={() => setJoiningExistingOrg(false)}
                    >
                        <View style={styles.toggleOptionContent}>
                            <Text style={[styles.toggleOptionTitle, !joiningExistingOrg && styles.toggleOptionTitleSelected]}>
                                Create New Organization
                            </Text>
                            <Text style={styles.toggleOptionSubtitle}>I'm setting up a new security network</Text>
                        </View>
                    </TouchableOpacity>

                    {joiningExistingOrg ? (
                        <View style={styles.inviteCodeSection}>
                            <Text style={styles.label}>INVITE CODE</Text>
                            <TextInput
                                style={[styles.input, styles.codeInput]}
                                autoCapitalize="characters"
                                value={inviteCode}
                                onChangeText={setInviteCode}
                                placeholder="JOIN-XXXX-XXXX"
                                placeholderTextColor={theme.colors.gray}
                            />
                            {validatedOrgName ? (
                                <View style={styles.validationSuccess}>
                                    <Text style={styles.validationText}>✓ Joining: {validatedOrgName}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleStep2Next}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>NEXT</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setStep(1)} style={styles.linkContainer}>
                        <Text style={styles.linkText}>← Back</Text>
                    </TouchableOpacity>
                </View>
                ) : step === 3 ? (
                <ScrollView
                    style={styles.form}
                    keyboardShouldPersistTaps='handled'
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    <Text style={styles.label}>CHURCH/ORGANIZATION NAME</Text>
                    <TextInput
                        style={styles.input}
                        value={churchName}
                        onChangeText={setChurchName}
                        placeholder="First Baptist Church"
                        placeholderTextColor={theme.colors.gray}
                    />

                    <Text style={styles.label}>FULL ADDRESS</Text>
                    <GooglePlacesAutocomplete
                        ref={placesRef}
                        placeholder='Search for church address...'
                        onPress={(data, details = null) => {
                            setChurchAddress(data.description);
                            if (details?.geometry?.location) {
                                setCoordinates({
                                    latitude: details.geometry.location.lat,
                                    longitude: details.geometry.location.lng,
                                });
                            }
                        }}
                        query={{
                            key: GOOGLE_PLACES_API_KEY,
                            language: 'en',
                        }}
                        fetchDetails={true}
                        enablePoweredByContainer={false}
                        minLength={2}
                        debounce={200}
                        textInputProps={{
                            autoCorrect: false,
                            autoCapitalize: 'none',
                            spellCheck: false,
                            autoComplete: 'off',
                            keyboardType: 'default',
                        }}
                        keyboardShouldPersistTaps='handled'
                        listViewDisplayed='auto'
                        keepResultsAfterBlur={true}
                        styles={{
                            container: {
                                flex: 0,
                                marginBottom: 20,
                                zIndex: 1,
                            },
                            textInput: {
                                backgroundColor: theme.colors.white,
                                height: 54,
                                borderRadius: 8,
                                paddingHorizontal: 16,
                                fontSize: 16,
                                borderWidth: 1,
                                borderColor: theme.colors.surfaceDark,
                                color: theme.colors.textPrimary,
                            },
                            listView: {
                                backgroundColor: theme.colors.white,
                                borderRadius: 8,
                                marginTop: 5,
                                elevation: 3,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 4,
                            },
                            row: {
                                backgroundColor: theme.colors.white,
                                padding: 18,
                                minHeight: 66,
                                borderBottomWidth: 1,
                                borderBottomColor: '#f0f0f0',
                                justifyContent: 'center',
                            },
                            description: {
                                color: theme.colors.textPrimary,
                                fontSize: 15,
                            },
                            separator: {
                                height: 0,
                            },
                        }}
                    />

                    {/* Verification fields */}
                    <View style={styles.verificationSection}>
                        <Text style={styles.sectionTitle}>VERIFICATION INFO</Text>
                        <Text style={styles.sectionSubtitle}>
                            Providing more info speeds up verification. EIN + address gets you instant approval.
                        </Text>

                        <Text style={styles.label}>EIN / TAX ID (OPTIONAL)</Text>
                        <TextInput
                            style={styles.input}
                            value={ein}
                            onChangeText={(text) => setEin(formatEIN(text))}
                            placeholder="XX-XXXXXXX"
                            placeholderTextColor={theme.colors.gray}
                            keyboardType="number-pad"
                            maxLength={10}
                        />

                        <Text style={styles.label}>ORGANIZATION WEBSITE (OPTIONAL)</Text>
                        <TextInput
                            style={styles.input}
                            value={website}
                            onChangeText={setWebsite}
                            placeholder="www.yourchurch.org"
                            placeholderTextColor={theme.colors.gray}
                            autoCapitalize="none"
                            keyboardType="url"
                        />

                        <Text style={styles.label}>ORGANIZATION EMAIL (OPTIONAL)</Text>
                        <TextInput
                            style={styles.input}
                            value={orgEmail}
                            onChangeText={setOrgEmail}
                            placeholder="admin@yourchurch.org"
                            placeholderTextColor={theme.colors.gray}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <Text style={styles.label}>ORGANIZATION PHONE (OPTIONAL)</Text>
                        <TextInput
                            style={styles.input}
                            value={orgPhone}
                            onChangeText={setOrgPhone}
                            placeholder="(555) 123-4567"
                            placeholderTextColor={theme.colors.gray}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleCompleteSignup}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>COMPLETE REGISTRATION</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setStep(2)} style={styles.linkContainer}>
                        <Text style={styles.linkText}>← Back</Text>
                    </TouchableOpacity>
                </ScrollView>
                ) : step === 4 ? (
                <View style={styles.form}>
                    <View style={styles.verificationStatusContainer}>
                        <MaterialCommunityIcons
                            name={verificationResults?.status === 'verified' ? 'shield-check' : 'shield-lock-outline'}
                            size={64}
                            color={verificationResults?.status === 'verified' ? theme.colors.verificationVerified : theme.colors.verificationPending}
                        />

                        <Text style={styles.verificationTitle}>
                            {verifying ? 'VERIFYING ORGANIZATION...' :
                             verificationResults?.status === 'verified' ? 'ORGANIZATION VERIFIED!' :
                             'VERIFICATION IN PROGRESS'}
                        </Text>

                        <Text style={styles.verificationSubtext}>
                            {verifying ? 'Running automated checks on your organization...' :
                             verificationResults?.status === 'verified'
                                ? 'Your organization has been approved. Please check your email to verify your account.'
                                : 'Your organization is under review. You can complete additional verification steps after email verification.'}
                        </Text>

                        {verifying && (
                            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
                        )}

                        {verificationResults && !verifying && (
                            <View style={styles.checksCard}>
                                <Text style={styles.checksTitle}>Verification Checks</Text>

                                {['googlePlaces', 'einVerification', 'emailDomain', 'phoneSms'].map((checkKey) => {
                                    const check = verificationResults.checks?.[checkKey];
                                    const labels: Record<string, string> = {
                                        googlePlaces: 'Google Places',
                                        einVerification: 'EIN / 501(c)(3)',
                                        emailDomain: 'Email Domain',
                                        phoneSms: 'Phone / SMS',
                                    };
                                    const icon = getCheckIcon(check?.status || 'skipped');
                                    return (
                                        <View key={checkKey} style={styles.checkRow}>
                                            <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
                                            <Text style={styles.checkLabel}>{labels[checkKey]}</Text>
                                            <Text style={[styles.checkScore, { color: icon.color }]}>
                                                {check?.score || 0} pts
                                            </Text>
                                        </View>
                                    );
                                })}

                                <View style={styles.scoreDivider} />
                                <View style={styles.checkRow}>
                                    <MaterialCommunityIcons name="sigma" size={20} color={theme.colors.textPrimary} />
                                    <Text style={[styles.checkLabel, { fontWeight: 'bold' }]}>Total Score</Text>
                                    <Text style={[styles.checkScore, { fontWeight: 'bold', color: theme.colors.textPrimary }]}>
                                        {verificationResults.score || 0} / 100
                                    </Text>
                                </View>
                            </View>
                        )}

                        {verificationResults && !verifying && (
                            <Text style={styles.verificationNote}>
                                {verificationResults.status === 'verified'
                                    ? 'Check your inbox to verify your email and start using HolyGuard.'
                                    : 'After verifying your email, you can complete additional checks to speed up approval.'}
                            </Text>
                        )}
                    </View>
                </View>
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: theme.spacing.l,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.primary,
        letterSpacing: 1,
        marginTop: 8,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: theme.colors.white,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
        marginBottom: 20,
        fontSize: 16,
        color: theme.colors.textPrimary,
    },
    codeInput: {
        borderColor: theme.colors.primary,
        borderWidth: 2,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    button: {
        backgroundColor: theme.colors.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
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
    linkContainer: {
        marginTop: 24,
        alignItems: 'center',
    },
    linkText: {
        color: theme.colors.textSecondary,
        fontSize: 14,
    },
    linkHighlight: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    toggleOption: {
        backgroundColor: theme.colors.white,
        borderWidth: 2,
        borderColor: theme.colors.surfaceDark,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    toggleOptionSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: '#f8f9ff',
    },
    toggleOptionContent: {
        flexDirection: 'column',
    },
    toggleOptionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 4,
    },
    toggleOptionTitleSelected: {
        color: theme.colors.primary,
    },
    toggleOptionSubtitle: {
        fontSize: 13,
        color: theme.colors.textSecondary,
    },
    inviteCodeSection: {
        marginTop: 8,
    },
    validationSuccess: {
        backgroundColor: '#e6f7e6',
        padding: 12,
        borderRadius: 6,
        marginTop: -10,
        marginBottom: 10,
    },
    validationText: {
        color: '#2d7a2d',
        fontSize: 14,
        fontWeight: '600',
    },
    verificationSection: {
        marginTop: 8,
        marginBottom: 10,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.surfaceDark,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: theme.colors.primary,
        letterSpacing: 1,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 16,
        lineHeight: 18,
    },
    verificationStatusContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    verificationTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 1,
        marginTop: 16,
        textAlign: 'center',
    },
    verificationSubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    checksCard: {
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        marginTop: 24,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.colors.surfaceDark,
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
    },
    scoreDivider: {
        height: 1,
        backgroundColor: theme.colors.surfaceDark,
        marginVertical: 6,
    },
    verificationNote: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 18,
        fontStyle: 'italic',
    },
});
