import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase Environment Variables!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key: string) => {
        try {
          return Platform.OS === 'web' ? localStorage.getItem(key) : null;
        } catch {
          return null;
        }
      },
      setItem: (key: string, val: string) => {
        try {
          if (Platform.OS === 'web') localStorage.setItem(key, val);
        } catch {}
      },
      removeItem: (key: string) => {
        try {
          if (Platform.OS === 'web') localStorage.removeItem(key);
        } catch {}
      }
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to get current DB user profile
export const getCurrentUserProfile = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const signInRes = await supabase.auth.signInAnonymously();
    if (signInRes.error) return null;
    const user = signInRes.data.user;
    if (user) {
      // Check if profile row exists in the public users table
      const { data: profileCheck } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (!profileCheck) {
        const randomId = Math.floor(Math.random() * 900) + 100;
        const alias = `TeaSpiller_${randomId}`;
        await supabase.from('users').insert([{
          id: user.id,
          alias,
          real_identity: 'Anonymous Guest',
          token_balance: 10
        }]);
        const { data: newProfile } = await supabase.from('users').select('*').eq('id', user.id).single();
        return newProfile;
      }
      return profileCheck;
    }
  } else {
    const { data: profileCheck } = await supabase.from('users').select('*').eq('id', sessionData.session.user.id).single();
    if (profileCheck) return profileCheck;
  }
  return null;
};

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
