import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  Image,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Unlock, Eye, HelpCircle, Edit2, Check, X } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { supabase, getCurrentUserProfile, Post } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';

const SEED_IMAGES: Record<string, any> = {
  classified_dossier: require('@/assets/images/classified_dossier.png'),
  night_market_gossip: require('@/assets/images/night_market_gossip.png'),
  confidential_leak: require('@/assets/images/confidential_leak.png'),
};

interface PeelableOverlayProps {
  item: Post;
  isUnlocked: boolean;
  onUnlock: () => void;
}

const PeelableOverlay = ({ item, isUnlocked, onUnlock }: PeelableOverlayProps) => {
  const peelAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(!isUnlocked);

  useEffect(() => {
    if (isUnlocked && shouldRender) {
      Animated.timing(peelAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [isUnlocked]);

  if (!shouldRender) return null;

  const translateX = peelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  });
  const translateY = peelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -300],
  });
  const rotate = peelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '25deg'],
  });
  const opacity = peelAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.5, 0],
  });

  return (
    <Animated.View style={[
      styles.blurOverlay,
      {
        opacity,
        transform: [
          { translateX },
          { translateY },
          { rotate },
        ]
      }
    ]}>
      <View style={styles.classifiedStamp}>
        <Text style={styles.classifiedText}>CLASSIFIED</Text>
      </View>
      <Text style={styles.overlayTeaser}>Encrypted Spill Media</Text>
      <Pressable
        style={({ pressed }) => [
          styles.unlockButton,
          pressed && styles.pressed,
        ]}
        onPress={onUnlock}
        id={`btn-unlock-${item.id}`}
      >
        <Eye size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.unlockButtonText}>Reveal for {item.unlock_price} Tokens</Text>
      </Pressable>
    </Animated.View>
  );
};

export default function GossipFeedScreen() {
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authorsMap, setAuthorsMap] = useState<Record<string, string>>({});
  
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');

  const [affinitiesMap, setAffinitiesMap] = useState<Record<string, number>>({});
  const [activeModuleFilter, setActiveModuleFilter] = useState<'all' | 'student' | 'office' | 'other'>('all');
  const [expandedWorthItIds, setExpandedWorthItIds] = useState<string[]>([]);

  const toggleWorthIt = (postId: string) => {
    setExpandedWorthItIds(prev =>
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  let numCols = 1;
  if (width >= 1024) numCols = 3;
  else if (width >= 768) numCols = 2;

  const loadFeedData = async () => {
    const me = await getCurrentUserProfile();
    if (!me) return;
    setCurrentUser(me);

    // Call the Postgres RPC function for personalized feed!
    const { data: postsData, error: feedErr } = await supabase.rpc('get_personalized_feed', { p_user_id: me.id });
    if (feedErr) {
      console.error("[Feed] RPC error:", feedErr.message);
    } else if (postsData) {
      setPosts(postsData);
      
      // Auto-increment view counts for posts returned in the feed
      const postIds = postsData.map((p: any) => p.id);
      if (postIds.length > 0) {
        await supabase.rpc('increment_post_views', { p_post_ids: postIds });
      }
    }

    const { data: unlocksData } = await supabase.from('unlocks').select('*').eq('unlocker_id', me.id);
    if (unlocksData) setUnlockedPostIds(unlocksData.map((u: any) => u.post_id));
    
    // Fetch all users to map author aliases
    const { data: usersData } = await supabase.from('users').select('id, alias');
    if (usersData) {
      const map: Record<string, string> = {};
      usersData.forEach((u: any) => map[u.id] = u.alias);
      setAuthorsMap(map);
    }
  };

  const getPersonalizedPosts = () => {
    // 1. Filter by active module
    let filtered = posts;
    if (activeModuleFilter !== 'all') {
      filtered = posts.filter(p => p.module === activeModuleFilter);
    }
    // Sort by personalization_score descending (since database computed it)
    return [...filtered].sort((a: any, b: any) => (b.personalization_score || 0) - (a.personalization_score || 0));
  };

  useEffect(() => {
    loadFeedData();
    const interval = setInterval(loadFeedData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUnlockPost = async (postId: string, price: number) => {
    if (!currentUser) return;
    if (currentUser.token_balance < price) {
      showAlert('Insufficient token balance. Head to the Wallet tab to load up.', 'Insufficient Balance', 'error');
      return;
    }
    try {
      await supabase.rpc('unlock_post', { p_post_id: postId, p_user_id: currentUser.id });
      loadFeedData();
    } catch (err: any) {
      showAlert(err.message || 'Unlock failed', 'Unlock Failed', 'error');
    }
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editCaption.trim()) return;
    try {
      await supabase.from('posts').update({ caption: editCaption }).eq('id', postId);
      setEditingPostId(null);
      loadFeedData();
    } catch (err: any) {
      showAlert(err.message || 'Edit failed', 'Edit Failed', 'error');
    }
  };

  const renderPostCard = ({ item }: { item: Post }) => {
    const isAuthor = item.author_id === currentUser?.id;
    const isUnlocked = unlockedPostIds.includes(item.id) || isAuthor;

    const authorAlias = authorsMap[item.author_id] ? `@${authorsMap[item.author_id]}` : '@Unknown';

    // Resolve Image Source
    let imageSource = SEED_IMAGES.confidential_leak;
    if (item.image_url) {
      if (item.image_url.startsWith('data:image') || item.image_url.startsWith('http')) {
        imageSource = { uri: item.image_url };
      } else if (SEED_IMAGES[item.image_url]) {
        imageSource = SEED_IMAGES[item.image_url];
      }
    }

    return (
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.authorBadge}>
            <Text style={styles.badgeText}>{authorAlias.substring(1, 3).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{authorAlias}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>VERIFIED GROUP AGENT</Text>
            </View>
          </View>
          <View style={styles.postBadges}>
            <View style={styles.postModuleBadgeContainer}>
              <Text style={styles.postModuleBadgeText}>
                {item.module === 'student' ? 'Student' : item.module === 'office' ? 'Office' : 'Other'}
              </Text>
            </View>
            <Text style={styles.postTagText}>
              #{item.tag === 'relationship' ? 'Relationship' : item.tag === 'money_career' ? 'Money' : 'Chaos'}
            </Text>
            {!isUnlocked && (
              <Pressable
                onPress={() => toggleWorthIt(item.id)}
                style={[
                  styles.worthItBadge,
                  item.worth_it_tier === 'high' ? styles.worthItBadgeHigh : styles.worthItBadgeMuted
                ]}
                id={`btn-worthit-${item.id}`}
              >
                <Text style={[
                  styles.worthItBadgeText,
                  item.worth_it_tier === 'high' ? styles.worthItBadgeTextHigh : styles.worthItBadgeTextMuted
                ]}>
                  {item.worth_it_tier === 'high' ? '🔥 Worth It' :
                   item.worth_it_tier === 'mixed' ? '🤔 Mixed' : '❓ New'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Worth It Explanation Container */}
        {expandedWorthItIds.includes(item.id) && !isUnlocked && (
          <View style={styles.worthItReasonContainer}>
            <Text style={styles.worthItReasonText}>
              {item.worth_it_reason || 'New poster — no history yet'}
            </Text>
          </View>
        )}

        {/* Media (Blurred/Unlocked) */}
        <View style={styles.mediaContainer}>
          <Image
            source={imageSource}
            style={styles.cardImage}
            blurRadius={isUnlocked ? 0 : 25}
            resizeMode="cover"
          />

          <PeelableOverlay
            item={item}
            isUnlocked={isUnlocked}
            onUnlock={() => handleUnlockPost(item.id, item.unlock_price)}
          />
        </View>

        {/* Body Text */}
        <View style={styles.cardBody}>
          {isUnlocked ? (
            editingPostId === item.id ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  multiline
                  value={editCaption}
                  onChangeText={setEditCaption}
                  autoFocus
                />
                <View style={styles.editActions}>
                  <Pressable style={styles.saveBtn} onPress={() => handleSaveEdit(item.id)}>
                    <Check size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => setEditingPostId(null)}>
                    <X size={14} color="#8A8A8A" style={{ marginRight: 4 }} />
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.unlockedCaption}>{item.caption}</Text>
            )
          ) : (
            <View style={styles.lockedTeaserContainer}>
              <HelpCircle size={14} color="#8A8A8A" style={{ marginRight: 6 }} />
              <Text style={styles.lockedTeaserText}>Caption is encrypted and locked.</Text>
            </View>
          )}
        </View>

        {/* Footer info */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerTime}>
            Posted {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {isAuthor && editingPostId !== item.id && (
              <Pressable 
                style={styles.editBtn} 
                onPress={() => {
                  setEditingPostId(item.id);
                  setEditCaption(item.caption);
                }}
              >
                <Edit2 size={12} color="#FF3B5C" style={{ marginRight: 4 }} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            )}
            {item.expires_at && (
              <Text style={styles.footerExpiry}>
                Expires in {Math.max(0, Math.round((new Date(item.expires_at).getTime() - Date.now()) / (60 * 1000)))}m
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const personalizedPosts = getPersonalizedPosts();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageSubtitle}>SECURE INTEL NETWORK</Text>
          <Text style={styles.pageTitle}>Group Intel Feed</Text>
        </View>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
      </View>

      <View style={styles.moduleSwitcher}>
        {([
          { label: 'All Spills', value: 'all' },
          { label: 'Student Life', value: 'student' },
          { label: 'Office Life', value: 'office' },
          { label: 'Others', value: 'other' }
        ] as const).map((item) => (
          <Pressable
            key={item.value}
            style={[
              styles.switcherTab,
              activeModuleFilter === item.value && styles.switcherTabActive
            ]}
            onPress={() => setActiveModuleFilter(item.value)}
            id={`btn-feed-module-${item.value}`}
          >
            <Text
              style={[
                styles.switcherTabText,
                activeModuleFilter === item.value && styles.switcherTabTextActive
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        key={numCols}
        numColumns={numCols}
        data={personalizedPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
        columnWrapperStyle={numCols > 1 ? styles.columnWrapper : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No spills shared yet. Be the first to share one!</Text>
          </View>
        }
        ListFooterComponent={
          personalizedPosts.length > 0 ? (
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>Workspace secure — {personalizedPosts.length} spills active</Text>
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  pageSubtitle: { fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: '700', color: '#FF3B5C', letterSpacing: 2 },
  pageTitle: { fontFamily: 'Outfit', fontSize: 24, fontWeight: '900', color: '#1A1A1A' },
  dateText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
  feedContent: { padding: Spacing.three, paddingBottom: 80 },
  columnWrapper: { gap: Spacing.three, justifyContent: 'flex-start' },
  postCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    marginBottom: Spacing.three,
    marginHorizontal: Spacing.half,
    padding: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.three,
  },
  authorBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B5C',
  },
  badgeText: {
    color: '#1A1A1A',
    fontFamily: 'Outfit',
    fontSize: 12,
    fontWeight: 'bold',
  },
  authorName: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30D158',
  },
  statusText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: '#8A8A8A',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mediaContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.three,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 14, 16, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  lockBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  overlayTeaser: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: Spacing.two,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B5C',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  unlockButtonText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  lockedTeaserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedTeaserText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#8A8A8A',
  },
  unlockedCaption: {
    fontFamily: 'Inter',
    fontSize: 13.5,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerTime: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#8A8A8A',
  },
  footerExpiry: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#FF3B5C',
    fontWeight: 'bold',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#FF3B5C',
    fontWeight: '600',
  },
  editContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  editInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    color: '#1A1A1A',
    fontFamily: 'Inter',
    fontSize: 13.5,
    padding: 8,
    borderRadius: 6,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B5C',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  cancelBtnText: {
    color: '#8A8A8A',
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
  },
  statsBar: {
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: Spacing.three,
  },
  statsText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#8A8A8A',
  },
  pressed: {
    opacity: 0.85,
  },
  moduleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  switcherTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  switcherTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  switcherTabText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8A8A8A',
  },
  switcherTabTextActive: {
    color: '#1A1A1A',
  },
  postBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postModuleBadgeContainer: {
    backgroundColor: 'rgba(255, 59, 92, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 59, 92, 0.2)',
  },
  postModuleBadgeText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: '700',
    color: '#FF3B5C',
  },
  postTagText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
    color: '#8A8A8A',
  },
  worthItBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  worthItBadgeHigh: {
    backgroundColor: '#FF3B5C',
    borderColor: '#FF3B5C',
  },
  worthItBadgeMuted: {
    backgroundColor: '#F5F5F5',
    borderColor: '#EAEAEA',
  },
  worthItBadgeText: {
    fontFamily: 'Inter',
    fontSize: 9,
    fontWeight: '700',
  },
  worthItBadgeTextHigh: {
    color: '#FFFFFF',
  },
  worthItBadgeTextMuted: {
    color: '#8A8A8A',
  },
  worthItReasonContainer: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    padding: 8,
    marginBottom: Spacing.two,
    marginHorizontal: Spacing.half,
  },
  worthItReasonText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#1A1A1A',
    lineHeight: 15,
  },
  classifiedStamp: {
    borderWidth: 2.5,
    borderColor: '#FF3B5C',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    transform: [{ rotate: '-8deg' }],
    marginBottom: 16,
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
  },
  classifiedText: {
    fontFamily: 'Outfit',
    fontSize: 15,
    fontWeight: '900',
    color: '#FF3B5C',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
