import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

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
    const mem: Record<string, string> = {};
    return {
      getItem: (key: string) => mem[key] || null,
      setItem: (key: string, val: string) => { mem[key] = val; }
    };
  }
};

const storage = getStorage();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `00000000-0000-0000-0000-${hex.repeat(2)}`;
}

// --- DATABASE TYPES ---
export interface UserProfile {
  id: string;
  alias: string;
  real_identity: string; // e.g. email or real name, visible only to operators
  token_balance: number;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  image_url: string; // seed asset key or image URI
  caption: string;
  unlock_price: number;
  is_blurred: boolean;
  created_at: string;
  expires_at: string | null; // expiration date-time, nullable
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
  public users: UserProfile[] = [];
  public posts: Post[] = [];
  public unlocks: Unlock[] = [];
  public reports: Report[] = [];
  private currentUserSessionId: string = '';

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
      const sess = storage.getItem('spill_current_user_id');

      if (u) this.users = JSON.parse(u);
      if (p) this.posts = JSON.parse(p);
      if (un) this.unlocks = JSON.parse(un);
      if (r) this.reports = JSON.parse(r);
      if (sess) this.currentUserSessionId = sess;
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
      storage.setItem('spill_current_user_id', this.currentUserSessionId);
    } catch (e) {
      console.error('Error saving mock database state:', e);
    }
  }

  public setCurrentUserSessionId(id: string) {
    this.currentUserSessionId = id;
    this.saveState();
  }

  public createUser(email: string, alias: string): UserProfile {
    const newUser: UserProfile = {
      id: simpleHash('user-' + email),
      alias,
      real_identity: email,
      token_balance: 10,
      created_at: new Date().toISOString()
    };
    this.users.push(newUser);
    this.saveState();
    return newUser;
  }

  private seedIfNeeded() {
    const seedUsersData = [
      { email: 'alice@spill.chat', alias: 'TeaSpiller_02' },
      { email: 'bob@spill.chat', alias: 'RumorMill_99' },
      { email: 'charlie@spill.chat', alias: 'SiliconInsider' },
    ];

    seedUsersData.forEach((u) => {
      const id = simpleHash('user-' + u.email);
      if (!this.users.some(usr => usr.id === id)) {
        this.users.push({
          id,
          alias: u.alias,
          real_identity: u.email,
          token_balance: 15,
          created_at: new Date(Date.now() - 86400000).toISOString()
        });
      }
    });

    const aliceId = simpleHash('user-alice@spill.chat');
    const bobId = simpleHash('user-bob@spill.chat');
    const charlieId = simpleHash('user-charlie@spill.chat');

    if (this.posts.length === 0) {
      const now = Date.now();
      this.posts = [
        {
          id: 'post-seed-1',
          author_id: aliceId,
          image_url: 'night_market_gossip',
          caption: "Spotted at the night market: two local VCs arguing over who pays for the $4 noodles. One threatened to downround the other's Series A.",
          unlock_price: 5,
          is_blurred: true,
          created_at: new Date(now - 3600000).toISOString(),
          expires_at: new Date(now + 18000000).toISOString(),
          reported_count: 0
        },
        {
          id: 'post-seed-2',
          author_id: bobId,
          image_url: 'classified_dossier',
          caption: "Leaked internal memo from the major AI lab: they are running out of power grid capacity. They've started negotiations with an offshore nuclear barge operator.",
          unlock_price: 8,
          is_blurred: true,
          created_at: new Date(now - 7200000).toISOString(),
          expires_at: new Date(now + 14400000).toISOString(),
          reported_count: 0
        },
        {
          id: 'post-seed-3',
          author_id: charlieId,
          image_url: 'confidential_leak',
          caption: "Whispers in the fintech cluster: the top payment API is raising transaction fees by 0.5% next quarter without telling merchants in advance.",
          unlock_price: 3,
          is_blurred: true,
          created_at: new Date(now - 14400000).toISOString(),
          expires_at: new Date(now + 7200000).toISOString(),
          reported_count: 0
        }
      ];

      if (this.currentUserSessionId) {
        this.unlocks = [
          {
            id: 'unlock-seed-1',
            post_id: 'post-seed-3',
            unlocker_id: this.currentUserSessionId,
            created_at: new Date().toISOString()
          }
        ];
      }
    }
    
    this.saveState();
  }

  public getUsers() { return this.users; }

  public getPosts() {
    const now = Date.now();
    return this.posts.filter(p => {
      const isExpired = p.expires_at ? new Date(p.expires_at).getTime() <= now : false;
      const isReported = p.reported_count > 0;
      return !isExpired && !isReported;
    });
  }

  public getUnlocks() { return this.unlocks; }
  public getReports() { return this.reports; }

  public getCurrentUser() {
    let me = this.currentUserSessionId ? this.users.find(u => u.id === this.currentUserSessionId) : null;
    if (!me) {
      const randomId = Math.floor(Math.random() * 900) + 100;
      const alias = `TeaSpiller_${randomId}`;
      const email = `anon_${randomId}@spill.chat`;
      me = this.createUser(email, alias);
      this.currentUserSessionId = me.id;
      this.saveState();
    }
    return me;
  }

  public insertPost(postData: Omit<Post, 'id' | 'created_at' | 'reported_count' | 'is_blurred'>) {
    const newPost: Post = {
      ...postData,
      id: 'post-' + Math.random().toString(36).substring(2, 9),
      is_blurred: true,
      reported_count: 0,
      created_at: new Date().toISOString(),
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

    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.reported_count += 1;
    }
    
    this.saveState();
    return newReport;
  }

  public unlockPostRpc(postId: string, userId: string) {
    const postIndex = this.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) throw new Error('Post not found');
    const post = this.posts[postIndex];

    const alreadyUnlocked = this.unlocks.some(u => u.post_id === postId && u.unlocker_id === userId);
    if (alreadyUnlocked) return;

    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');
    const user = this.users[userIndex];

    const authorId = post.author_id;

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

    if (user.token_balance < post.unlock_price) {
      throw new Error('insufficient balance');
    }

    user.token_balance -= post.unlock_price;

    const authorIndex = this.users.findIndex(u => u.id === authorId);
    if (authorIndex !== -1) {
      this.users[authorIndex].token_balance += Math.floor(post.unlock_price * 3 / 5);
    }

    this.unlocks.push({
      id: 'unlock-' + Math.random().toString(36).substring(2, 9),
      post_id: postId,
      unlocker_id: userId,
      created_at: new Date().toISOString()
    });

    this.saveState();
  }

  public resetDatabase() {
    storage.setItem('spill_db_users', '');
    storage.setItem('spill_db_posts', '');
    storage.setItem('spill_db_unlocks', '');
    storage.setItem('spill_db_reports', '');
    this.users = [];
    this.posts = [];
    this.unlocks = [];
    this.reports = [];
    this.currentUserSessionId = '';
    this.seedIfNeeded();
    this.saveState();
  }

  public fastForwardTime(minutes: number) {
    const ms = minutes * 60 * 1000;
    this.posts = this.posts.map(p => ({
      ...p,
      expires_at: p.expires_at ? new Date(new Date(p.expires_at).getTime() - ms).toISOString() : null,
      created_at: new Date(new Date(p.created_at).getTime() - ms).toISOString()
    }));
    this.saveState();
  }

  public grantTokens(userId: string, amount: number) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.token_balance += amount;
      this.saveState();
    }
  }
}

export const mockDatabase = new LocalMockDatabase();

// --- HYBRID REAL SUPABASE CLIENT CONFIG ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isRealSupabaseEnabled = !!(supabaseUrl && supabaseAnonKey);

const realSupabase = isRealSupabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: {
          getItem: (key: string) => {
            try { return storage.getItem(key); } catch { return null; }
          },
          setItem: (key: string, val: string) => {
            try { storage.setItem(key, val); } catch {}
          },
          removeItem: (key: string) => {
            try {
              if (Platform.OS === 'web') {
                localStorage.removeItem(key);
              }
            } catch {}
          }
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

// --- DYNAMICALLY ROUTED EXPORT INTERFACE ---
export const supabase = {
  auth: {
    getSession: async () => {
      if (isRealSupabaseEnabled && realSupabase) {
        const { data, error } = await realSupabase.auth.getSession();
        if (error) return { data: null, error };

        // Auto-login guest anonymously if no active session
        if (!data.session) {
          const signInRes = await realSupabase.auth.signInAnonymously();
          if (signInRes.error) {
            return { data: { session: null }, error: signInRes.error };
          }
          const user = signInRes.data.user;
          if (user) {
            // Check if profile row exists in the public users table
            const { data: profileCheck } = await realSupabase.from('users').select('id').eq('id', user.id);
            if (!profileCheck || profileCheck.length === 0) {
              const randomId = Math.floor(Math.random() * 900) + 100;
              const alias = `TeaSpiller_${randomId}`;
              await realSupabase.from('users').insert([{
                id: user.id,
                alias,
                real_identity: 'Anonymous Guest',
                token_balance: 10
              }]);
            }
          }
          return realSupabase.auth.getSession();
        }
        return { data, error: null };
      }

      const me = mockDatabase.getCurrentUser();
      return {
        data: {
          session: me ? { user: { id: me.id, email: me.real_identity }, access_token: 'mock-jwt' } : null
        },
        error: null
      };
    },
    signInAnonymously: async () => {
      if (isRealSupabaseEnabled && realSupabase) {
        return realSupabase.auth.signInAnonymously();
      }
      const me = mockDatabase.getCurrentUser();
      return {
        data: { user: me ? { id: me.id, email: me.real_identity } : null },
        error: null
      };
    },
    signInWithOtp: async ({ email, inviteCode }: { email: string; inviteCode: string }) => {
      return { data: null, error: new Error('Direct OTP login disabled. Anonymous login only.') };
    },
    signUp: async ({ email, alias, inviteCode }: { email: string; alias: string; inviteCode: string }) => {
      return { data: null, error: new Error('Direct signup disabled. Anonymous login only.') };
    },
    signOut: async () => {
      if (isRealSupabaseEnabled && realSupabase) {
        return realSupabase.auth.signOut();
      }
      mockDatabase.setCurrentUserSessionId('');
      return { error: null };
    }
  },
  
  from: (table: string) => {
    if (isRealSupabaseEnabled && realSupabase) {
      return realSupabase.from(table);
    }

    // Local storage mock builder
    let initialData: any[] = [];
    if (table === 'posts') initialData = mockDatabase.getPosts();
    else if (table === 'users') initialData = mockDatabase.getUsers();
    else if (table === 'unlocks') initialData = mockDatabase.getUnlocks();

    const response = { data: initialData, error: null };
    const promise = Promise.resolve(response) as any;

    promise.order = (column: string, { ascending = false } = {}) => {
      const sorted = [...initialData].sort((a, b) => {
        const diff = new Date(a[column]).getTime() - new Date(b[column]).getTime();
        return ascending ? diff : -diff;
      });
      const sortedResponse = { data: sorted, error: null };
      const sortedPromise = Promise.resolve(sortedResponse) as any;
      sortedPromise.eq = (col: string, val: any) => {
        const filtered = sorted.filter((d: any) => d[col] === val);
        return Promise.resolve({ data: filtered, error: null });
      };
      return sortedPromise;
    };

    promise.eq = (col: string, val: any) => {
      const filtered = initialData.filter((d: any) => d[col] === val);
      return Promise.resolve({ data: filtered, error: null });
    };

    promise.update = (values: any) => {
      return {
        eq: (col: string, val: any) => {
          return {
            then: (resolve: any) => {
              if (table === 'users') {
                const user = mockDatabase.getUsers().find((u: any) => u[col] === val);
                if (user) {
                  if (values.alias) {
                    const taken = mockDatabase.getUsers().some(u => u.id !== user.id && u.alias.toLowerCase() === values.alias.toLowerCase());
                    if (taken) {
                      resolve({ data: null, error: new Error('Alias is already taken.') });
                      return Promise.resolve({ data: null, error: new Error('Alias is already taken.') });
                    }
                    user.alias = values.alias;
                    mockDatabase.saveState();
                  }
                }
              } else if (table === 'posts') {
                const post = mockDatabase.posts.find((p: any) => p[col] === val);
                if (post && values.caption !== undefined) {
                  post.caption = values.caption;
                  mockDatabase.saveState();
                }
              }
              resolve({ data: null, error: null });
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
      } as any;
    };

    return promise;
  },

  rpc: async (func: string, params: any) => {
    if (isRealSupabaseEnabled && realSupabase) {
      return realSupabase.rpc(func, params);
    }
    
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
