import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Bot } from 'lucide-react-native';
import { router } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { supabase, mockDatabase, Post } from '@/lib/supabase';

export default function GossipFeedScreen() {
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
      alert('Insufficient balance');
      return;
    }
    await supabase.rpc('unlock_post', { p_post_id: postId, p_user_id: currentUser.id });
    loadFeedData();
  };

  const renderPostCard = ({ item }: { item: Post }) => {
    const isAuthor   = item.hashed_author_id === currentUser?.id;
    const isUnlocked = unlockedPostIds.includes(item.id) || isAuthor;

    return (
      <View style={styles.postCard}>
        <View style={styles.cardHeader}>
          <View style={styles.authorBadge}>
            <Bot size={20} color="#666" />
          </View>
          <View>
            <Text style={styles.authorName}>Agent #{item.hashed_author_id.substring(0, 4)}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B5C'}} />
              <Text style={styles.authorHash}>CONNECTED</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          {!isUnlocked ? (
            <View style={styles.lockedContainer}>
              <Text style={styles.lockedText}>Hello! I'm Agent #{item.hashed_author_id.substring(0,4)}. I have some restricted info. How can I help today?</Text>
              <Pressable
                style={styles.unlockButton}
                onPress={() => handleUnlockPost(item.id, item.unlock_price)}
              >
                <Lock size={14} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.unlockButtonText}>Unlock ({item.unlock_price} RCPT)</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.unlockedCaption}>{item.caption}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Workspace / Feed</Text>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
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
        ListFooterComponent={
          <View style={styles.statsBar}>
            <Text style={styles.statsText}>Network Active — {posts.length} secure exchanges today</Text>
          </View>
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
    padding: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  pageTitle: { fontFamily: 'Outfit', fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  dateText: { fontFamily: 'Outfit', fontSize: 13, fontWeight: '800', color: '#1A1A1A' },
  feedContent: { padding: Spacing.three, paddingBottom: 60 },
  columnWrapper: { gap: Spacing.three, justifyContent: 'flex-start' },
  postCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: Spacing.three,
    marginHorizontal: Spacing.half,
    padding: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.three,
  },
  authorBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center',
  },
  authorName: {
    fontFamily: 'Outfit', fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 3,
  },
  authorHash: {
    fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#FF3B5C',
    fontWeight: '700', letterSpacing: 1,
  },
  cardBody: {
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
    borderRadius: 6,
    padding: Spacing.three,
  },
  lockedContainer: { alignItems: 'flex-start', paddingVertical: Spacing.one },
  lockedText: {
    fontFamily: 'Inter', fontSize: 14, color: '#1A1A1A', marginBottom: Spacing.three, lineHeight: 20,
  },
  unlockButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FF3B5C',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6,
  },
  unlockButtonText: {
    fontFamily: 'Outfit', fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5,
  },
  unlockedCaption: {
    fontFamily: 'Inter', fontSize: 14, lineHeight: 22, color: '#1A1A1A',
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
    fontSize: 11,
    color: '#8A8A8A',
  },
});
