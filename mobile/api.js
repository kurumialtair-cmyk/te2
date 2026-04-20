import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Production-first API configuration:
// 1) Set EXPO_PUBLIC_API_BASE to your deployed backend (recommended)
// 2) In development, auto-detect local host / emulator host
const envBase = process.env.EXPO_PUBLIC_API_BASE;
const PROD_API_BASE = 'https://te2-ngw0.onrender.com';
const extraBase = Constants?.expoConfig?.extra?.apiBase;

function getDevApiBase() {
  const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest2?.extra?.expoGo?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:8000`;
  }
  // Android emulator cannot use localhost directly for host machine services.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';
}

export const API_BASE = envBase || extraBase || (__DEV__ ? getDevApiBase() : PROD_API_BASE);
