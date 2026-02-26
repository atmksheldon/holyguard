import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { validateEmail } from '../utils/validation';

export const LoginScreen = ({ navigation }: any) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        // Validate email format
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            Alert.alert("Invalid Email", emailValidation.error || 'Please enter a valid email');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // AuthContext will automatically redirect
        } catch (error: any) {
            Alert.alert("Login Failed", "Invalid email or password. Please try again.");
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>HOLYGUARD</Text>
                <Text style={styles.subtitle}>SECURE NETWORK ACCESS</Text>
            </View>

            <View style={styles.form}>
                <Text style={styles.label}>EMAIL</Text>
                <TextInput 
                    style={styles.input} 
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="officer@church.org"
                    placeholderTextColor={theme.colors.gray}
                />

                <Text style={styles.label}>PASSWORD</Text>
                <TextInput 
                    style={styles.input} 
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.colors.gray}
                />

                <TouchableOpacity 
                    style={styles.button} 
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.colors.white} />
                    ) : (
                        <Text style={styles.buttonText}>AUTHENTICATE</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.linkContainer}>
                    <Text style={styles.linkText}>First time? <Text style={styles.linkHighlight}>Activate Access</Text></Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.l,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: theme.colors.textPrimary,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 14,
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
    }
});
