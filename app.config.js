require('dotenv').config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    name: "holyguard",
    slug: "holyguard",
    version: "1.0.0",
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
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "76276ecb-b99b-4804-a997-8d28e27e7e25",
      },
    },
  },
};
