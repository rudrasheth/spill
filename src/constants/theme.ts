import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    brand: '#FF3B5C',
    text: '#1A1A1A',
    background: '#FFFFFF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FF3B5C',
    textSecondary: '#8A8A8A',
    border: '#F5F5F5',
    surface: '#F5F5F5',
    muted: '#8A8A8A',
    redact: '#FF3B5C',
    signal: '#FF3B5C',
    static: '#F5F5F5',
    pulse: '#FF3B5C',
    ink: '#1A1A1A',
  },
  dark: { // force light mode anyway, user wants white
    brand: '#FF3B5C',
    text: '#1A1A1A',
    background: '#FFFFFF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FF3B5C',
    textSecondary: '#8A8A8A',
    border: '#F5F5F5',
    surface: '#F5F5F5',
    muted: '#8A8A8A',
    redact: '#FF3B5C',
    signal: '#FF3B5C',
    static: '#F5F5F5',
    pulse: '#FF3B5C',
    ink: '#1A1A1A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Courier',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'Georgia, serif',
    rounded: 'system-ui',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
