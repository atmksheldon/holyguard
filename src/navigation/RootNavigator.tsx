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
import { TosAcceptanceScreen } from '../screens/TosAcceptanceScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { SubscriptionExpiredScreen } from '../screens/SubscriptionExpiredScreen';
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
                ) : !user.tosAcceptedAt ? (
                    <TosAcceptanceScreen />
                ) : user.organizationStatus === 'pending' ? (
                    <PendingApprovalScreen />
                ) : user.organizationStatus === 'rejected' ? (
                    <RejectedScreen />
                ) : user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'cancelled' ? (
                    // Admins see the paywall to subscribe; members see an info screen
                    user.role === 'admin' || user.role === 'super_admin' ? (
                        <PaywallScreen />
                    ) : (
                        <SubscriptionExpiredScreen />
                    )
                ) : (
                    <AppNavigator />
                )
            ) : (
                <AuthStack />
            )}
        </NavigationContainer>
    );
};
