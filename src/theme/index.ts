export const theme = {
  colors: {
    // Coyote / Earth Tones
    background: '#D2B48C', // Tan / Coyote Brownish
    surface: '#E6D2B5',    // Lighter tan for cards
    surfaceDark: '#8B7355', // Darker brown for contrast elements
    
    textPrimary: '#2F2F2F', // Dark Charcoal
    textSecondary: '#4A4A4A',
    textInverse: '#FFFFFF',

    // Action
    primary: '#8B4513', // SaddleBrown - used for active tabs maybe?
    accent: '#556B2F',  // Dark Olive Green
    
    // The Red Button
    danger: '#B22222', // Firebrick / Crimson
    
    // Utility
    white: '#FFFFFF',
    black: '#000000',
    gray: '#808080',
    
    // Status
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',

    // Incident category colors
    incidentTrespass: '#e74c3c',
    incidentGraffiti: '#9b59b6',
    incidentTheft: '#e67e22',
    incidentAssault: '#c0392b',
    incidentSuspicious: '#8e44ad',
    incidentMedical: '#27ae60',
    incidentFire: '#d35400',
    incidentActiveThreat: '#B22222',
    incidentVandalism: '#34495e',
    incidentOther: '#7f8c8d',

    // Watchlist status colors
    watchlistActive: '#e74c3c',
    watchlistMonitoring: '#e67e22',
    watchlistResolved: '#27ae60',

    // Alert level colors
    alertYellow: '#F59E0B', // Amber

    // Verification status colors
    verificationPending: '#F59E0B',  // Amber
    verificationVerified: '#10B981', // Green
    verificationRejected: '#EF4444', // Red
  },
  spacing: {
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
  },
  text: {
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#2F2F2F',
    },
    subHeader: {
      fontSize: 18,
      fontWeight: '600',
      color: '#4A4A4A',
    },
    body: {
      fontSize: 16,
      color: '#2F2F2F',
    },
    caption: {
      fontSize: 12,
      color: '#4A4A4A',
    }
  }
};
