import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { auth } from '../config/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export const VerifyEmailScreen = () => {
    const { logout } = useAuth();
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (auth.currentUser?.email) {
            setUserEmail(auth.currentUser.email);
        }
    }, []);

    // Cooldown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleResend = async () => {
        if (cooldown > 0) return;
        
        setSending(true);
        try {
            if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
                Alert.alert("Sent", "Verification email sent again. Check your spam folder.");
                setCooldown(60); // 60 second cooldown
            }
        } catch (error: any) {
            if (error.code === 'auth/too-many-requests') {
                Alert.alert(
                    "Too Many Requests",
                    "You've requested too many verification emails. Please wait a few minutes before trying again."
                );
                setCooldown(300); // 5 minute cooldown for rate limit
            } else {
                Alert.alert("Error", error.message || 'Failed to resend email');
            }
        } finally {
            setSending(false);
        }
    };

    const handleCheckVerification = async () => {
        setChecking(true);
        try {
            if (auth.currentUser) {
                // Force reload Firebase user to get latest emailVerified status
                await auth.currentUser.reload();
                
                if (auth.currentUser.emailVerified) {
                    Alert.alert(
                        "Email Verified!",
                        "Your email has been verified. You'll be logged out and can log back in to access the app.",
                        [
                            {
                                text: "OK",
                                onPress: () => logout()
                            }
                        ]
                    );
                } else {
                    Alert.alert("Not Verified", "Please click the verification link in your email first, then try again.");
                }
            }
        } catch (error) {
            Alert.alert("Error", "Failed to check verification. Please try again.");
        } finally {
            setChecking(false);
        }
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="email-lock" size={80} color={theme.colors.primary} />
            
            <Text style={styles.title}>VERIFY YOUR EMAIL</Text>
            
            <Text style={styles.message}>
                We have sent a verification link to:
            </Text>
            <Text style={styles.email}>{userEmail || 'Loading...'}</Text>
            
            <Text style={styles.instruction}>
                Tap the link in the email to activate your account security clearance.
            </Text>

            <TouchableOpacity 
                style={styles.checkButton} 
                onPress={handleCheckVerification}
                disabled={checking}
            >
                {checking ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>I HAVE VERIFIED</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.resendButton, (sending || cooldown > 0) && styles.disabledButton]} 
                onPress={handleResend}
                disabled={sending || cooldown > 0}
            >
                <Text style={[styles.resendText, (sending || cooldown > 0) && styles.disabledText]}>
                    {sending ? "SENDING..." : cooldown > 0 ? `Wait ${cooldown}s` : "Resend Email"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
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
        fontSize: 24,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        marginTop: 20,
        letterSpacing: 1,
    },
    message: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginTop: 20,
        textAlign: 'center',
    },
    email: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginTop: 5,
        marginBottom: 20,
    },
    instruction: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
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
    resendButton: {
        padding: 10,
        marginBottom: 10,
    },
    resendText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.5,
    },
    disabledText: {
        color: theme.colors.textSecondary,
    },
    logoutButton: {
        marginTop: 20,
    },
    logoutText: {
        color: theme.colors.textSecondary,
        textDecorationLine: 'underline',
    }
});
