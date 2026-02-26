import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

interface IncidentButtonProps {
    onPress: () => void;
}

export const IncidentButton: React.FC<IncidentButtonProps> = ({ onPress }) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity 
                style={styles.button} 
                onPress={onPress}
                activeOpacity={0.7}
            >
                <View style={styles.innerCircle}>
                    <MaterialCommunityIcons name="camera-wireless" size={48} color={theme.colors.white} />
                    <Text style={styles.text}>REPORT</Text>
                </View>
            </TouchableOpacity>
            <Text style={styles.instruction}>Tap to Capture</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: theme.spacing.xl,
    },
    button: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: theme.colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        
        // Depth and shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 12,
        
        // Border for "tactical" feel
        borderWidth: 6,
        borderColor: '#800000', // Darker Red
    },
    innerCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)', // Subtle inner ring
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: theme.colors.white,
        fontSize: 20,
        fontWeight: '900',
        marginTop: 8,
        letterSpacing: 1.5,
    },
    instruction: {
        marginTop: theme.spacing.m,
        color: theme.colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
