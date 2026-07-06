import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Lock, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react-native';
import { router } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { supabase, mockDatabase } from '@/lib/supabase';

const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  glass: '#FFFFFF',
  glassDark: '#F5F5F5',
  border: '#EAEAEA',
};

const SEED_IMAGES = {
  classified_dossier: require('@/assets/images/classified_dossier.png'),
  night_market_gossip: require('@/assets/images/night_market_gossip.png'),
  confidential_leak: require('@/assets/images/confidential_leak.png'),
};

export default function PostCreationScreen() {
  const [caption, setCaption] = useState('');
  const [unlockPrice, setUnlockPrice] = useState(5);
  const [selectedMediaKey, setSelectedMediaKey] = useState<keyof typeof SEED_IMAGES>('classified_dossier');
  const [customImageUri, setCustomImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [piiDetected, setPiiDetected] = useState(false);
  const [redactedCaption, setRedactedCaption] = useState('');
  const [forceReview, setForceReview] = useState(false);

  const handleSelectPredefined = (key: keyof typeof SEED_IMAGES) => {
    setCustomImageUri(null);
    setSelectedMediaKey(key);
  };

  const handleCustomUpload = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) setCustomImageUri(event.target.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      setCustomImageUri('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500');
    }
  };

  const handlePublish = async () => {
    if (!caption.trim()) { alert('Gossip text cannot be empty.'); return; }
    const me = mockDatabase.getCurrentUser();
    if (!me) return;

    setIsScanning(true);
    setPiiDetected(false);

    setScanStep('INITIATING LLaVA V2 VISION SCAN...');
    await new Promise(r => setTimeout(r, 1200));
    setScanStep('EXTRACTING SCREENSHOT TEXT & METADATA...');
    await new Promise(r => setTimeout(r, 1000));

    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const hasPhone = phonePattern.test(caption);
    const mentionsNames = caption.toLowerCase().includes('ceo of') || caption.toLowerCase().includes('founder of');
    let finalCaption = caption;

    if (hasPhone || mentionsNames || caption.toLowerCase().includes('doxx') || caption.toLowerCase().includes('phone')) {
      setScanStep('PII DETECTED — INITIATING OPENCV BOUNDING BOX BLUR...');
      setPiiDetected(true);
      await new Promise(r => setTimeout(r, 1500));
      finalCaption = caption.replace(phonePattern, '[REDACTED PHONE]');
      if (caption.toLowerCase().includes('doxx')) finalCaption = finalCaption.replace(/doxx/gi, '[REDACTED]');
      setRedactedCaption(finalCaption);
    } else {
      setScanStep('AI SCAN PASS: NO CRITICAL PII DETECTED.');
      await new Promise(r => setTimeout(r, 800));
    }

    if (forceReview || caption.toLowerCase().includes('audit') || caption.toLowerCase().includes('illegal')) {
      setScanStep('LOW CONFIDENCE (0.64) → ROUTING TO OPERATOR REVIEW...');
      await new Promise(r => setTimeout(r, 1800));
      const newPost = mockDatabase.insertPost({
        hashed_author_id: me.id,
        media_url: customImageUri || selectedMediaKey,
        caption: finalCaption,
        unlock_price: unlockPrice,
        redis_key: 'spill:post:' + Math.random().toString(36).substring(2, 9),
      });
      mockDatabase.reportPost(newPost.id, me.id, 'AI Auto-Flag: Low vision confidence');
      setIsScanning(false);
      alert('Post submitted and routed to Operator review queue.');
      router.push('/profile');
      return;
    }

    setScanStep('CREATING REDIS TTL KEY (6H LEASE)... APPROVED.');
    await new Promise(r => setTimeout(r, 800));

    mockDatabase.insertPost({
      hashed_author_id: me.id,
      media_url: customImageUri || selectedMediaKey,
      caption: finalCaption,
      unlock_price: unlockPrice,
      redis_key: 'spill:post:' + Math.random().toString(36).substring(2, 9),
    });
    mockDatabase.grantTokens(me.id, 3);
    mockDatabase.saveState();
    setIsScanning(false);
    router.push('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>SPILL GOSSIP</Text>
            <Text style={styles.subtitle}>SUBMIT VERIFIED INTELLIGENCE</Text>
          </View>
          <Pressable style={styles.publishBtn} onPress={handlePublish}>
            <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.publishText}>PUBLISH  +3</Text>
          </Pressable>
        </View>

        {/* ── Warning ── */}
        <View style={styles.alertBanner}>
          <ShieldAlert size={13} color={T.brand} />
          <Text style={styles.alertText}>
            No pure-text posts · No doxxing · Auto-blur on reports
          </Text>
        </View>

        {/* ── Two-column body ── */}
        <View style={styles.bodyRow}>

          {/* LEFT — proof selector */}
          <View style={styles.leftCol}>
            <Text style={styles.sectionLabel}>PROOF</Text>

            <View style={styles.mediaStack}>
              {Object.keys(SEED_IMAGES).map((key) => {
                const isSelected = selectedMediaKey === key && !customImageUri;
                return (
                  <Pressable
                    key={key}
                    style={[styles.mediaCard, isSelected && styles.mediaCardSelected]}
                    onPress={() => handleSelectPredefined(key as keyof typeof SEED_IMAGES)}
                  >
                    <Image
                      source={SEED_IMAGES[key as keyof typeof SEED_IMAGES]}
                      style={styles.mediaPreview}
                    />
                    {isSelected && <View style={styles.selectedBadge} />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[styles.uploadBtn, customImageUri && styles.uploadBtnActive]}
              onPress={handleCustomUpload}
            >
              <Camera size={13} color={customImageUri ? T.brand : T.muted} />
              <Text style={[styles.uploadText, customImageUri && styles.uploadTextActive]}>
                {customImageUri ? 'LOADED ✓' : 'UPLOAD'}
              </Text>
            </Pressable>

            {customImageUri && (
              <View style={styles.customPreview}>
                <Image source={{ uri: customImageUri }} style={styles.customPreviewImg} />
              </View>
            )}
          </View>

          {/* RIGHT — inputs */}
          <View style={styles.rightCol}>
            <Text style={styles.sectionLabel}>SUBSTANCE</Text>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.captionInput}
                multiline
                numberOfLines={5}
                placeholder={"What's the scoop?\n\nTip: type a phone number to trigger AI redaction."}
                placeholderTextColor={T.textMuted}
                value={caption}
                onChangeText={setCaption}
              />
              <Text style={styles.charCount}>{caption.length}/280</Text>
            </View>

            <Text style={styles.sectionLabel}>PRICE</Text>
            <View style={styles.priceRow}>
              <Lock size={12} color={T.text} />
              <Text style={styles.priceLabel}>Receipts to unlock:</Text>
              <View style={styles.priceButtons}>
                {[3, 5, 8, 10].map((price) => (
                  <Pressable
                    key={price}
                    style={[styles.priceBtn, unlockPrice === price && styles.priceBtnActive]}
                    onPress={() => setUnlockPrice(price)}
                  >
                    <Text style={[styles.priceBtnText, unlockPrice === price && styles.priceBtnTextActive]}>
                      {price}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.sectionLabel}>DEBUG MODE</Text>
            <View style={styles.toggleCard}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Force Operator Review</Text>
                  <Text style={styles.toggleDesc}>Simulate low LLaVA confidence (0.54)</Text>
                </View>
                <Switch
                  value={forceReview}
                  onValueChange={setForceReview}
                  trackColor={{ false: '#EAEAEA', true: T.brand }}
                  thumbColor={'#FFFFFF'}
                />
              </View>
            </View>
          </View>
        </View>

      </ScrollView>

      {isScanning && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={T.brand} />
            <Text style={styles.overlayTitle}>SPILL GUARDRAIL ACTIVE</Text>
            <Text style={styles.overlayStatus}>{scanStep}</Text>
            {piiDetected && (
              <View style={styles.piiNotice}>
                <ShieldCheck size={16} color={T.brand} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.piiTitle}>OPENCV REDACTION TRIGGERED</Text>
                  <Text style={styles.piiCaption}>{redactedCaption}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 60,
    width: '100%',
    flexGrow: 1,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Outfit',
    fontSize: 26,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: '#8A8A8A',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 2,
  },
  publishBtn: {
    backgroundColor: T.brand,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishText: {
    fontFamily: 'Outfit',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },

  // Alert
  alertBanner: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  alertText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: T.brand,
    flex: 1,
    fontWeight: '600',
  },

  // Layout
  bodyRow: { flexDirection: 'row', gap: 40, alignItems: 'stretch', flex: 1 },
  leftCol: { flex: 1 },
  rightCol: { flex: 1.5, justifyContent: 'space-between' },

  sectionLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: 'rgba(26,26,46,0.55)',
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: Spacing.three,
  },

  // Media
  mediaStack: { gap: 8 },
  mediaCard: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mediaCardSelected: {
    borderColor: T.brand,
    borderWidth: 2,
  },
  mediaPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.brand,
  },
  uploadBtn: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  uploadBtnActive: { borderColor: T.brand, backgroundColor: '#F5F5F5' },
  uploadText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#8A8A8A',
    fontWeight: '600',
  },
  uploadTextActive: { color: T.brand },
  customPreview: {
    width: '100%',
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  customPreviewImg: { width: '100%', height: '100%', resizeMode: 'contain' },

  // Right inputs
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: Spacing.three,
    borderRadius: 12,
    flex: 1,
  },
  captionInput: {
    color: '#1A1A1A',
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    flex: 1,
    minHeight: 250,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: T.muted,
    marginTop: 4,
  },

  priceRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: Spacing.two,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#1A1A1A',
    flex: 1,
    fontWeight: '500',
  },
  priceButtons: { flexDirection: 'row', gap: 6 },
  priceBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  priceBtnActive: { backgroundColor: T.brand, borderColor: T.brand },
  priceBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8A8A8A',
  },
  priceBtnTextActive: { color: '#FFFFFF' },

  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: Spacing.two,
    borderRadius: 12,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: 'bold', color: '#1A1A1A' },
  toggleDesc: { fontFamily: 'Inter', fontSize: 10, color: '#8A8A8A', marginTop: 2 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayCard: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: T.brand,
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    shadowColor: T.brand,
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  overlayTitle: {
    fontFamily: 'Outfit',
    fontSize: 17,
    fontWeight: '900',
    color: T.brand,
    marginTop: Spacing.three,
    letterSpacing: 0,
  },
  overlayStatus: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  piiNotice: {
    marginTop: Spacing.three,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: T.brand,
    borderRadius: 8,
    padding: Spacing.two,
    flexDirection: 'row',
    width: '100%',
  },
  piiTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: T.brand,
    marginBottom: 4,
  },
  piiCaption: { fontFamily: 'Inter', fontSize: 12, color: '#1A1A1A' },
});
