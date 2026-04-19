import { Platform } from 'react-native';

// Override with EXPO_PUBLIC_API_BASE for physical devices, e.g.:
// EXPO_PUBLIC_API_BASE=http://192.168.1.10:8000
const envBase = process.env.EXPO_PUBLIC_API_BASE;

// Android emulator cannot use localhost directly for host machine services.
const devDefaultBase =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

export const API_BASE = envBase || (__DEV__ ? devDefaultBase : 'https://your-backend.example.com');
