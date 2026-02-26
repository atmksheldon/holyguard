import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import { UserProfile } from '../types';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextData {
    user: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const mapOrgStatus = (status: string | undefined): 'pending' | 'verified' | 'rejected' => {
    if (!status) return 'verified';
    if (status === 'Active') return 'verified';
    if (status === 'verified' || status === 'pending' || status === 'rejected') return status;
    return 'verified';
};

const USER_CACHE_KEY = '@holyguard_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Load cached user on mount for instant startup
    useEffect(() => {
        const loadCachedUser = async () => {
            try {
                const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
                if (cached) {
                    const cachedUser = JSON.parse(cached);
                    setUser(cachedUser);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error loading cached user:', error);
            }
        };
        loadCachedUser();
    }, []);

    useEffect(() => {
        // Listen for auth changes
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                await fetchUserProfile(firebaseUser.uid);
            } else {
                setUser(null);
                await AsyncStorage.removeItem(USER_CACHE_KEY);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const fetchUserProfile = async (userId: string) => {
        try {
            // Read directly from Firestore
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                throw new Error('User document not found');
            }

            const userData = userDoc.data();
            const orgId = userData.organizationId || userData.organization_id || 'default-org';

            // Fetch organization status
            let orgStatus: 'pending' | 'verified' | 'rejected' = 'verified';
            let orgName = '';

            if (orgId && orgId !== 'default-org') {
                // Try to find org by querying the id field (existing pattern)
                const orgsQuery = query(collection(db, 'organizations'), where('id', '==', orgId));
                const orgSnapshot = await getDocs(orgsQuery);
                if (!orgSnapshot.empty) {
                    const orgData = orgSnapshot.docs[0].data();
                    orgStatus = mapOrgStatus(orgData.status);
                    orgName = orgData.name || '';
                }
            }

            const profile: UserProfile = {
                id: userId,
                name: userData.name || auth.currentUser?.displayName || 'User',
                role: userData.role || 'member',
                organizationId: orgId,
                emailVerified: auth.currentUser?.emailVerified || false,
                organizationStatus: orgStatus,
                organizationName: orgName,
            };

            setUser(profile);
            await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(profile));
        } catch (error: any) {
            console.error('Error fetching user profile:', error);
            // Fallback: create profile from Firebase Auth data
            const fallbackProfile: UserProfile = {
                id: userId,
                name: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User',
                role: 'member',
                organizationId: 'default-org',
                emailVerified: auth.currentUser?.emailVerified || false,
                organizationStatus: 'verified',
            };

            setUser(fallbackProfile);
            await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(fallbackProfile));

            Alert.alert('Notice', 'Could not load profile. Please try logging out and back in.');
        }
    };

    const refreshProfile = async () => {
        if (auth.currentUser) {
            await fetchUserProfile(auth.currentUser.uid);
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem(USER_CACHE_KEY);
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
