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
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      console.error("[Supabase] getSession error:", sessionErr);
    }
    
    if (!sessionData?.session) {
      // If there is no session, we return null so the UI can show the Email/Password Auth screen
      return null;
    } else {
      const { data: profileCheck, error: profileErr } = await supabase.from('users').select('*').eq('id', sessionData.session.user.id).single();
      if (profileCheck) return profileCheck;

      console.warn("[Supabase] Active session exists but profile row is missing. Error:", profileErr?.message);
      
      // Auto-recreate missing profile if session exists but no profile row
      const randomId = Math.floor(Math.random() * 900) + 100;
      const alias = `TeaSpiller_${randomId}`;
      const { error: insertErr } = await supabase.from('users').insert([{
        id: sessionData.session.user.id,
        alias,
        real_identity: sessionData.session.user.email || 'Unknown User',
        token_balance: 10
      }]);
      
      if (insertErr) {
        console.error("[Supabase] Failed to auto-recreate missing profile:", insertErr.message);
      }
      const { data: newProfile } = await supabase.from('users').select('*').eq('id', sessionData.session.user.id).single();
      return newProfile;
    }
  } catch (e: any) {
    console.error("[Supabase] Exception in getCurrentUserProfile:", e.message || e);
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
  module: 'student' | 'office' | 'other';
  tag: 'relationship' | 'money_career' | 'chaos';
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
