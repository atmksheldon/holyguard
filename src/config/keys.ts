import Constants from 'expo-constants';

// Google Maps/Places API key for runtime use.
// The authoritative source is app.json (required by Expo for native Maps SDK).
// This reads from the Expo config at runtime so the key is defined in one place.
export const GOOGLE_PLACES_API_KEY: string =
  Constants.expoConfig?.ios?.config?.googleMapsApiKey ?? '';
