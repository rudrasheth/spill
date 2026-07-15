import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target, Ticket, Sparkles, Clock, Plus, Award, Check, Eye } from 'lucide-react-native';
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

interface Bounty {
  id: string;
  requester_id: string;
  module: 'student' | 'office' | 'other';
  description: string;
  pool_total: number;
  status: 'open' | 'claimed' | 'expired';
  claimed_by_post_id: string | null;
  expires_at: string;
  created_at: string;
  requester_alias?: string;
}

interface FulfillingPost {
  id: string;
  author_id: string;
  image_url: string;
  caption: string;
  unlock_price: number;
  is_blurred: boolean;
  author_alias?: string;
}

export default function BountiesScreen() {
  const { width } = useWindowDimensions();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [fulfillingPosts, setFulfillingPosts] = useState<Record<string, FulfillingPost[]>>({});
  const [activeModuleFilter, setActiveModuleFilter] = useState<'all' | 'student' | 'office' | 'other'>('all');
  
  // Create Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [module, setModule] = useState<'student' | 'office' | 'other'>('other');
  const [pledge, setPledge] = useState(5);
  const [durationHours, setDurationHours] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Pledge Add States
  const [contributingBountyId, setContributingBountyId] = useState<string | null>(null);
  const [isContributing, setIsContributing] = useState(false);

  let numCols = 1;
  if (width >= 1024) numCols = 3;
  else if (width >= 768) numCols = 2;

  const loadBountiesData = async () => {
    try {
      const me = await getCurrentUserProfile();
      if (!me) return;
      setCurrentUser(me);

      // Refund any expired bounties first
      await supabase.rpc('refund_expired_bounties');

      // Fetch all bounties
      const { data: bountiesData, error } = await supabase
        .from('bounties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch users to map aliases
      const { data: usersData } = await supabase.from('users').select('id, alias');
      const usersMap: Record<string, string> = {};
      if (usersData) {
        usersData.forEach(u => usersMap[u.id] = u.alias);
      }

      const formattedBounties = (bountiesData || []).map((b: any) => ({
        ...b,
        requester_alias: usersMap[b.requester_id] ? `@${usersMap[b.requester_id]}` : '@Unknown',
      }));
      setBounties(formattedBounties);

      // Fetch fulfilling posts (posts linked to any bounty)
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, author_id, image_url, caption, unlock_price, is_blurred, bounty_id')
        .not('bounty_id', 'is', null);

      if (postsData) {
        const postsGrouped: Record<string, FulfillingPost[]> = {};
        postsData.forEach((post: any) => {
          if (!postsGrouped[post.bounty_id]) {
            postsGrouped[post.bounty_id] = [];
          }
          postsGrouped[post.bounty_id].push({
            id: post.id,
            author_id: post.author_id,
            image_url: post.image_url,
            caption: post.caption,
            unlock_price: post.unlock_price,
            is_blurred: post.is_blurred,
            author_alias: usersMap[post.author_id] ? `@${usersMap[post.author_id]}` : '@Unknown',
          });
        });
        setFulfillingPosts(postsGrouped);
      }
    } catch (err: any) {
      console.error("[Bounties] Load error:", err.message);
    }
  };

  useEffect(() => {
    loadBountiesData();
    const interval = setInterval(loadBountiesData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateBounty = async () => {
    if (!description.trim()) {
      showAlert('Bounty description cannot be empty.', 'Invalid Description', 'error');
      return;
    }
    if (pledge > currentUser.token_balance) {
      showAlert('Insufficient token balance for this initial pledge.', 'Insufficient Balance', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: bountyId, error } = await supabase.rpc('create_bounty', {
        p_requester_id: currentUser.id,
        p_module: module,
        p_description: description.trim(),
        p_pledge: pledge,
        p_expires_in_hours: durationHours
      });

      if (error) throw error;

      showAlert('Gossip Bounty created and added to the board!', 'Bounty Created', 'success');
      setDescription('');
      setIsCreateOpen(false);
      loadBountiesData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to create bounty.', 'Error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickContribute = async (bountyId: string, amount: number) => {
    if (amount > currentUser.token_balance) {
      showAlert('Insufficient token balance.', 'Insufficient Balance', 'error');
      return;
    }
    
    setContributingBountyId(bountyId);
    setIsContributing(true);
    try {
      const { error } = await supabase.rpc('contribute_to_bounty', {
        p_bounty_id: bountyId,
        p_contributor_id: currentUser.id,
        p_amount: amount
      });

      if (error) throw error;
      showAlert(`Successfully pledged +${amount} TK to this bounty!`, 'Contribution Added', 'success');
      loadBountiesData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to contribute to bounty.', 'Error', 'error');
    } finally {
      setIsContributing(false);
      setContributingBountyId(null);
    }
  };

  const handleClaimBounty = async (bountyId: string, postId: string) => {
    try {
      const { error } = await supabase.rpc('claim_bounty', {
        p_bounty_id: bountyId,
        p_post_id: postId,
        p_creator_id: currentUser.id
      });

      if (error) throw error;
      showAlert('Bounty claimed successfully! Pooled tokens transferred to the claimant.', 'Bounty Settled', 'success');
      loadBountiesData();
    } catch (err: any) {
      showAlert(err.message || 'Failed to claim bounty.', 'Claim Error', 'error');
    }
  };

  const filteredBounties = bounties.filter(b => {
    if (activeModuleFilter === 'all') return true;
    return b.module === activeModuleFilter;
  });

  const getHoursRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
    const mins = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>GOSSIP REQUEST BOARD</Text>
            <Text style={styles.title}>Active Bounties</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              pressed && styles.pressed
            ]}
            onPress={() => setIsCreateOpen(!isCreateOpen)}
            id="btn-bounty-toggle-create"
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.createBtnText}>
              {isCreateOpen ? 'Close Form' : 'Post Bounty'}
            </Text>
          </Pressable>
        </View>

        {/* Collapsible Create Form */}
        {isCreateOpen && (
          <View style={styles.createCard}>
            <Text style={styles.cardHeaderTitle}>CREATE CLASSFIED BOUNTY</Text>
            
            <Text style={styles.inputLabel}>WHAT DRUM / RUMOR ARE YOU REQUESTING?</Text>
            <View style={styles.textareaContainer}>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="e.g. Does anyone have verified leaks about the upcoming marketing team restructuring?"
                placeholderTextColor={T.muted}
                value={description}
                onChangeText={setDescription}
                maxLength={180}
                id="input-bounty-description"
              />
              <Text style={styles.charCount}>{description.length}/180</Text>
            </View>

            <Text style={styles.inputLabel}>MODULE ROUTING</Text>
            <View style={styles.selectorRow}>
              {([
                { label: 'Student Life', value: 'student' },
                { label: 'Office Life', value: 'office' },
                { label: 'Others', value: 'other' }
              ] as const).map(m => (
                <Pressable
                  key={m.value}
                  style={[styles.selectorBtn, module === m.value && styles.selectorBtnActive]}
                  onPress={() => setModule(m.value)}
                  id={`btn-bounty-module-${m.value}`}
                >
                  <Text style={[styles.selectorBtnText, module === m.value && styles.selectorBtnTextActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>INITIAL PLEDGE (TK)</Text>
                <View style={styles.selectorRow}>
                  {[3, 5, 10, 15].map(price => (
                    <Pressable
                      key={price}
                      style={[styles.selectorBtn, pledge === price && styles.selectorBtnActive]}
                      onPress={() => setPledge(price)}
                      id={`btn-bounty-pledge-${price}`}
                    >
                      <Text style={[styles.selectorBtnText, pledge === price && styles.selectorBtnTextActive]}>
                        {price} TK
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: Spacing.four }}>
                <Text style={styles.inputLabel}>DURATION LIMIT</Text>
                <View style={styles.selectorRow}>
                  {[24, 48, 72].map(hours => (
                    <Pressable
                      key={hours}
                      style={[styles.selectorBtn, durationHours === hours && styles.selectorBtnActive]}
                      onPress={() => setDurationHours(hours)}
                      id={`btn-bounty-duration-${hours}`}
                    >
                      <Text style={[styles.selectorBtnText, durationHours === hours && styles.selectorBtnTextActive]}>
                        {hours}h
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.pressed,
                isSubmitting && styles.disabledBtn
              ]}
              onPress={handleCreateBounty}
              disabled={isSubmitting}
              id="btn-bounty-submit"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>PUBLISH REQUEST (-{pledge} TK)</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Module Switcher Filter */}
        <View style={styles.moduleSwitcher}>
          {([
            { label: 'All Requests', value: 'all' },
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
              id={`btn-bounty-filter-${item.value}`}
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

        {/* Bounties Cards List */}
        {filteredBounties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No requests for gossip found in this category.</Text>
          </View>
        ) : (
          filteredBounties.map(bounty => {
            const isOwner = bounty.requester_id === currentUser?.id;
            const isOpen = bounty.status === 'open' && new Date(bounty.expires_at).getTime() > Date.now();
            const fulfills = fulfillingPosts[bounty.id] || [];

            return (
              <View key={bounty.id} style={styles.bountyCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.metaCol}>
                    <Text style={styles.bountyAuthor}>{bounty.requester_alias}</Text>
                    <View style={styles.timerRow}>
                      <Clock size={12} color={T.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.bountyTimer}>
                        {bounty.status === 'claimed' ? 'CLAIMED' :
                         bounty.status === 'expired' ? 'EXPIRED' :
                         getHoursRemaining(bounty.expires_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.poolHighlight}>
                    <Ticket size={16} color="#E8B23D" style={{ marginRight: 6 }} />
                    <Text style={styles.poolHighlightText}>{bounty.pool_total}</Text>
                    <Text style={styles.poolHighlightUnit}>TK</Text>
                  </View>
                </View>

                <Text style={styles.bountyDesc}>"{bounty.description}"</Text>

                <View style={styles.bountyBadges}>
                  <View style={styles.postModuleBadgeContainer}>
                    <Text style={styles.postModuleBadgeText}>
                      {bounty.module === 'student' ? 'Student' : bounty.module === 'office' ? 'Office' : 'Other'}
                    </Text>
                  </View>
                </View>

                {/* Bounty Actions */}
                {isOpen && (
                  <View style={styles.actionBlock}>
                    <Text style={styles.contributeLabel}>PLEDGE TO POOL:</Text>
                    <View style={styles.contributeRow}>
                      {[2, 5, 10].map(amt => (
                        <Pressable
                          key={amt}
                          style={({ pressed }) => [
                            styles.pledgeBtn,
                            pressed && styles.pressed,
                            isContributing && contributingBountyId === bounty.id && styles.disabledBtn
                          ]}
                          onPress={() => handleQuickContribute(bounty.id, amt)}
                          disabled={isContributing}
                          id={`btn-contribute-${bounty.id}-${amt}`}
                        >
                          <Text style={styles.pledgeBtnText}>+{amt} TK</Text>
                        </Pressable>
                      ))}

                      <View style={{ flex: 1 }} />

                      {!isOwner && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.fulfillBtn,
                            pressed && styles.pressed
                          ]}
                          onPress={() => {
                            router.push({
                              pathname: '/post',
                              params: {
                                bounty_id: bounty.id,
                                bounty_desc: bounty.description,
                                bounty_module: bounty.module,
                              }
                            });
                          }}
                          id={`btn-fulfill-bounty-${bounty.id}`}
                        >
                          <Sparkles size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.fulfillBtnText}>SPILL INFO</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                {/* Fulfilling Posts section */}
                {fulfills.length > 0 && (
                  <View style={styles.fulfillsSection}>
                    <Text style={styles.fulfillsSectionHeader}>RESPONSES RECEIVED ({fulfills.length}):</Text>
                    {fulfills.map(post => {
                      const postIsUnlocked = !post.is_blurred;
                      return (
                        <View key={post.id} style={styles.fulfillPostRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fulfillAuthor}>{post.author_alias}</Text>
                            <Text style={styles.fulfillCaption} numberOfLines={2}>
                              {postIsUnlocked ? post.caption : '[Encrypted content — locked behind tokens]'}
                            </Text>
                          </View>
                          
                          <View style={styles.fulfillRowActions}>
                            {/* If owner and bounty open, show claim button */}
                            {isOwner && isOpen && (
                              <Pressable
                                style={styles.claimConfirmBtn}
                                onPress={() => handleClaimBounty(bounty.id, post.id)}
                                id={`btn-claim-${bounty.id}-${post.id}`}
                              >
                                <Award size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={styles.claimConfirmBtnText}>Accept Claim</Text>
                              </Pressable>
                            )}

                            {/* Link to view post on feed */}
                            <Pressable
                              style={styles.viewPostBtn}
                              onPress={() => router.push('/')}
                            >
                              <Eye size={12} color={T.text} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
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
  createBtn: {
    backgroundColor: T.brand,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  cardHeaderTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: T.brand,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: Spacing.three,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 'bold',
    color: T.text,
    letterSpacing: 1,
    marginBottom: 8,
  },
  textareaContainer: {
    backgroundColor: T.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  textArea: {
    fontFamily: 'Inter',
    color: T.text,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: T.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  selectorBtn: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorBtnActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  selectorBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: T.muted,
  },
  selectorBtnTextActive: {
    color: '#FFFFFF',
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  submitBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: T.brand,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1,
  },
  moduleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    marginBottom: Spacing.four,
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
  emptyContainer: {
    padding: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
  },
  emptyText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: T.muted,
    textAlign: 'center',
  },
  bountyCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  metaCol: {
    flex: 1,
  },
  bountyAuthor: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '800',
    color: T.text,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  bountyTimer: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: T.muted,
    fontWeight: 'bold',
  },
  poolHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 178, 61, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 178, 61, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  poolHighlightText: {
    fontFamily: 'Outfit',
    fontSize: 18,
    fontWeight: '900',
    color: '#E8B23D',
  },
  poolHighlightUnit: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '800',
    color: '#E8B23D',
    marginLeft: 2,
    marginTop: 2,
  },
  bountyDesc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: T.text,
    lineHeight: 20,
    marginBottom: Spacing.three,
    fontWeight: '500',
  },
  bountyBadges: {
    flexDirection: 'row',
    marginBottom: Spacing.three,
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
    fontSize: 8,
    fontWeight: '700',
    color: T.brand,
  },
  actionBlock: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  contributeLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    fontWeight: 'bold',
    color: T.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  contributeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pledgeBtn: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  pledgeBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: T.text,
  },
  fulfillBtn: {
    backgroundColor: T.text,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fulfillBtnText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  fulfillsSection: {
    marginTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: Spacing.three,
  },
  fulfillsSectionHeader: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: '700',
    color: T.brand,
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  fulfillPostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    padding: Spacing.two,
    marginBottom: 6,
  },
  fulfillAuthor: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: T.text,
  },
  fulfillCaption: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: T.muted,
    marginTop: 2,
  },
  fulfillRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: Spacing.two,
  },
  claimConfirmBtn: {
    backgroundColor: T.brand,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  claimConfirmBtnText: {
    fontFamily: 'Inter',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  viewPostBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  disabledBtn: { opacity: 0.5 },
});
