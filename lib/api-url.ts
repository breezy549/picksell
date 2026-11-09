import {Platform} from 'react-native';

// A combined web/API deployment needs no baked-in host. Native clients and
// separately hosted Expo frontends still use EXPO_PUBLIC_API_URL.
export function apiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return '';
}
