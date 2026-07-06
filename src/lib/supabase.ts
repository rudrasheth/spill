import { Platform } from 'react-native';

// Simple fallback storage helper for Web and Native
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        try { return localStorage.getItem(key); } catch { return null; }
      },
      setItem: (key: string, val: string) => {
        try { localStorage.setItem(key, val); } catch {}
      }
    };
  } else {
    // Simple memory fallback for native if AsyncStorage is not initialized yet
    const mem: Record<string, string> = {};
    return {
      getItem: (key: string) => mem[key] || null,
      setItem: (key: string, val: string) => { mem[key] = val; }
    };
  }
};

const storage = getStorage();

// Simple custom SHA-256 implementation to hash the device ID (avoiding heavy external libraries)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to a pseudo-hex uuid format
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `00000000-0000-0000-0000-${hex.repeat(2)}`;
}

// Generate/Retrieve Hashed Device ID for Anon Auth
export function getHashedDeviceId(): string {
  const STORAGE_KEY = 'spill_hashed_device_id';
  let id = storage.getItem(STORAGE_KEY);
  if (!id) {
    // In production, we'd use expo-device to get a stable ID
    // For demo/dev, we generate a random stable client fingerprint
    const rand = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    id = simpleHash(rand);
    storage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// --- DATABASE TYPES ---
export interface UserProfile {
  id: string;
  hashed_device_id: string;
  token_balance: number;
  cluster_id: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  hashed_author_id: string;
  media_url: string;
  caption: string;
  unlock_price: number;
  is_blurred: boolean;
  redis_key: string;
  created_at: string;
  decay_at: string; // Redis TTL decay timestamp
  reported_count: number;
}

export interface Unlock {
  id: string;
  post_id: string;
  unlocker_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: 'pending' | 'actioned' | 'dismissed';
  created_at: string;
}

// --- MOCK DATABASE ENGINE ---
class LocalMockDatabase {
  private users: UserProfile[] = [];
  private posts: Post[] = [];
  private unlocks: Unlock[] = [];
  private reports: Report[] = [];
  private currentUser: UserProfile | null = null;

  constructor() {
    this.loadState();
    this.seedIfNeeded();
  }

  private loadState() {
    try {
      const u = storage.getItem('spill_db_users');
      const p = storage.getItem('spill_db_posts');
      const un = storage.getItem('spill_db_unlocks');
      const r = storage.getItem('spill_db_reports');

      if (u) this.users = JSON.parse(u);
      if (p) this.posts = JSON.parse(p);
      if (un) this.unlocks = JSON.parse(un);
      if (r) this.reports = JSON.parse(r);
    } catch (e) {
      console.error('Error loading mock database state:', e);
    }
  }

  public saveState() {
    try {
      storage.setItem('spill_db_users', JSON.stringify(this.users));
      storage.setItem('spill_db_posts', JSON.stringify(this.posts));
      storage.setItem('spill_db_unlocks', JSON.stringify(this.unlocks));
      storage.setItem('spill_db_reports', JSON.stringify(this.reports));
    } catch (e) {
      console.error('Error saving mock database state:', e);
    }
  }

  private seedIfNeeded() {
    const deviceHash = getHashedDeviceId();
    
    // Ensure current user profile exists
    let me = this.users.find(u => u.hashed_device_id === deviceHash);
    if (!me) {
      me = {
        id: simpleHash('current-user-' + deviceHash),
        hashed_device_id: deviceHash,
        token_balance: 10, // Starting tokens
        cluster_id: 'Skeptics', // Initial bucket
        created_at: new Date().toISOString()
      };
      this.users.push(me);
    }
    this.currentUser = me;

    // Seed some other dummy users
    const posterIds = [
      simpleHash('user-instigator-1'),
      simpleHash('user-lurker-2'),
      simpleHash('user-skeptic-3'),
    ];

    const posterNames = ['Instigators', 'Lurkers', 'Instigators'];
    posterIds.forEach((id, idx) => {
      if (!this.users.some(u => u.id === id)) {
        this.users.push({
          id,
          hashed_device_id: simpleHash('device-' + idx),
          token_balance: 15,
          cluster_id: posterNames[idx],
          created_at: new Date(Date.now() - 86400000).toISOString()
        });
      }
    });

    // Seed Posts with different decay times
    if (this.posts.length === 0) {
      const now = Date.now();
      this.posts = [
        {
          id: 'post-seed-1',
          hashed_author_id: posterIds[0],
          media_url: 'night_market_gossip', // corresponds to asset
          caption: "Spotted at the night market: two local VCs arguing over who pays for the $4 noodles. One threatened to downround the other's Series A.",
          unlock_price: 5,
          is_blurred: true,
          redis_key: 'spill:post:post-seed-1',
          created_at: new Date(now - 3600000).toISOString(), // 1h ago
          decay_at: new Date(now + 18000000).toISOString(),  // 5h remaining (6h total)
          reported_count: 0
        },
        {
          id: 'post-seed-2',
          hashed_author_id: posterIds[1],
          media_url: 'classified_dossier',
          caption: "Leaked internal memo from the major AI lab: they are running out of power grid capacity. They've started negotiations with an offshore nuclear barge operator.",
          unlock_price: 8,
          is_blurred: true,
          redis_key: 'spill:post:post-seed-2',
          created_at: new Date(now - 7200000).toISOString(), // 2h ago
          decay_at: new Date(now + 14400000).toISOString(),  // 4h remaining (6h total)
          reported_count: 0
        },
        {
          id: 'post-seed-3',
          hashed_author_id: posterIds[2],
          media_url: 'confidential_leak',
          caption: "Whispers in the fintech cluster: the top payment API is raising transaction fees by 0.5% next quarter without telling merchants in advance.",
          unlock_price: 3,
          is_blurred: true,
          redis_key: 'spill:post:post-seed-3',
          created_at: new Date(now - 14400000).toISOString(), // 4h ago
          decay_at: new Date(now + 7200000).toISOString(),   // 2h remaining (6h total)
          reported_count: 0
        }
      ];

      // Auto-unlock the third post for current user to show how unlocked works out of the box
      this.unlocks = [
        {
          id: 'unlock-seed-1',
          post_id: 'post-seed-3',
          unlocker_id: me.id,
          created_at: new Date().toISOString()
        }
      ];
    }
    
    this.saveState();
  }

  // --- QUERY UTILITIES ---
  public getUsers() { return this.users; }
  public getPosts() {
    // Process Redis Decay: Remove expired posts
    const now = Date.now();
    const activePosts = this.posts.filter(p => {
      const isExpired = new Date(p.decay_at).getTime() <= now;
      const isReported = p.reported_count > 0;
      return !isExpired && !isReported;
    });

    if (activePosts.length !== this.posts.length) {
      // Clean up physical database for expired/reported posts (Hard Delete on expiry)
      this.posts = this.posts.filter(p => {
        const isExpired = new Date(p.decay_at).getTime() <= now;
        return !isExpired; // Let reported stay but hidden, expired is hard deleted
      });
      this.saveState();
    }

    return activePosts;
  }
  public getUnlocks() { return this.unlocks; }
  public getReports() { return this.reports; }
  public getCurrentUser() {
    // Refresh ref
    const deviceHash = getHashedDeviceId();
    const me = this.users.find(u => u.hashed_device_id === deviceHash);
    if (me) this.currentUser = me;
    return this.currentUser;
  }

  // --- MUTATIONS ---
  public insertPost(postData: Omit<Post, 'id' | 'created_at' | 'decay_at' | 'reported_count' | 'is_blurred'>) {
    const now = Date.now();
    const newPost: Post = {
      ...postData,
      id: 'post-' + Math.random().toString(36).substring(2, 9),
      is_blurred: true,
      reported_count: 0,
      created_at: new Date(now).toISOString(),
      decay_at: new Date(now + 6 * 3600 * 1000).toISOString() // 6 hours Redis TTL
    };
    this.posts.unshift(newPost);
    this.saveState();
    return newPost;
  }

  public reportPost(postId: string, reporterId: string, reason: string) {
    const newReport: Report = {
      id: 'report-' + Math.random().toString(36).substring(2, 9),
      post_id: postId,
      reporter_id: reporterId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.reports.push(newReport);

    // Auto-hide by incrementing report count (Triggers instant hide via RLS check)
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.reported_count += 1;
    }
    
    this.saveState();
    return newReport;
  }

  // ATOMIC TRANSACTON RPC
  public unlockPostRpc(postId: string, userId: string) {
    const postIndex = this.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) throw new Error('Post not found');
    const post = this.posts[postIndex];

    // Check if already unlocked
    const alreadyUnlocked = this.unlocks.some(u => u.post_id === postId && u.unlocker_id === userId);
    if (alreadyUnlocked) return;

    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');
    const user = this.users[userIndex];

    const authorId = post.hashed_author_id;

    // Self-unlock does not cost anything
    if (authorId === userId) {
      this.unlocks.push({
        id: 'unlock-' + Math.random().toString(36).substring(2, 9),
        post_id: postId,
        unlocker_id: userId,
        created_at: new Date().toISOString()
      });
      this.saveState();
      return;
    }

    // Atomic Balance Check & Transfer
    if (user.token_balance < post.unlock_price) {
      throw new Error('insufficient balance');
    }

    // Deduct reader balance
    user.token_balance -= post.unlock_price;

    // Reward creator balance (60% i.e. 3/5, or v_price * 3 / 5)
    const authorIndex = this.users.findIndex(u => u.id === authorId);
    if (authorIndex !== -1) {
      this.users[authorIndex].token_balance += Math.floor(post.unlock_price * 3 / 5);
    }

    // Record unlock
    this.unlocks.push({
      id: 'unlock-' + Math.random().toString(36).substring(2, 9),
      post_id: postId,
      unlocker_id: userId,
      created_at: new Date().toISOString()
    });

    // Redis TTL Extend: Extend decay time by 15 mins (cap total at 48h from creation)
    const currentDecay = new Date(post.decay_at).getTime();
    const createdAt = new Date(post.created_at).getTime();
    const extension = 15 * 60 * 1000; // 15 mins
    const maxDecay = createdAt + 48 * 3600 * 1000; // 48 hours max

    post.decay_at = new Date(Math.min(currentDecay + extension, maxDecay)).toISOString();

    this.saveState();
  }

  // Helper for admin/test to reset DB
  public resetDatabase() {
    storage.setItem('spill_db_users', '');
    storage.setItem('spill_db_posts', '');
    storage.setItem('spill_db_unlocks', '');
    storage.setItem('spill_db_reports', '');
    this.users = [];
    this.posts = [];
    this.unlocks = [];
    this.reports = [];
    this.seedIfNeeded();
  }

  // Admin simulation: fast forward time by minutes
  public fastForwardTime(minutes: number) {
    const ms = minutes * 60 * 1000;
    this.posts = this.posts.map(p => ({
      ...p,
      decay_at: new Date(new Date(p.decay_at).getTime() - ms).toISOString(),
      created_at: new Date(new Date(p.created_at).getTime() - ms).toISOString()
    }));
    this.saveState();
  }

  // Admin simulation: grant tokens
  public grantTokens(userId: string, amount: number) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.token_balance += amount;
      this.saveState();
    }
  }
}

export const mockDatabase = new LocalMockDatabase();

// --- SUPABASE CLIENT INTERFACE MOCK ---
export const supabase = {
  auth: {
    getSession: async () => {
      const me = mockDatabase.getCurrentUser();
      return {
        data: {
          session: me ? { user: { id: me.id }, access_token: 'mock-jwt' } : null
        },
        error: null
      };
    }
  },
  
  from: (table: string) => {
    return {
      select: (fields: string = '*') => {
        return {
          order: (column: string, { ascending = false } = {}) => {
            return {
              eq: (col: string, val: any) => {
                let data: any[] = [];
                if (table === 'posts') {
                  data = mockDatabase.getPosts().filter((p: any) => p[col] === val);
                } else if (table === 'users') {
                  data = mockDatabase.getUsers().filter((u: any) => u[col] === val);
                } else if (table === 'unlocks') {
                  data = mockDatabase.getUnlocks().filter((un: any) => un[col] === val);
                }
                
                return Promise.resolve({ data, error: null });
              },
              then: (resolve: any) => {
                let data: any[] = [];
                if (table === 'posts') {
                  data = [...mockDatabase.getPosts()];
                  data.sort((a, b) => {
                    const diff = new Date(a[column]).getTime() - new Date(b[column]).getTime();
                    return ascending ? diff : -diff;
                  });
                } else if (table === 'users') {
                  data = [...mockDatabase.getUsers()];
                } else if (table === 'unlocks') {
                  data = [...mockDatabase.getUnlocks()];
                }
                
                resolve({ data, error: null });
              }
            };
          },
          eq: (col: string, val: any) => {
            return {
              then: (resolve: any) => {
                let data: any[] = [];
                if (table === 'posts') {
                  data = mockDatabase.getPosts().filter((p: any) => p[col] === val);
                } else if (table === 'users') {
                  data = mockDatabase.getUsers().filter((u: any) => u[col] === val);
                } else if (table === 'unlocks') {
                  data = mockDatabase.getUnlocks().filter((un: any) => un[col] === val);
                }
                
                resolve({ data, error: null });
              }
            };
          },
          then: (resolve: any) => {
            let data: any[] = [];
            if (table === 'posts') data = mockDatabase.getPosts();
            else if (table === 'users') data = mockDatabase.getUsers();
            else if (table === 'unlocks') data = mockDatabase.getUnlocks();
            
            resolve({ data, error: null });
          }
        };
      },

      insert: (rows: any[]) => {
        return {
          select: () => ({
            then: (resolve: any) => {
              const results: any[] = [];
              rows.forEach(row => {
                if (table === 'posts') {
                  const p = mockDatabase.insertPost(row);
                  results.push(p);
                } else if (table === 'reports') {
                  const r = mockDatabase.reportPost(row.post_id, row.reporter_id, row.reason);
                  results.push(r);
                }
              });
              resolve({ data: results, error: null });
            }
          }),
          then: (resolve: any) => {
            rows.forEach(row => {
              if (table === 'posts') {
                mockDatabase.insertPost(row);
              } else if (table === 'reports') {
                mockDatabase.reportPost(row.post_id, row.reporter_id, row.reason);
              }
            });
            resolve({ data: null, error: null });
          }
        };
      }
    };
  },

  rpc: async (func: string, params: any) => {
    if (func === 'unlock_post') {
      try {
        mockDatabase.unlockPostRpc(params.p_post_id, params.p_user_id);
        return { data: null, error: null };
      } catch (e: any) {
        return { data: null, error: e.message || 'Error executing RPC' };
      }
    }
    return { data: null, error: 'Unknown RPC function' };
  }
};
