import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { AppNavigator } from './AppNavigator';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { PendingApprovalScreen } from '../screens/PendingApprovalScreen';
import { RejectedScreen } from '../screens/RejectedScreen';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

const Stack = createNativeStackNavigator();

const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
);

export const RootNavigator = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    // Determine which stack to show based on auth state
    return (
        <NavigationContainer>
            {user ? (
                !user.emailVerified ? (
                    <VerifyEmailScreen />
                ) : user.organizationStatus === 'pending' ? (
                    <PendingApprovalScreen />
                ) : user.organizationStatus === 'rejected' ? (
                    <RejectedScreen />
                ) : (
                    <AppNavigator />
                )
            ) : (
                <AuthStack />
            )}
        </NavigationContainer>
    );
};
