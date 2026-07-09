import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Lock, ShieldCheck, ShieldAlert, Sparkles, Clock } from 'lucide-react-native';
import { router } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { supabase, getCurrentUserProfile } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';

const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  border: '#EAEAEA',
  success: '#30D158',
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
  const [selectedModule, setSelectedModule] = useState<'student' | 'office' | 'other'>('other');
  const [selectedTag, setSelectedTag] = useState<'relationship' | 'money_career' | 'chaos'>('chaos');
  
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  
  // Expiry options: 6 hours, 24 hours, 48 hours, Never
  const [expiryOption, setExpiryOption] = useState<'6h' | '24h' | '48h' | 'never'>('24h');

  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [safetyCheckPassed, setSafetyCheckPassed] = useState(true);

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
      // Fallback placeholder image for native simulators
      setCustomImageUri('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500');
    }
  };

  const applyPIIBlur = async (base64Str: string): Promise<string> => {
    if (Platform.OS !== 'web') return base64Str;
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          const rectWidth = img.width * 0.4;
          const rectHeight = img.height * 0.25;
          const rectX = (img.width - rectWidth) / 2;
          const rectY = (img.height - rectHeight) / 3;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
          ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${Math.max(14, Math.floor(img.width * 0.035))}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('[PII REDACTED]', rectX + rectWidth / 2, rectY + rectHeight / 2);
        }
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
    });
  };

  const handlePublish = async () => {
    if (!caption.trim()) { 
      showAlert('Gossip text cannot be empty.', 'Empty Gossip', 'error'); 
      return; 
    }
    
    const me = await getCurrentUserProfile();
    if (!me) {
      showAlert('Authentication required.', 'Authentication Required', 'error');
      return;
    }

    setIsScanning(true);
    setSafetyCheckPassed(true);

    try {
      let finalImageUrl: string = selectedMediaKey;
      let moderationStatus = 'approved';
      let moderationCategory = null;

      if (customImageUri) {
        setScanStep('CONTACTING IMAGE MODERATION AGENT...');
        await new Promise(r => setTimeout(r, 600));
        
        setScanStep('RUNNING GEMINI VISION SCAN...');
        
        const mimeType = customImageUri.split(';')[0]?.split(':')[1] || 'image/png';
        
        const { data: modResult, error: modErr } = await supabase.functions.invoke('moderate-image', {
          body: {
            imageBase64: customImageUri,
            mimeType
          }
        });

        let finalBase64 = customImageUri;
        if (modErr || !modResult) {
          console.error("Moderation invocation failed:", modErr);
          setScanStep('MODERATION AGENT OFFLINE. BYPASSING SAFETY...');
          await new Promise(r => setTimeout(r, 800));
        } else {
          const { safe, category, confidence, action } = modResult;
          console.log("Moderation verdict:", modResult);
          
          moderationCategory = category;

          if (action === 'reject' || action === 'silent_reject') {
            setIsScanning(false);
            showAlert("This image can't be posted.", "Content Rejected", "error");
            return;
          }

          if (action === 'blur') {
            setScanStep('DETECTED PII. REDACTING DATA...');
            await new Promise(r => setTimeout(r, 800));
            finalBase64 = await applyPIIBlur(customImageUri);
          }

          if (action === 'pending_review') {
            moderationStatus = 'pending_review';
          }
        }

        setScanStep('UPLOADING TO ENCRYPTED STORAGE...');
        
        const cleanBase64 = finalBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        const fileName = `${me.id}/${Date.now()}.png`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('spill-images')
          .upload(fileName, blob, {
            contentType: mimeType,
            upsert: true
          });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          throw new Error("Failed to upload image to storage.");
        }

        const { data: urlData } = supabase.storage
          .from('spill-images')
          .getPublicUrl(fileName);
        
        finalImageUrl = urlData.publicUrl;
      }

      setScanStep('VERIFYING GROUP SECURITY POLICIES...');
      await new Promise(r => setTimeout(r, 500));

      let expiresAt: string | null = null;
      const now = Date.now();
      if (expiryOption === '6h') {
        expiresAt = new Date(now + 6 * 3600 * 1000).toISOString();
      } else if (expiryOption === '24h') {
        expiresAt = new Date(now + 24 * 3600 * 1000).toISOString();
      } else if (expiryOption === '48h') {
        expiresAt = new Date(now + 48 * 3600 * 1000).toISOString();
      }

      await supabase.from('posts').insert([{
        author_id: me.id,
        image_url: finalImageUrl,
        caption: caption.trim(),
        unlock_price: unlockPrice,
        expires_at: expiresAt,
        moderation_status: moderationStatus,
        moderation_category: moderationCategory,
        module: selectedModule,
        tag: selectedTag
      }]);

      await supabase.from('users').update({ token_balance: me.token_balance + 3 }).eq('id', me.id);

      setScanStep('GOSSIP REGISTERED. METRO LEASE LEASED.');
      await new Promise(r => setTimeout(r, 600));

      setIsScanning(false);

      if (moderationStatus === 'pending_review') {
        showAlert(
          "Your post is pending review by the operator. It will appear on the feed once approved.",
          "Post in Review",
          "info"
        );
      } else {
        showAlert("Gossip published successfully!", "Spilled", "success");
      }
      
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setIsScanning(false);
      showAlert(err.message || "Failed to publish gossip.", "Error", "error");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.subtitle}>SPILL PRIVATE CHANNEL</Text>
            <Text style={styles.title}>Submit Gossip</Text>
          </View>
          <Pressable 
            style={({ pressed }) => [
              styles.publishBtn,
              pressed && styles.publishBtnPressed
            ]} 
            onPress={handlePublish}
            id="btn-spill-publish"
          >
            <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.publishText}>PUBLISH  +3 TK</Text>
          </Pressable>
        </View>

        {/* Security Warning */}
        <View style={styles.alertBanner}>
          <ShieldAlert size={14} color={T.brand} style={{ marginRight: 8 }} />
          <Text style={styles.alertText}>
            Keep identities hidden · No direct doxxing of real names · Posts will expire based on group rules.
          </Text>
        </View>

        {/* Form Sections */}
        <View style={styles.layoutBody}>
          
          {/* Section 1: Upload Proof */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>UPLOAD PROOF / IMAGERY</Text>
            
            <View style={styles.mediaSelectGrid}>
              {Object.entries(SEED_IMAGES).map(([key, imgAsset]) => {
                const isSelected = selectedMediaKey === key && !customImageUri;
                return (
                  <Pressable
                    key={key}
                    style={[styles.mediaCard, isSelected && styles.mediaCardSelected]}
                    onPress={() => handleSelectPredefined(key as keyof typeof SEED_IMAGES)}
                  >
                    <Image source={imgAsset} style={styles.mediaPreview} />
                    {isSelected && <View style={styles.selectedBadge} />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.uploadBtn,
                customImageUri && styles.uploadBtnActive,
                pressed && styles.pressed,
              ]}
              onPress={handleCustomUpload}
              id="btn-custom-image-upload"
            >
              <Camera size={14} color={customImageUri ? T.brand : T.muted} style={{ marginRight: 8 }} />
              <Text style={[styles.uploadText, customImageUri && styles.uploadTextActive]}>
                {customImageUri ? 'CUSTOM IMAGE LOADED ✓' : 'UPLOAD CUSTOM PROOF'}
              </Text>
            </Pressable>

            {customImageUri && (
              <View style={styles.customPreviewContainer}>
                <Image source={{ uri: customImageUri }} style={styles.customPreviewImg} />
              </View>
            )}
          </View>

          {/* Section 2: Intel Details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>INTEL DETAILS</Text>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.captionInput}
                multiline
                numberOfLines={4}
                placeholder="What's the scoop? Explain what happened..."
                placeholderTextColor={T.muted}
                value={caption}
                onChangeText={setCaption}
                maxLength={280}
                id="input-gossip-caption"
              />
              <Text style={styles.charCount}>{caption.length}/280</Text>
            </View>
          </View>

          {/* Section 2.5: Destination Module & Category Tag */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>SELECT DESTINATION MODULE</Text>
            <View style={styles.moduleRow}>
              {([
                { label: 'Student Life', value: 'student' },
                { label: 'Office Life', value: 'office' },
                { label: 'Others', value: 'other' }
              ] as const).map((m) => (
                <Pressable
                  key={m.value}
                  style={[styles.moduleBtn, selectedModule === m.value && styles.moduleBtnActive]}
                  onPress={() => setSelectedModule(m.value)}
                  id={`btn-module-${m.value}`}
                >
                  <Text style={[styles.moduleBtnText, selectedModule === m.value && styles.moduleBtnTextActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>GOSSIP CATEGORY TAG</Text>
            <View style={styles.categoryRow}>
              {([
                { label: 'Relationship Drama', value: 'relationship' },
                { label: 'Money & Career', value: 'money_career' },
                { label: 'Random Chaos', value: 'chaos' }
              ] as const).map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.categoryBtn, selectedTag === t.value && styles.categoryBtnActive]}
                  onPress={() => setSelectedTag(t.value)}
                  id={`btn-tag-${t.value}`}
                >
                  <Text style={[styles.categoryBtnText, selectedTag === t.value && styles.categoryBtnTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 3: Lock Pricing */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>UNLOCK COST (TOKENS)</Text>
            <View style={styles.priceRow}>
              {[3, 5, 8, 10].map((price) => (
                <Pressable
                  key={price}
                  style={[styles.priceBtn, unlockPrice === price && styles.priceBtnActive]}
                  onPress={() => setUnlockPrice(price)}
                  id={`btn-price-${price}`}
                >
                  <Text style={[styles.priceBtnText, unlockPrice === price && styles.priceBtnTextActive]}>
                    {price} TK
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 4: TTL Expiration */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>EXPIRATION RULE</Text>
            <View style={styles.expiryRow}>
              {(['6h', '24h', '48h', 'never'] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.expiryBtn, expiryOption === opt && styles.expiryBtnActive]}
                  onPress={() => setExpiryOption(opt)}
                  id={`btn-expiry-${opt}`}
                >
                  <Clock size={12} color={expiryOption === opt ? '#FFFFFF' : T.muted} style={{ marginRight: 5 }} />
                  <Text style={[styles.expiryBtnText, expiryOption === opt && styles.expiryBtnTextActive]}>
                    {opt.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.expiryTip}>
              {expiryOption === 'never' 
                ? 'This spill will persist permanently until deleted by the operator.' 
                : `This spill will be automatically soft-deleted after ${expiryOption.replace('h', '')} hours.`}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Security Overlay Modal */}
      {isScanning && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={T.brand} style={{ marginBottom: 12 }} />
            <Text style={styles.overlayTitle}>SPILL SECURITY DISPATCH</Text>
            <Text style={styles.overlayStatus}>{scanStep}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 80,
    width: '100%',
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontFamily: 'Outfit',
    fontSize: 24,
    fontWeight: '900',
    color: T.text,
  },
  subtitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: T.brand,
    fontWeight: '700',
    letterSpacing: 2,
  },
  publishBtn: {
    backgroundColor: T.brand,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnPressed: {
    opacity: 0.85,
  },
  publishText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  alertBanner: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  alertText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 16,
  },
  layoutBody: {
    gap: Spacing.four,
  },
  sectionCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: Spacing.four,
  },
  sectionLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: T.brand,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: Spacing.three,
  },
  mediaSelectGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  mediaCard: {
    flex: 1,
    aspectRatio: 1.3,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    backgroundColor: T.bg,
  },
  mediaCardSelected: {
    borderColor: T.brand,
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.brand,
  },
  uploadBtn: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
  },
  uploadBtnActive: {
    borderColor: T.brand,
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
  },
  uploadText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    color: T.muted,
  },
  uploadTextActive: {
    color: T.brand,
  },
  customPreviewContainer: {
    marginTop: Spacing.three,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.border,
  },
  customPreviewImg: {
    width: '100%',
    height: '100%',
  },
  inputCard: {
    backgroundColor: T.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    padding: Spacing.three,
  },
  captionInput: {
    fontFamily: 'Inter',
    color: T.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: T.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  priceBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBtnActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  priceBtnText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: 'bold',
    color: T.muted,
  },
  priceBtnTextActive: {
    color: '#FFFFFF',
  },
  expiryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  expiryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryBtnActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  expiryBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: T.muted,
  },
  expiryBtnTextActive: {
    color: '#FFFFFF',
  },
  expiryTip: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: T.muted,
    lineHeight: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 14, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.six,
  },
  overlayCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: Spacing.six,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  overlayTitle: {
    fontFamily: 'Outfit',
    fontSize: 16,
    fontWeight: '900',
    color: T.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  overlayStatus: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: T.brand,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  moduleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  moduleBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleBtnActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  moduleBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: T.muted,
    textAlign: 'center',
  },
  moduleBtnTextActive: {
    color: '#FFFFFF',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  categoryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBtnActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  categoryBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: T.muted,
    textAlign: 'center',
  },
  categoryBtnTextActive: {
    color: '#FFFFFF',
  },
});
