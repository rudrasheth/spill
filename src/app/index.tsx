import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Unlock, Eye, HelpCircle, Edit2, Check, X } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { supabase, mockDatabase, Post } from '@/lib/supabase';

const SEED_IMAGES: Record<string, any> = {
  classified_dossier: require('@/assets/images/classified_dossier.png'),
  night_market_gossip: require('@/assets/images/night_market_gossip.png'),
  confidential_leak: require('@/assets/images/confidential_leak.png'),
};

export default function GossipFeedScreen() {
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');

  let numCols = 1;
  if (width >= 1024) numCols = 3;
  else if (width >= 768) numCols = 2;

  const loadFeedData = async () => {
    const me = mockDatabase.getCurrentUser();
    if (!me) return;
    setCurrentUser(me);

    const { data: postsData } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);

    const { data: unlocksData } = await supabase.from('unlocks').select('*').eq('unlocker_id', me.id);
    if (unlocksData) setUnlockedPostIds(unlocksData.map((u: any) => u.post_id));
  };

  useEffect(() => {
    loadFeedData();
    const interval = setInterval(loadFeedData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUnlockPost = async (postId: string, price: number) => {
    if (!currentUser) return;
    if (currentUser.token_balance < price) {
      alert('Insufficient token balance. Head to the Wallet tab to load up.');
      return;
    }
    try {
      await supabase.rpc('unlock_post', { p_post_id: postId, p_user_id: currentUser.id });
      loadFeedData();
    } catch (err: any) {
      alert(err.message || 'Unlock failed');
    }
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editCaption.trim()) return;
    try {
      await supabase.from('posts').update({ caption: editCaption }).eq('id', postId);
      setEditingPostId(null);
      loadFeedData();
    } catch (err: any) {
      alert(err.message || 'Edit failed');
    }
  };

  const renderPostCard = ({ item }: { item: Post }) => {
    const isAuthor = item.author_id === currentUser?.id;
    const isUnlocked = unlockedPostIds.includes(item.id) || isAuthor;

    const authorUser = mockDatabase.getUsers().find(u => u.id === item.author_id);
    const authorAlias = authorUser ? `@${authorUser.alias}` : '@Unknown';

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
          <View>
            <Text style={styles.authorName}>{authorAlias}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>VERIFIED GROUP AGENT</Text>
            </View>
          </View>
        </View>

        {/* Media (Blurred/Unlocked) */}
        <View style={styles.mediaContainer}>
          <Image
            source={imageSource}
            style={styles.cardImage}
            blurRadius={isUnlocked ? 0 : 25}
            resizeMode="cover"
          />

          {!isUnlocked && (
            <View style={styles.blurOverlay}>
              <View style={styles.lockBadge}>
                <Lock size={18} color="#FF3B5C" />
              </View>
              <Text style={styles.overlayTeaser}>Encrypted Spill Media</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.unlockButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleUnlockPost(item.id, item.unlock_price)}
                id={`btn-unlock-${item.id}`}
              >
                <Eye size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.unlockButtonText}>Reveal for {item.unlock_price} Tokens</Text>
              </Pressable>
            </View>
          )}
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageSubtitle}>SECURE INTEL NETWORK</Text>
          <Text style={styles.pageTitle}>Group Intel Feed</Text>
        </View>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
      </View>

      <FlatList
        key={numCols}
        numColumns={numCols}
        data={posts}
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
          posts.length > 0 ? (
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>Workspace secure — {posts.length} spills active</Text>
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
});
