import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Terminal, Shield, User, HardDrive, RefreshCw, Clock, Ban, Check, Trash2, Key } from 'lucide-react-native';

import { Colors, Spacing } from '@/constants/theme';
import { supabase, mockDatabase, getHashedDeviceId } from '@/lib/supabase';

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark'];

  const [me, setMe] = useState<any>(null);
  const [reportsCount, setReportsCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [unlocksCount, setUnlocksCount] = useState(0);

  // Administrative / Simulator States
  const [clusteringActive, setClusteringActive] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

  // Operator Logs Data
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [bannedDevices, setBannedDevices] = useState<string[]>([]);

  const loadData = () => {
    const profile = mockDatabase.getCurrentUser();
    if (profile) {
      setMe(profile);
      
      const posts = mockDatabase.getPosts();
      const unlocks = mockDatabase.getUnlocks();
      const reports = mockDatabase.getReports();

      setPostsCount(posts.filter(p => p.hashed_author_id === profile.id).length);
      setUnlocksCount(unlocks.filter(u => u.unlocker_id === profile.id).length);
      setReportsCount(reports.filter(r => r.reporter_id === profile.id).length);

      // Load all raw posts (including reported/expired) directly from memory db for admin
      const rawPosts = mockDatabase.getUsers().reduce((acc: any[], user) => {
        // Read posts
        return acc;
      }, []);

      // Since we want to expose raw database tables for break-glass operator dashboard
      setAllPosts((mockDatabase as any).posts || []);
      setAllReports(reports);
      
      // Load banned devices
      const bans = localStorage.getItem('spill_banned_devices');
      if (bans) setBannedDevices(JSON.parse(bans));
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRecalculateCluster = () => {
    setClusteringActive(true);
    setTimeout(() => {
      // Re-run K-means simulation based on user behaviors
      const totalUnlocks = unlocksCount;
      const totalPosts = postsCount;
      const totalReports = reportsCount;

      let newCluster = 'Lurkers';
      if (totalPosts > totalUnlocks) {
        newCluster = 'Instigators';
      } else if (totalReports > totalUnlocks * 0.5) {
        newCluster = 'Skeptics';
      } else if (totalUnlocks > 2) {
        newCluster = 'Lurkers';
      } else {
        const clusters = ['Skeptics', 'Lurkers', 'Instigators'];
        newCluster = clusters[Math.floor(Math.random() * 3)];
      }

      if (me) {
        me.cluster_id = newCluster;
        mockDatabase.saveState();
        loadData();
      }
      setClusteringActive(false);
      alert(`K-Means Job Complete! Sorted into cluster: ${newCluster}`);
    }, 1500);
  };

  const handleResetDatabase = () => {
    if (confirm('Are you sure you want to hard reset the database? This resets all posts, unlocks, and token balances.')) {
      mockDatabase.resetDatabase();
      loadData();
      alert('Database successfully reset to seed state.');
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
    const db = mockDatabase as any;
    db.posts = db.posts.filter((p: any) => p.id !== postId);
    db.unlocks = db.unlocks.filter((u: any) => u.post_id !== postId);
    db.reports = db.reports.filter((r: any) => r.post_id !== postId);
    mockDatabase.saveState();
    loadData();
    alert('Post permanently deleted. Redis TTL lease terminated.');
  };

  const handleBanDevice = (authorId: string) => {
    const author = mockDatabase.getUsers().find(u => u.id === authorId);
    if (author) {
      const bans = [...bannedDevices, author.hashed_device_id];
      setBannedDevices(bans);
      localStorage.setItem('spill_banned_devices', JSON.stringify(bans));
      alert(`Banned author device fingerprint: ${author.hashed_device_id}`);
    } else {
      alert('Could not locate device signature for user.');
    }
  };

  const isCurrentDeviceBanned = bannedDevices.includes(getHashedDeviceId());

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Banned Device Warning */}
        {isCurrentDeviceBanned && (
          <View style={styles.banWarning}>
            <Ban size={24} color="#EDEAE1" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.banTitle}>DEVICE ACCESS SUSPENDED</Text>
              <Text style={styles.banText}>
                Your device fingerprint has been blacklisted for ToS violations. You cannot post or unlock gossip.
              </Text>
            </View>
            <Pressable 
              style={styles.unbanBtn} 
              onPress={() => {
                const bans = bannedDevices.filter(d => d !== getHashedDeviceId());
                setBannedDevices(bans);
                localStorage.setItem('spill_banned_devices', JSON.stringify(bans));
                alert('Fingerprint cleared.');
              }}
            >
              <Text style={styles.unbanText}>UNBAN ME</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>ANONYMITY LAYER</Text>
          <Text style={styles.subtitle}>DEVICE METADATA & CONTROL DECK</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarPlaceholder}>
              <User size={24} color="#C4362E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.anonName}>ANONYMOUS DOSSIER PROFILE</Text>
              <Text style={styles.deviceId} numberOfLines={1}>
                SIG: {me?.hashed_device_id || 'calculating...'}
              </Text>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>CHAOS ROOM</Text>
              <Text style={styles.gridValue}>{me?.cluster_id || 'PENDING'}</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>SUBMITTED</Text>
              <Text style={styles.gridValue}>{postsCount} Gossip</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>UNLOCKED</Text>
              <Text style={styles.gridValue}>{unlocksCount} Posts</Text>
            </View>
          </View>
        </View>

        {/* Local Time Machine / Simulation */}
        <Text style={styles.sectionTitle}>SIMULATOR CONTROLS (DECAY / K-MEANS)</Text>
        <View style={styles.simCard}>
          <View style={styles.simActionRow}>
            <Pressable 
              style={[styles.simBtn, clusteringActive && styles.simBtnDisabled]} 
              onPress={handleRecalculateCluster}
              disabled={clusteringActive}
            >
              {clusteringActive ? (
                <ActivityIndicator size="small" color="#EDEAE1" />
              ) : (
                <>
                  <RefreshCw size={14} color="#12141A" style={{ marginRight: 6 }} />
                  <Text style={styles.simBtnText}>Run K-Means Job</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.resetBtn} onPress={handleResetDatabase}>
              <HardDrive size={14} color="#C4362E" style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Wipe database</Text>
            </Pressable>
          </View>

          <View style={styles.timeMachineRow}>
            <Clock size={16} color="#E8B23D" />
            <Text style={styles.timeLabel}>REDIS DECAY TIME MACHINE:</Text>
            <View style={styles.timeOptions}>
              <Pressable style={styles.timeBtn} onPress={() => handleFastForward(30)}>
                <Text style={styles.timeBtnText}>+30m</Text>
              </Pressable>
              <Pressable style={styles.timeBtn} onPress={() => handleFastForward(120)}>
                <Text style={styles.timeBtnText}>+2h</Text>
              </Pressable>
              <Pressable style={styles.timeBtn} onPress={() => handleFastForward(360)}>
                <Text style={styles.timeBtnText}>+6h</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Operator Dashboard Lock */}
        <Text style={styles.sectionTitle}>OPERATOR PANEL (BREAK GLASS AUDIT LOG)</Text>
        
        {!isAdminAuthorized ? (
          <View style={styles.adminLockCard}>
            <Shield size={24} color="#C4362E" style={{ marginBottom: 12 }} />
            <Text style={styles.lockTitle}>CLEARANCE AUTHORIZATION REQUIRED</Text>
            <Text style={styles.lockText}>
              Access is logged, rate-limited, and reserved for legal response. Enter operator passcode below.
            </Text>
            
            <View style={styles.authInputRow}>
              <TextInput
                style={styles.authInput}
                placeholder="Clearance Key (Hint: SPILL_ADMIN)"
                placeholderTextColor="#5B6472"
                secureTextEntry
                value={adminPass}
                onChangeText={setAdminPass}
              />
              <Pressable style={styles.authBtn} onPress={handleAdminAuth}>
                <Key size={16} color="#12141A" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.adminDashboard}>
            <View style={styles.adminHeader}>
              <Shield size={16} color="#2E7D6B" />
              <Text style={styles.adminTitleText}>OPERATOR DECLASSIFIED SESSION ACTIVE</Text>
              <Pressable style={styles.lockBtn} onPress={() => setIsAdminAuthorized(false)}>
                <Text style={styles.lockBtnText}>LOCK</Text>
              </Pressable>
            </View>

            <View style={styles.metricsContainer}>
              <Text style={styles.metricText}>TOTAL RAW RECORDS: {allPosts.length} posts</Text>
              <Text style={styles.metricText}>ACTIVE BANS: {bannedDevices.length} signatures</Text>
            </View>

            <Text style={styles.listTitle}>RAW POSTS LEDGER (BYPASSES DECAY & BLUR)</Text>
            
            {allPosts.length === 0 ? (
              <Text style={styles.emptyLogs}>No database records found.</Text>
            ) : (
              allPosts.map((post) => {
                const reportsOnPost = allReports.filter(r => r.post_id === post.id);
                const isReported = post.reported_count > 0;
                
                return (
                  <View key={post.id} style={[styles.logCard, isReported && styles.logCardReported]}>
                    <View style={styles.logHeader}>
                      <View style={styles.logIdRow}>
                        <Text style={styles.logLabel}>POST ID:</Text>
                        <Text style={styles.logVal}>{post.id}</Text>
                      </View>
                      <View style={styles.logIdRow}>
                        <Text style={styles.logLabel}>AUTHOR:</Text>
                        <Text style={[styles.logVal, styles.monoText]} numberOfLines={1}>
                          {post.hashed_author_id.substring(0, 12)}...
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.logCaptionTitle}>UNBLURRED RAW CONTENT:</Text>
                    <Text style={styles.logCaption}>{post.caption}</Text>

                    <View style={styles.logMetadata}>
                      <Text style={styles.logMetaItem}>PRICE: {post.unlock_price} RCPT</Text>
                      <Text style={styles.logMetaItem}>
                        REPORTS: {post.reported_count}
                      </Text>
                      <Text style={[styles.logMetaItem, styles.monoText]}>
                        DECAY: {new Date(post.decay_at).toLocaleTimeString()}
                      </Text>
                    </View>

                    {reportsOnPost.length > 0 && (
                      <View style={styles.reportsSection}>
                        <Text style={styles.reportsHeader}>SUBMITTED ABUSE REPORTS:</Text>
                        {reportsOnPost.map((r, rIdx) => (
                          <View key={r.id} style={styles.reportItem}>
                            <Text style={styles.reportText}>
                              [{rIdx + 1}] {r.reason}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Operator Actions */}
                    <View style={styles.actionRow}>
                      {isReported && (
                        <Pressable 
                          style={styles.actionBtnApprove}
                          onPress={() => handleApprovePost(post.id)}
                        >
                          <Check size={12} color="#12141A" style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnText}>CLEAR REPORT</Text>
                        </Pressable>
                      )}
                      
                      <Pressable 
                        style={styles.actionBtnDelete}
                        onPress={() => handleHardDeletePost(post.id)}
                      >
                        <Trash2 size={12} color="#EDEAE1" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnTextDark}>HARD DELETE</Text>
                      </Pressable>

                      <Pressable 
                        style={styles.actionBtnBan}
                        onPress={() => handleBanDevice(post.hashed_author_id)}
                      >
                        <Ban size={12} color="#EDEAE1" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnTextDark}>BAN DEVICE</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 100,
    width: '100%',
    flexGrow: 1,
  },
  header: {
    marginBottom: Spacing.three,
  },
  title: {
    fontFamily: 'Outfit',
    fontSize: 24,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#FF3B5C',
    fontWeight: 'bold',
  },

  // Ban Warning
  banWarning: {
    backgroundColor: '#C4362E',
    borderRadius: 4,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  banTitle: {
    fontFamily: 'Archivo Narrow',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EDEAE1',
  },
  banText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#EDEAE1',
    marginTop: 2,
  },
  unbanBtn: {
    backgroundColor: '#12141A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 2,
  },
  unbanText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#C4362E',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.three,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(196, 54, 46, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anonName: {
    fontFamily: 'Outfit',
    fontSize: 15,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: 1,
  },
  deviceId: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: 'rgba(26,26,46,0.6)',
    marginTop: 2,
  },
  statGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    paddingTop: Spacing.three,
    gap: 12,
  },
  gridBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    borderRadius: 8,
  },
  gridLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: '#8A8A8A',
    fontWeight: 'bold',
  },
  gridValue: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: 'bold',
    marginTop: 4,
  },

  sectionTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    color: 'rgba(26,26,46,0.6)',
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: Spacing.three,
    letterSpacing: 1,
  },

  // Simulator Card
  simCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  simActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  simBtn: {
    flex: 1,
    backgroundColor: '#EDEAE1', // paper off-white
    height: 38,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  simBtnDisabled: {
    opacity: 0.5,
  },
  simBtnText: {
    fontFamily: 'Outfit',
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  resetBtn: {
    flex: 1,
    backgroundColor: 'rgba(196, 54, 46, 0.1)',
    borderWidth: 1,
    borderColor: '#C4362E',
    height: 38,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  resetBtnText: {
    fontFamily: 'Archivo Narrow',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C4362E',
  },
  timeMachineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#262A35',
    paddingTop: Spacing.three,
    gap: 8,
  },
  timeLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#8E98A5',
    fontWeight: 'bold',
  },
  timeOptions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  timeBtn: {
    backgroundColor: '#262A35',
    borderWidth: 1,
    borderColor: '#5B6472',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  timeBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#E8B23D',
    fontWeight: 'bold',
  },

  // Admin Lock
  adminLockCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B5C',
    padding: Spacing.four,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  lockTitle: {
    fontFamily: 'Outfit',
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 1,
  },
  lockText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#5B6472',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: Spacing.two,
  },
  authInputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  authInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: '#FF006E',
    borderWidth: 1,
    borderRadius: 8,
    color: '#1A1A2E',
    paddingHorizontal: 12,
    height: 38,
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
  },
  authBtn: {
    backgroundColor: '#FF006E',
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  adminDashboard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: Spacing.three,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: Spacing.two,
  },
  adminTitleText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#06D6A0', // pulse teal
  },
  lockBtn: {
    marginLeft: 'auto',
    backgroundColor: '#FF3B5C',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  lockBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  metricsContainer: {
    marginVertical: 12,
    gap: 4,
  },
  metricText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: 'rgba(26,26,46,0.6)',
  },
  listTitle: {
    fontFamily: 'Outfit',
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: 1,
    marginTop: Spacing.three,
    marginBottom: 8,
  },
  emptyLogs: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#8A8A8A',
    fontStyle: 'italic',
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: Spacing.three,
    borderRadius: 8,
    marginBottom: 12,
  },
  logCardReported: {
    borderColor: '#FF3B5C',
    borderLeftWidth: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 6,
    marginBottom: 8,
  },
  logIdRow: {
    flexDirection: 'row',
    gap: 4,
  },
  logLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: '#8A8A8A',
    fontWeight: 'bold',
  },
  logVal: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: '#1A1A1A',
  },
  logCaptionTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: '#FF3B5C',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  logCaption: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 18,
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
  },
  logMetadata: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  logMetaItem: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: 'rgba(26,26,46,0.6)',
  },
  monoText: {
    fontFamily: 'IBM Plex Mono',
  },
  reportsSection: {
    backgroundColor: '#F5F5F5',
    padding: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  reportsHeader: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8,
    color: '#FF3B5C',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reportItem: {
    marginBottom: 2,
  },
  reportText: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1A1A2E',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtnApprove: {
    backgroundColor: '#06D6A0', // teal
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnDelete: {
    backgroundColor: '#FF006E', // redact red
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnBan: {
    backgroundColor: 'rgba(26,26,46,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1A1A2E',
  },
  actionBtnTextDark: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
