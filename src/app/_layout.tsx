import React, { useEffect, useState } from 'react';
import { Slot, router, usePathname } from 'expo-router';
import { ThemeProvider, DefaultTheme } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Flame, Zap, Plus, Ticket, Terminal, Command, Menu, X } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  border: '#EAEAEA',
  success: '#30D158',
};

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktop = width >= 1024 && Platform.OS === 'web';
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!mounted) return null;

  const buttons = [
    { name: 'Feed',   path: '/',        icon: Flame    },
    { name: 'Groups', path: '/chaos',   icon: Zap      },
    { name: 'Spill',  path: '/post',    icon: Plus     },
    { name: 'Wallet', path: '/wallet',  icon: Ticket   },
    { name: 'Logs',   path: '/profile', icon: Terminal },
  ];

  const renderDesktopSidebar = () => (
    <View style={styles.desktopSidebar}>
      {/* Brand */}
      <View style={styles.brandContainer}>
        <View style={styles.brandIcon}>
          <Command size={18} color={'#FFFFFF'} />
        </View>
        <Text style={styles.brandTitle}>Spill</Text>
      </View>

      <Text style={styles.menuLabel}>MENU</Text>

      <View style={styles.navGroup}>
        {buttons.map((btn) => {
          const isFocused = pathname === btn.path;
          const Icon = btn.icon;
          return (
            <Pressable
              key={btn.path}
              onPress={() => router.push(btn.path as any)}
              style={({ pressed }) => [
                styles.sidebarBtn,
                isFocused && styles.sidebarBtnFocused,
                pressed && styles.pressed,
              ]}
            >
              <Icon size={16} color={isFocused ? '#FFFFFF' : T.text} style={styles.iconSpacing} />
              <Text style={[styles.sidebarBtnText, isFocused ? styles.textActive : styles.textInactive]}>
                {btn.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderRightSidebar = () => (
    <View style={styles.rightSidebar}>
      <Text style={styles.rightSidebarTitle}>TRENDING INTEL</Text>
      
      <View style={styles.trendingCard}>
        <Text style={styles.trendingTopic}>#FintechLayoffs</Text>
        <Text style={styles.trendingStats}>42 posts • 8.4k unlocks</Text>
      </View>
      
      <View style={styles.trendingCard}>
        <Text style={styles.trendingTopic}>#CEOFlightLogs</Text>
        <Text style={styles.trendingStats}>18 posts • 3.2k unlocks</Text>
      </View>
      
      <View style={styles.trendingCard}>
        <Text style={styles.trendingTopic}>#SeriesC_Downround</Text>
        <Text style={styles.trendingStats}>9 posts • 1.1k unlocks</Text>
      </View>

      <Text style={[styles.rightSidebarTitle, { marginTop: Spacing.four }]}>TOP AGENTS</Text>
      <View style={styles.agentRow}>
        <View style={styles.agentAvatar} />
        <View>
          <Text style={styles.agentName}>TeaSpiller_02</Text>
          <Text style={styles.agentStats}>Instigator • 2.4k RCPT</Text>
        </View>
      </View>
      <View style={styles.agentRow}>
        <View style={styles.agentAvatar} />
        <View>
          <Text style={styles.agentName}>RumorMill_99</Text>
          <Text style={styles.agentStats}>Lurker • 890 RCPT</Text>
        </View>
      </View>
    </View>
  );

  if (isDesktop) {
    return (
      <ThemeProvider value={DefaultTheme}>
        <View style={styles.desktopContainer}>
          {renderDesktopSidebar()}
          <View style={styles.mainContent}>
            <Slot />
          </View>
          {renderRightSidebar()}
        </View>
      </ThemeProvider>
    );
  }

  // Custom Mobile Layout with Collapsible Dashboard
  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={styles.mobileContainer}>
        {/* Mobile Top Bar */}
        <View style={styles.mobileTopBar}>
          <Pressable onPress={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} color={T.text} />
          </Pressable>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <View style={styles.brandIconSmall}><Command size={14} color={'#FFFFFF'} /></View>
            <Text style={styles.brandTitleSmall}>Spill</Text>
          </View>
          <View style={{width: 24}} />
        </View>

        <View style={styles.mainContent}>
          <Slot />
        </View>

        {isMobileMenuOpen && (
          <View style={styles.mobileMenuOverlay}>
            <Pressable style={styles.mobileMenuBackdrop} onPress={() => setIsMobileMenuOpen(false)} />
            <View style={styles.mobileMenuSidebar}>
              <Pressable onPress={() => setIsMobileMenuOpen(false)} style={{alignSelf: 'flex-end', marginBottom: 10}}>
                <X size={24} color={T.text} />
              </Pressable>
              
              <Text style={styles.menuLabel}>MENU</Text>
              <View style={styles.navGroup}>
                {buttons.map((btn) => {
                  const isFocused = pathname === btn.path || (pathname === '/index' && btn.path === '/');
                  const Icon = btn.icon;
                  return (
                    <Pressable
                      key={btn.path}
                      onPress={() => {
                        setIsMobileMenuOpen(false);
                        router.push(btn.path as any);
                      }}
                      style={({ pressed }) => [
                        styles.sidebarBtn,
                        isFocused && styles.sidebarBtnFocused,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon size={18} color={isFocused ? '#FFFFFF' : T.text} style={styles.iconSpacing} />
                      <Text style={[styles.sidebarBtnText, isFocused ? styles.textActive : styles.textInactive, {fontSize: 18}]}>
                        {btn.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flexDirection: 'row',
    flex: 1,
    height: Platform.OS === 'web' ? '100vh' : '100%',
    backgroundColor: '#FFFFFF',
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    height: Platform.OS === 'web' ? '100dvh' : '100%',
  },

  // ── Sidebar ─────────────────────────────────────────
  desktopSidebar: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#EAEAEA',
    padding: Spacing.four,
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },

  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.six,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'Outfit',
    fontSize: 24,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.5,
  },

  menuLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: '700',
    color: T.muted,
    marginBottom: Spacing.two,
    letterSpacing: 2,
  },

  navGroup: { flex: 1, gap: 4 },

  sidebarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sidebarBtnFocused: {
    backgroundColor: T.brand,
  },
  iconSpacing: { marginRight: 12 },
  sidebarBtnText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  textActive:   { color: '#FFFFFF' },
  textInactive: { color: T.text },
  pressed: { opacity: 0.75 },

  // ── Right Sidebar ─────────────────────────────────────────
  rightSidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#EAEAEA',
    padding: Spacing.four,
    flexDirection: 'column',
  },
  rightSidebarTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8A8A8A',
    marginBottom: Spacing.three,
    letterSpacing: 1,
  },
  trendingCard: {
    backgroundColor: '#F5F5F5',
    padding: Spacing.three,
    borderRadius: 8,
    marginBottom: Spacing.two,
  },
  trendingTopic: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  trendingStats: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#8A8A8A',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.two,
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  agentName: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  agentStats: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: '#8A8A8A',
    marginTop: 2,
  },
  // ── Mobile Elements ─────────────────────────────────────────
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  brandIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitleSmall: {
    fontFamily: 'Outfit',
    fontSize: 20,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.5,
  },
  mobileMenuOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    zIndex: 999,
  },
  mobileMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileMenuSidebar: {
    width: '75%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    height: '100%',
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
});
