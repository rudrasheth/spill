import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Terminal, Shield, User, HardDrive, Clock, Check, Trash2, Key, LogOut, Ban } from 'lucide-react-native';
import { router } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { supabase, mockDatabase } from '@/lib/supabase';

const T = {
  brand: '#FF3B5C',
  bg: '#0E0E10',
  text: '#FFFFFF',
  muted: '#8E8E93',
  surface: '#1C1C1E',
  border: '#2C2C2E',
  success: '#30D158',
};

export default function ProfileScreen() {
  const [me, setMe] = useState<any>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [unlocksCount, setUnlocksCount] = useState(0);

  // Alias Editing state
  const [editingAlias, setEditingAlias] = useState('');

  // Operator / Simulator States
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [adminPass, setAdminPass] = useState('');

  // Operator Dashboard Data
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [bannedEmails, setBannedEmails] = useState<string[]>([]);

  const loadData = () => {
    const profile = mockDatabase.getCurrentUser();
    if (profile) {
      setMe(profile);
      
      const posts = mockDatabase.getPosts();
      const unlocks = mockDatabase.getUnlocks();
      const reports = mockDatabase.getReports();
      const users = mockDatabase.getUsers();

      setPostsCount(posts.filter(p => p.author_id === profile.id).length);
      setUnlocksCount(unlocks.filter(u => u.unlocker_id === profile.id).length);

      setAllPosts(mockDatabase.posts || []);
      setAllReports(reports);
      setAllUsers(users);
      
      const bans = localStorage.getItem('spill_banned_emails');
      if (bans) setBannedEmails(JSON.parse(bans));
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (me) {
      setEditingAlias(me.alias);
    }
  }, [me?.id]);

  const handleUpdateAlias = async () => {
    if (!editingAlias.trim()) {
      alert('Alias cannot be empty.');
      return;
    }
    if (editingAlias.length < 3) {
      alert('Alias must be at least 3 characters.');
      return;
    }
    try {
      const { error } = await supabase.from('users').update({ alias: editingAlias.trim() }).eq('id', me.id);
      if (error) {
        alert(error.message || 'Failed to update alias.');
      } else {
        alert('Alias updated successfully!');
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Error updating alias.');
    }
  };

  const handleResetDatabase = () => {
    if (confirm('Are you sure you want to wipe the database? All users, posts, and balances will be reset.')) {
      mockDatabase.resetDatabase();
      loadData();
      alert('Database successfully reset to seeded state.');
      router.replace('/');
    }
  };

  const handleFastForward = (minutes: number) => {
    mockDatabase.fastForwardTime(minutes);
    loadData();
    alert(`Time advanced by ${minutes} minutes. Active posts TTL reduced.`);
  };

  const handleAdminAuth = () => {
    if (adminPass === 'SPILL_ADMIN') {
      setIsAdminAuthorized(true);
      alert('Access Granted. Operator break-glass tools unlocked.');
    } else {
      alert('Access Denied. Invalid security clearance key.');
    }
  };

  // ADMIN OPERATIONS
  const handleApprovePost = (postId: string) => {
    const post = allPosts.find(p => p.id === postId);
    if (post) {
      post.reported_count = 0; // reset report counts
      mockDatabase.saveState();
      loadData();
      alert('Post approved and verified.');
    }
  };
  const handleHardDeletePost = (postId: string) => {
    mockDatabase.posts = mockDatabase.posts.filter((p: any) => p.id !== postId);
    mockDatabase.unlocks = mockDatabase.unlocks.filter((u: any) => u.post_id !== postId);
    mockDatabase.reports = mockDatabase.reports.filter((r: any) => r.post_id !== postId);
    mockDatabase.saveState();
    loadData();
    alert('Post permanently deleted. Redis TTL lease terminated.');
  };

  const handleBanUser = (email: string) => {
    if (email === me?.real_identity) {
      alert('You cannot ban yourself!');
      return;
    }
    const bans = [...bannedEmails, email];
    setBannedEmails(bans);
    localStorage.setItem('spill_banned_emails', JSON.stringify(bans));
    alert(`User banned: ${email}`);
  };

  const handleUnbanUser = (email: string) => {
    const bans = bannedEmails.filter(e => e !== email);
    setBannedEmails(bans);
    localStorage.setItem('spill_banned_emails', JSON.stringify(bans));
    alert(`User unbanned: ${email}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>WORKSPACE PROFILE & CONTROL DECK</Text>
          <Text style={styles.title}>Identity Layer</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarPlaceholder}>
              <User size={24} color="#FF3B5C" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: '#FF3B5C', fontSize: 16, fontWeight: 'bold' }}>@</Text>
                <TextInput
                  style={styles.anonNameInput}
                  value={editingAlias}
                  onChangeText={setEditingAlias}
                  onSubmitEditing={handleUpdateAlias}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  placeholder="Set alias..."
                  id="input-change-alias"
                />
              </View>
              <Text style={styles.deviceId} numberOfLines={1}>
                REAL ID: {me?.real_identity || 'Anonymous User'}
              </Text>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>ROLE</Text>
              <Text style={styles.gridValue}>Group Member</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>SUBMITTED</Text>
              <Text style={styles.gridValue}>{postsCount} Spills</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>UNLOCKED</Text>
              <Text style={styles.gridValue}>{unlocksCount} Spills</Text>
            </View>
          </View>
        </View>

        {/* Local Time Machine / Simulation */}
        <Text style={styles.sectionTitle}>SIMULATOR CONTROLS (EXPIRY / RESET)</Text>
        <View style={styles.simCard}>
          <View style={styles.simActionRow}>
            <Pressable style={styles.resetBtn} onPress={handleResetDatabase} id="btn-wipe-db">
              <HardDrive size={14} color="#FF3B5C" style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Wipe database</Text>
            </Pressable>
          </View>

          <View style={styles.timeMachineRow}>
            <Clock size={16} color="#E8B23D" />
            <Text style={styles.timeLabel}>SOFT EXPIRE MACHINE:</Text>
            <View style={styles.timeOptions}>
              <Pressable style={styles.timeBtn} onPress={() => handleFastForward(30)} id="btn-ff-30">
                <Text style={styles.timeBtnText}>+30m</Text>
              </Pressable>
              <Pressable style={styles.timeBtn} onPress={() => handleFastForward(120)} id="btn-ff-120">
                <Text style={styles.timeBtnText}>+2h</Text>
              </Pressable>
              <Pressable style={styles.timeBtn} onPress={() => handleFastForward(360)} id="btn-ff-360">
                <Text style={styles.timeBtnText}>+6h</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Operator Dashboard Lock */}
        <Text style={styles.sectionTitle}>OPERATOR PANEL (BREAK GLASS IDENTITY AUDIT)</Text>
        
        {!isAdminAuthorized ? (
          <View style={styles.adminLockCard}>
            <Shield size={24} color="#FF3B5C" style={{ marginBottom: 12 }} />
            <Text style={styles.lockTitle}>CLEARANCE AUTHORIZATION REQUIRED</Text>
            <Text style={styles.lockText}>
              Reserved for operator/owner to view actual mapping. Enter passcode below.
            </Text>
            
            <View style={styles.authInputRow}>
              <TextInput
                style={styles.authInput}
                placeholder="Operator Key (SPILL_ADMIN)"
                placeholderTextColor="#8E8E93"
                secureTextEntry
                value={adminPass}
                onChangeText={setAdminPass}
                id="input-clearance-key"
              />
              <Pressable style={styles.authBtn} onPress={handleAdminAuth} id="btn-clearance-submit">
                <Key size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.adminDashboard}>
            <View style={styles.adminHeader}>
              <Shield size={16} color="#30D158" style={{ marginRight: 6 }} />
              <Text style={styles.adminTitleText}>DECLASSIFIED SESSION ACTIVE</Text>
              <Pressable style={styles.lockBtn} onPress={() => setIsAdminAuthorized(false)} id="btn-clearance-lock">
                <Text style={styles.lockBtnText}>LOCK</Text>
              </Pressable>
            </View>

            {/* IDENTITY MAPPING TABLE */}
            <Text style={styles.listTitle}>ALIAS TO REAL IDENTITY MAP (USERS TABLE)</Text>
            <View style={styles.identityMapContainer}>
              {allUsers.map((user) => {
                const isBanned = bannedEmails.includes(user.real_identity);
                return (
                  <View key={user.id} style={styles.identityRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.idAlias}>@{user.alias}</Text>
                      <Text style={styles.idReal}>{user.real_identity}</Text>
                    </View>
                    <View style={styles.idMeta}>
                      <Text style={styles.idBalance}>{user.token_balance} TK</Text>
                      {isBanned ? (
                        <Pressable 
                          style={styles.unbanBtn} 
                          onPress={() => handleUnbanUser(user.real_identity)}
                          id={`btn-unban-${user.id}`}
                        >
                          <Text style={styles.banBtnText}>UNBAN</Text>
                        </Pressable>
                      ) : (
                        <Pressable 
                          style={styles.banBtn} 
                          onPress={() => handleBanUser(user.real_identity)}
                          id={`btn-ban-${user.id}`}
                        >
                          <Ban size={10} color="#FF3B5C" style={{ marginRight: 3 }} />
                          <Text style={styles.banBtnText}>BAN</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* RAW POSTS LEDGER */}
            <Text style={[styles.listTitle, { marginTop: Spacing.four }]}>RAW POSTS LEDGER (BYPASSES BLUR)</Text>
            
            {allPosts.length === 0 ? (
              <Text style={styles.emptyLogs}>No database records found.</Text>
            ) : (
              allPosts.map((post) => {
                const reportsOnPost = allReports.filter(r => r.post_id === post.id);
                const isReported = post.reported_count > 0;
                const authorUser = allUsers.find(u => u.id === post.author_id);
                
                return (
                  <View key={post.id} style={[styles.logCard, isReported && styles.logCardReported]}>
                    <View style={styles.logHeader}>
                      <View style={styles.logIdRow}>
                        <Text style={styles.logLabel}>ID:</Text>
                        <Text style={styles.logVal}>{post.id.substring(0, 8)}</Text>
                      </View>
                      <View style={styles.logIdRow}>
                        <Text style={styles.logLabel}>AUTHOR:</Text>
                        <Text style={[styles.logVal, styles.monoText]} numberOfLines={1}>
                          @{authorUser?.alias || 'Unknown'} ({authorUser?.real_identity || 'Unknown'})
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.logCaptionTitle}>RAW CONTENT:</Text>
                    <Text style={styles.logCaption}>{post.caption}</Text>

                    <View style={styles.logMetadata}>
                      <Text style={styles.logMetaItem}>PRICE: {post.unlock_price} TK</Text>
                      <Text style={styles.logMetaItem}>REPORTS: {post.reported_count}</Text>
                      <Text style={[styles.logMetaItem, styles.monoText]}>
                        EXPIRY: {post.expires_at ? new Date(post.expires_at).toLocaleTimeString() : 'NEVER'}
                      </Text>
                    </View>

                    {reportsOnPost.length > 0 && (
                      <View style={styles.reportsSection}>
                        <Text style={styles.reportsHeader}>SUBMITTED ABUSE REPORTS:</Text>
                        {reportsOnPost.map((r, rIdx) => {
                          const reporter = allUsers.find(u => u.id === r.reporter_id);
                          return (
                            <View key={r.id} style={styles.reportRow}>
                              <Text style={styles.reportBullet}>•</Text>
                              <Text style={styles.reportText}>
                                <Text style={{ fontWeight: 'bold' }}>@{reporter?.alias || 'Anon'}</Text>: "{r.reason}"
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.logActions}>
                      {isReported && (
                        <Pressable 
                          style={styles.actionBtnApprove} 
                          onPress={() => handleApprovePost(post.id)}
                          id={`btn-approve-post-${post.id}`}
                        >
                          <Check size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </Pressable>
                      )}
                      <Pressable 
                        style={styles.actionBtnDelete} 
                        onPress={() => handleHardDeletePost(post.id)}
                        id={`btn-delete-post-${post.id}`}
                      >
                        <Trash2 size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Hard Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
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
  profileCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.four,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: T.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
  },
  anonName: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  anonNameInput: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#0E0E10',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flex: 1,
  },
  deviceId: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: T.muted,
    marginTop: 2,
  },
  signOutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.border,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  gridBox: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: Spacing.three,
  },
  gridLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  gridValue: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: '700',
    color: T.brand,
    letterSpacing: 1.5,
    marginBottom: Spacing.three,
    marginTop: Spacing.four,
  },
  simCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  simActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  resetBtn: {
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
  resetBtnText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: T.brand,
  },
  timeMachineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.border,
    padding: Spacing.three,
    marginTop: 6,
  },
  timeLabel: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
    flex: 1,
  },
  timeOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  timeBtn: {
    backgroundColor: T.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.border,
  },
  timeBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  adminLockCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: Spacing.five,
    alignItems: 'center',
  },
  lockTitle: {
    fontFamily: 'Outfit',
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lockText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: T.muted,
    textAlign: 'center',
    marginBottom: Spacing.four,
    lineHeight: 16,
  },
  authInputRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 280,
  },
  authInput: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 12,
  },
  authBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDashboard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: Spacing.four,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    paddingBottom: 10,
    marginBottom: Spacing.three,
  },
  adminTitleText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#30D158',
    flex: 1,
  },
  lockBtn: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  lockBtnText: {
    fontFamily: 'Inter',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  listTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: T.brand,
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  identityMapContainer: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  idAlias: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  idReal: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: T.muted,
    marginTop: 2,
  },
  idMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  idBalance: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    color: '#E8B23D',
    fontWeight: 'bold',
  },
  banBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
    borderWidth: 1,
    borderColor: '#FF3B5C',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  unbanBtn: {
    backgroundColor: '#30D158',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  banBtnText: {
    fontFamily: 'Inter',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyLogs: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: T.muted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  logCard: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  logCardReported: {
    borderColor: T.brand,
    borderWidth: 1.5,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    paddingBottom: 6,
  },
  logIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: T.muted,
    fontWeight: 'bold',
  },
  logVal: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monoText: {
    fontFamily: 'IBM Plex Mono',
  },
  logCaptionTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: T.brand,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  logCaption: {
    fontFamily: 'Inter',
    fontSize: 12.5,
    color: '#E5E5EA',
    lineHeight: 18,
    marginBottom: 10,
  },
  logMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 6,
    marginBottom: 8,
  },
  logMetaItem: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: T.muted,
  },
  reportsSection: {
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
    borderRadius: 6,
    padding: Spacing.two,
    marginBottom: 10,
  },
  reportsHeader: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: T.brand,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 2,
  },
  reportBullet: {
    color: T.brand,
    fontSize: 10,
  },
  reportText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#E5E5EA',
    flex: 1,
  },
  logActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  actionBtnApprove: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#30D158',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.brand,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionBtnText: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
