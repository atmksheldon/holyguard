require('dotenv').config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';
const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY || '';

module.exports = {
  expo: {
    name: "holyguard",
    slug: "holyguard",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.lonestardevops.holyguard",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "HolyGuard uses your camera to capture photos of security incidents so your team can see what happened and respond quickly.",
        NSLocationWhenInUseUsageDescription: "HolyGuard uses your location to tag incident reports with GPS coordinates so your security team knows exactly where an incident occurred.",
        NSPhotoLibraryUsageDescription: "HolyGuard accesses your photo library so you can attach existing photos to incident reports and watchlist entries.",
      },
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.lonestardevops.holyguard",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
    },
    plugins: [
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
        },
      ],
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "76276ecb-b99b-4804-a997-8d28e27e7e25",
      },
      mapboxAccessToken: MAPBOX_ACCESS_TOKEN,
      revenueCatApiKey: REVENUECAT_API_KEY,
    },
  },
};
