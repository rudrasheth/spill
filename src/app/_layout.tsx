import React, { useEffect, useState } from 'react';
import { Slot, router, usePathname } from 'expo-router';
import { ThemeProvider, DefaultTheme } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { Flame, Zap, Plus, Ticket, Terminal, Command, Menu, X, AlertCircle, CheckCircle, Info, Lock, Key, User, Sparkles, ChevronRight, ChevronLeft, Target, Award } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { supabase, getCurrentUserProfile } from '@/lib/supabase';
import { registerAlertListener, AlertType } from '@/lib/alert';
import { getSecureItem, setSecureItem } from '@/lib/secure-store';

SplashScreen.preventAutoHideAsync().catch(() => {});

import { useFonts } from 'expo-font';

export const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  border: '#EAEAEA',
  success: '#30D158',
};

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const [fontsLoaded] = useFonts({
    'Outfit': 'https://fonts.gstatic.com/s/outfit/v11/F3u81gq05yJH5mX3NSA.woff2',
    'Inter': 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhjp-Ek-_eeAmJ.woff2',
    'IBM Plex Mono': 'https://fonts.gstatic.com/s/ibmplexmono/v19/-F6qFJt24tiMecnWW-1NiFUXdPDtbGO1217S2sT4.woff2',
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktop = width >= 1024 && Platform.OS === 'web';
  const pathname = usePathname();
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    message: string;
    title: string;
    type: AlertType;
  }>({
    visible: false,
    message: '',
    title: 'ALERT',
    type: 'info',
  });

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [needProfileSetup, setNeedProfileSetup] = useState(false);
  const [needQuiz, setNeedQuiz] = useState(false);

  const [passwordInput, setPasswordInput] = useState('');
  const [isVerifyingPass, setIsVerifyingPass] = useState(false);

  const [needAuth, setNeedAuth] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [aliasInput, setAliasInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🕵️');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const AVATARS = ['🕵️', '🦊', '🐱', '🐼', '🦁', '🐸', '🐙', '🦄', '🦖', '🤖', '👻', '👾'];

  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<any>({
    module: 'other',
    role: 'lurker',
    poison: 'chaos',
    spend: 'anything_goes',
    vibe: '😌 Chill lurker'
  });

  const QUIZ_QUESTIONS = [
    {
      title: "Which module are you most here for?",
      key: "module",
      options: [
        { label: "Student Life (Gossip & School Drama)", value: "student" },
        { label: "Office Life (Work & Career Rumors)", value: "office" },
        { label: "Others (Random Spills & Chaos)", value: "other" }
      ]
    },
    {
      title: "What's your gossip style?",
      key: "role",
      options: [
        { label: "Instigator (I love starting the drama)", value: "instigator" },
        { label: "Lurker (I just like to read the tea)", value: "lurker" },
        { label: "Reporter (I love posting verified facts)", value: "reporter" }
      ]
    },
    {
      title: "Pick your poison:",
      key: "poison",
      options: [
        { label: "Relationship drama", value: "relationship" },
        { label: "Money & career rumors", value: "money_career" },
        { label: "Random workplace chaos", value: "chaos" }
      ]
    },
    {
      title: "How juicy does it have to be for you to spend tokens?",
      key: "spend",
      options: [
        { label: "Anything goes! (Unlock all)", value: "anything_goes" },
        { label: "Only A-tier drama (Selective unlocking)", value: "only_a_tier" },
        { label: "Rarely unlock (Saver mode)", value: "rarely_unlock" }
      ]
    },
    {
      title: "Pick a vibe:",
      key: "vibe",
      options: [
        { label: "🔥 Chaotic (Bring the fire)", value: "🔥 Chaotic" },
        { label: "🕵️ Investigative (Fact finder)", value: "🕵️ Investigative" },
        { label: "😌 Chill lurker (Zen observer)", value: "😌 Chill lurker" }
      ]
    }
  ];

  const checkOnboarding = async () => {
    try {
      const verified = await getSecureItem('spill_password_verified');
      if (verified === 'true') {
        setIsPasswordVerified(true);
        const profile = await getCurrentUserProfile();
        if (profile) {
          setNeedAuth(false);
          setUserProfile(profile);
          const hasDefaultAlias = profile.alias.startsWith('TeaSpiller_');
          
          if (hasDefaultAlias || !profile.avatar) {
            setNeedProfileSetup(true);
            setNeedQuiz(profile.role == null);
          } else if (profile.role == null) {
            setNeedProfileSetup(false);
            setNeedQuiz(true);
          } else {
            setNeedProfileSetup(false);
            setNeedQuiz(false);
          }
        } else {
          setNeedAuth(true);
        }
      } else {
        setIsPasswordVerified(false);
        setNeedAuth(false);
      }
    } catch (e) {
      console.error("[Onboarding] check error:", e);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    checkOnboarding();

    const unsubscribe = registerAlertListener(({ message, title, type }) => {
      setAlertConfig({
        visible: true,
        message,
        title: title || 'ALERT',
        type: type || 'info',
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setNeedAuth(true);
        setNeedProfileSetup(false);
        setNeedQuiz(false);
        setUserProfile(null);
      } else if (event === 'SIGNED_IN') {
        checkOnboarding();
      }
    });

    return () => {
      unsubscribe();
      subscription.unsubscribe();
    };
  }, []);

  const handleVerifyPassword = async (pass: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-password', {
        body: { password: pass }
      });
      if (error || !data) {
        setAlertConfig({
          visible: true,
          title: "Access Denied",
          message: error?.message || "Verification failed.",
          type: "error"
        });
        return;
      }
      if (data.success) {
        await setSecureItem('spill_password_verified', 'true');
        await setSecureItem('spill_shared_passcode', pass);
        setIsPasswordVerified(true);
        await checkOnboarding();
      } else {
        setAlertConfig({
          visible: true,
          title: "Access Denied",
          message: "Incorrect security clearance passcode.",
          type: "error"
        });
      }
    } catch (e: any) {
      setAlertConfig({
        visible: true,
        title: "Error",
        message: e.message || "An unexpected error occurred.",
        type: "error"
      });
    }
  };

  const handleQuizAnswer = (key: string, value: string) => {
    const nextAnswers = { ...quizAnswers, [key]: value };
    setQuizAnswers(nextAnswers);
    if (quizStep < QUIZ_QUESTIONS.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      submitQuiz(nextAnswers);
    }
  };

  const submitQuiz = async (answers: any) => {
    try {
      const { error: userErr } = await supabase
        .from('users')
        .update({
          role: answers.role,
          spend_threshold: answers.spend,
          badge: answers.vibe
        })
        .eq('id', userProfile.id);

      if (userErr) throw userErr;

      const tags = ['student', 'office', 'other', 'relationship', 'money_career', 'chaos'];
      const affinityRows = tags.map(t => {
        let score = 1.0;
        if (t === answers.module) score = 5.0;
        if (t === answers.poison) score = 5.0;
        return {
          user_id: userProfile.id,
          tag: t,
          affinity_score: score
        };
      });

      await supabase.from('user_tag_affinity').delete().eq('user_id', userProfile.id);
      const { error: affinityErr } = await supabase
        .from('user_tag_affinity')
        .insert(affinityRows);

      if (affinityErr) throw affinityErr;

      await checkOnboarding();
    } catch (e: any) {
      setAlertConfig({
        visible: true,
        title: "Quiz Save Failed",
        message: e.message || "Failed to initialize cognitive affinities.",
        type: "error"
      });
    }
  };

  const handleSkipQuiz = async () => {
    const defaultAnswers = {
      module: 'other',
      role: 'lurker',
      poison: 'chaos',
      spend: 'anything_goes',
      vibe: '😌 Chill lurker'
    };
    await submitQuiz(defaultAnswers);
  };

  const handleAuth = async () => {
    if (!aliasInput || !aliasInput.trim()) {
      setAlertConfig({ visible: true, title: "Error", message: "Please enter your agent alias.", type: "error" });
      return;
    }

    const trimmedAlias = aliasInput.trim();
    if (trimmedAlias.length < 3) {
      setAlertConfig({
        visible: true,
        title: "Invalid Alias",
        message: "Agent alias must be at least 3 characters.",
        type: "error"
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const passcode = await getSecureItem('spill_shared_passcode') || "securecode";
      const ghostEmail = `${trimmedAlias.replace(/\s+/g, '').toLowerCase()}@spill.agent`;

      // 1. Try to sign in
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: ghostEmail,
        password: passcode
      });

      if (signInErr) {
        if (signInErr.message.includes('Invalid login credentials') || signInErr.message.includes('Email not confirmed')) {
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: ghostEmail,
            password: passcode
          });

          if (signUpErr) throw signUpErr;

          if (signUpData?.user) {
            const { error: profileErr } = await supabase.from('users').upsert({
              id: signUpData.user.id,
              alias: trimmedAlias,
              avatar: selectedAvatar,
              real_identity: ghostEmail,
              token_balance: 10
            });
            if (profileErr) console.error("Failed to insert user profile:", profileErr.message);
          }
        } else {
          throw signInErr;
        }
      } else if (signInData?.user) {
        const { error: updateErr } = await supabase.from('users').update({
          alias: trimmedAlias,
          avatar: selectedAvatar
        }).eq('id', signInData.user.id);
        if (updateErr) console.error("Failed to update user profile on login:", updateErr.message);
      }

      await checkOnboarding();
    } catch (error: any) {
      setAlertConfig({ visible: true, title: "Authentication Failed", message: error.message, type: "error" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const renderAlertModal = () => {
    if (!alertConfig.visible) return null;

    let IconComponent = Info;
    let iconColor = T.text;
    if (alertConfig.type === 'error') {
      IconComponent = AlertCircle;
      iconColor = T.brand;
    } else if (alertConfig.type === 'success') {
      IconComponent = CheckCircle;
      iconColor = T.success;
    }

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={[styles.modalIconContainer, { backgroundColor: iconColor + '15' }]}>
            <IconComponent size={24} color={iconColor} />
          </View>
          <Text style={styles.modalTitle}>{alertConfig.title.toUpperCase()}</Text>
          <Text style={styles.modalMessage}>{alertConfig.message}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.modalBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
          >
            <Text style={styles.modalBtnText}>DISMISS</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderAuthScreen = () => (
    <View style={styles.onboardingContainer}>
      <View style={styles.onboardingCard}>
        <View style={styles.iconCircle}>
          <User size={24} color="#FF3B5C" />
        </View>
        <Text style={styles.onboardingTitle}>ESTABLISH SECURE IDENTITY</Text>
        <Text style={styles.onboardingSubtitle}>
          Choose your Agent Alias and an avatar visual key to identify your posts. If your alias already exists, we will log you in.
        </Text>

        <Text style={styles.inputLabel}>AGENT ALIAS</Text>
        <TextInput
          style={styles.onboardingInput}
          placeholder="e.g. GossipKing99"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          value={aliasInput}
          onChangeText={setAliasInput}
          id="input-login-alias"
        />

        <Text style={styles.inputLabel}>CHOOSE AVATAR VISUAL KEY</Text>
        <View style={styles.avatarGrid}>
          {AVATARS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.avatarItem,
                selectedAvatar === emoji && styles.avatarItemSelected
              ]}
              onPress={() => setSelectedAvatar(emoji)}
            >
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.onboardingBtn,
            pressed && styles.pressed,
            isAuthenticating && styles.disabledBtn
          ]}
          onPress={handleAuth}
          disabled={isAuthenticating}
          id="btn-login-establish"
        >
          {isAuthenticating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.onboardingBtnText}>ACCESS INTEL FEED</Text>
          )}
        </Pressable>
      </View>
      {renderAlertModal()}
    </View>
  );

  const renderPasswordLogin = () => (
    <View style={styles.onboardingContainer}>
      <View style={styles.onboardingCard}>
        <View style={styles.iconCircle}>
          <Lock size={24} color="#FF3B5C" />
        </View>
        <Text style={styles.onboardingTitle}>DECRYPT SPILL NETWORK</Text>
        <Text style={styles.onboardingSubtitle}>
          Enter the shared passcode to decrypt and access this private group intelligence feed.
        </Text>

        <TextInput
          style={styles.onboardingInput}
          placeholder="Secure passcode"
          placeholderTextColor="#8A8A8A"
          secureTextEntry
          value={passwordInput}
          onChangeText={setPasswordInput}
          onSubmitEditing={async () => {
            if (isVerifyingPass) return;
            setIsVerifyingPass(true);
            await handleVerifyPassword(passwordInput);
            setIsVerifyingPass(false);
          }}
          autoFocus
        />

        <Pressable
          style={({ pressed }) => [
            styles.onboardingBtn,
            pressed && styles.pressed,
            isVerifyingPass && styles.disabledBtn
          ]}
          onPress={async () => {
            if (isVerifyingPass) return;
            setIsVerifyingPass(true);
            await handleVerifyPassword(passwordInput);
            setIsVerifyingPass(false);
          }}
          disabled={isVerifyingPass}
        >
          {isVerifyingPass ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Key size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.onboardingBtnText}>VERIFY CLEARANCE</Text>
            </>
          )}
        </Pressable>
      </View>
      {renderAlertModal()}
    </View>
  );

  const renderProfileSetup = () => (
    <View style={styles.onboardingContainer}>
      <View style={styles.onboardingCard}>
        <View style={styles.iconCircle}>
          <User size={24} color="#FF3B5C" />
        </View>
        <Text style={styles.onboardingTitle}>ESTABLISH SECURE ALIAS</Text>
        <Text style={styles.onboardingSubtitle}>
          Choose an alias and a visual key so friends can recognize you without knowing your real identity.
        </Text>

        <Text style={styles.inputLabel}>YOUR AGENT ALIAS</Text>
        <TextInput
          style={styles.onboardingInput}
          placeholder="e.g. TeaSpiller_42"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          value={aliasInput}
          onChangeText={setAliasInput}
        />

        <Text style={styles.inputLabel}>CHOOSE AVATAR VISUAL KEY</Text>
        <View style={styles.avatarGrid}>
          {AVATARS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.avatarItem,
                selectedAvatar === emoji && styles.avatarItemSelected
              ]}
              onPress={() => setSelectedAvatar(emoji)}
            >
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.onboardingBtn,
            pressed && styles.pressed,
            isSavingProfile && styles.disabledBtn
          ]}
          onPress={async () => {
            if (isSavingProfile) return;
            if (aliasInput.trim().length < 3) {
              setAlertConfig({
                visible: true,
                title: "Invalid Alias",
                message: "Alias must be at least 3 characters.",
                type: "error"
              });
              return;
            }
            setIsSavingProfile(true);
            try {
              const { error } = await supabase
                .from('users')
                .update({
                  alias: aliasInput.trim(),
                  avatar: selectedAvatar
                })
                .eq('id', userProfile.id);

              if (error) {
                if (error.message.includes('unique')) {
                  setAlertConfig({
                    visible: true,
                    title: "Alias Taken",
                    message: "This alias is already claimed by another agent. Choose a different one.",
                    type: "error"
                  });
                } else {
                  setAlertConfig({
                    visible: true,
                    title: "Setup Failed",
                    message: error.message || "Failed to update profile.",
                    type: "error"
                  });
                }
              } else {
                await checkOnboarding();
              }
            } catch (e: any) {
              setAlertConfig({
                visible: true,
                title: "Error",
                message: e.message || "An unexpected error occurred.",
                type: "error"
              });
            } finally {
              setIsSavingProfile(false);
            }
          }}
          disabled={isSavingProfile}
        >
          {isSavingProfile ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.onboardingBtnText}>ESTABLISH IDENTITY</Text>
            </>
          )}
        </Pressable>
      </View>
      {renderAlertModal()}
    </View>
  );

  const renderPersonalityQuiz = () => {
    const currentQuestion = QUIZ_QUESTIONS[quizStep];
    return (
      <View style={styles.onboardingContainer}>
        <View style={styles.onboardingCard}>
          <View style={styles.quizHeaderRow}>
            {quizStep > 0 && (
              <Pressable onPress={() => setQuizStep(quizStep - 1)} style={styles.quizBackBtn}>
                <ChevronLeft size={16} color="#8A8A8A" />
              </Pressable>
            )}
            <Text style={styles.quizProgressText}>
              ALIGNMENT INTERVIEW PHASE 0{quizStep + 1}
            </Text>
            <View style={{ width: 16 }} />
          </View>

          <Text style={styles.onboardingTitle}>{currentQuestion.title}</Text>
          <Text style={styles.onboardingSubtitle}>
            Your response determines feed prioritization and initial agent tuning.
          </Text>

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((opt) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.optionBtn,
                  pressed && styles.pressed
                ]}
                onPress={() => handleQuizAnswer(currentQuestion.key, opt.value)}
              >
                <Text style={styles.optionBtnText}>{opt.label}</Text>
                <ChevronRight size={14} color="#FF3B5C" />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleSkipQuiz} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip Interview & Use Default Tuning</Text>
          </Pressable>
        </View>
        {renderAlertModal()}
      </View>
    );
  };

  useEffect(() => {
    if (mounted && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [mounted, fontsLoaded]);

  if (!mounted || !fontsLoaded) return null;

  if (isCheckingAuth) {
    return (
      <View style={styles.onboardingContainer}>
        <ActivityIndicator size="large" color="#FF3B5C" />
        <Text style={styles.loadingText}>AUTHORIZING NETWORK ACCESS...</Text>
      </View>
    );
  }

  if (!isPasswordVerified) {
    return renderPasswordLogin();
  }

  if (needAuth) {
    return renderAuthScreen();
  }

  if (needProfileSetup) {
    return renderProfileSetup();
  }

  if (needQuiz) {
    return renderPersonalityQuiz();
  }

  const buttons = [
    { name: 'Feed',     path: '/',        icon: Flame    },
    { name: 'Groups',   path: '/chaos',   icon: Zap      },
    { name: 'Bounties', path: '/bounties',icon: Target   },
    { name: 'Spill',    path: '/post',    icon: Plus     },
    { name: 'Wallet',   path: '/wallet',  icon: Ticket   },
    { name: 'Logs',     path: '/profile', icon: Terminal },
  ];

  const renderDesktopSidebar = () => (
    <View style={styles.desktopSidebar}>
      {/* Brand */}
      <View style={styles.brandContainer}>
        <View style={styles.brandIcon}>
          <Command size={18} color={'#FFFFFF'} />
        </View>
        <Text style={styles.brandTitle}>Spill</Text>
      </View>

      <Text style={styles.menuLabel}>MENU</Text>

      <View style={styles.navGroup}>
        {buttons.map((btn) => {
          const isFocused = pathname === btn.path;
          const Icon = btn.icon;
          return (
            <Pressable
              key={btn.path}
              onPress={() => router.push(btn.path as any)}
              style={({ pressed }) => [
                styles.sidebarBtn,
                isFocused && styles.sidebarBtnFocused,
                pressed && styles.pressed,
              ]}
            >
              <Icon size={16} color={isFocused ? '#FFFFFF' : T.text} style={styles.iconSpacing} />
              <Text style={[styles.sidebarBtnText, isFocused ? styles.textActive : styles.textInactive]}>
                {btn.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderRightSidebar = () => (
    <View style={styles.rightSidebar}>
      <Text style={styles.rightSidebarTitle}>TRENDING INTEL</Text>
      
      <View style={styles.trendingCard}>
        <Text style={styles.trendingTopic}>#FintechLayoffs</Text>
        <Text style={styles.trendingStats}>42 posts • 8.4k unlocks</Text>
      </View>
      
      <View style={styles.trendingCard}>
        <Text style={styles.trendingTopic}>#CEOFlightLogs</Text>
        <Text style={styles.trendingStats}>18 posts • 3.2k unlocks</Text>
      </View>
      
      <View style={styles.trendingCard}>
        <Text style={styles.trendingTopic}>#SeriesC_Downround</Text>
        <Text style={styles.trendingStats}>9 posts • 1.1k unlocks</Text>
      </View>

      <Text style={[styles.rightSidebarTitle, { marginTop: Spacing.four }]}>TOP AGENTS</Text>
      <View style={styles.agentRow}>
        <View style={styles.agentAvatar} />
        <View>
          <Text style={styles.agentName}>TeaSpiller_02</Text>
          <Text style={styles.agentStats}>Instigator • 2.4k RCPT</Text>
        </View>
      </View>
      <View style={styles.agentRow}>
        <View style={styles.agentAvatar} />
        <View>
          <Text style={styles.agentName}>RumorMill_99</Text>
          <Text style={styles.agentStats}>Lurker • 890 RCPT</Text>
        </View>
      </View>
    </View>
  );



  if (isDesktop) {
    return (
      <ThemeProvider value={DefaultTheme}>
        <View style={styles.desktopContainer}>
          {renderDesktopSidebar()}
          <View style={styles.mainContent}>
            <Slot />
          </View>
          {renderRightSidebar()}
          {renderAlertModal()}
        </View>
      </ThemeProvider>
    );
  }

  // Custom Mobile Layout with Collapsible Dashboard
  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={styles.mobileContainer}>
        {/* Mobile Top Bar */}
        <View style={styles.mobileTopBar}>
          <Pressable onPress={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} color={T.text} />
          </Pressable>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <View style={styles.brandIconSmall}><Command size={14} color={'#FFFFFF'} /></View>
            <Text style={styles.brandTitleSmall}>Spill</Text>
          </View>
          <View style={{width: 24}} />
        </View>

        <View style={styles.mainContent}>
          <Slot />
        </View>

        {isMobileMenuOpen && (
          <View style={styles.mobileMenuOverlay}>
            <Pressable style={styles.mobileMenuBackdrop} onPress={() => setIsMobileMenuOpen(false)} />
            <View style={styles.mobileMenuSidebar}>
              <Pressable onPress={() => setIsMobileMenuOpen(false)} style={{alignSelf: 'flex-end', marginBottom: 10}}>
                <X size={24} color={T.text} />
              </Pressable>
              
              <Text style={styles.menuLabel}>MENU</Text>
              <View style={styles.navGroup}>
                {buttons.map((btn) => {
                  const isFocused = pathname === btn.path || (pathname === '/index' && btn.path === '/');
                  const Icon = btn.icon;
                  return (
                    <Pressable
                      key={btn.path}
                      onPress={() => {
                        setIsMobileMenuOpen(false);
                        router.push(btn.path as any);
                      }}
                      style={({ pressed }) => [
                        styles.sidebarBtn,
                        isFocused && styles.sidebarBtnFocused,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon size={18} color={isFocused ? '#FFFFFF' : T.text} style={styles.iconSpacing} />
                      <Text style={[styles.sidebarBtnText, isFocused ? styles.textActive : styles.textInactive, {fontSize: 18}]}>
                        {btn.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
        {renderAlertModal()}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flexDirection: 'row',
    flex: 1,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    height: '100%',
  },

  // ── Sidebar ─────────────────────────────────────────
  desktopSidebar: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#EAEAEA',
    padding: Spacing.four,
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },

  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.six,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: 'Outfit',
    fontSize: 24,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.5,
  },

  menuLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: '700',
    color: T.muted,
    marginBottom: Spacing.two,
    letterSpacing: 2,
  },

  navGroup: { flex: 1, gap: 4 },

  sidebarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sidebarBtnFocused: {
    backgroundColor: T.brand,
  },
  iconSpacing: { marginRight: 12 },
  sidebarBtnText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  textActive:   { color: '#FFFFFF' },
  textInactive: { color: T.text },
  pressed: { opacity: 0.75 },

  // ── Right Sidebar ─────────────────────────────────────────
  rightSidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#EAEAEA',
    padding: Spacing.four,
    flexDirection: 'column',
  },
  rightSidebarTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8A8A8A',
    marginBottom: Spacing.three,
    letterSpacing: 1,
  },
  trendingCard: {
    backgroundColor: '#F5F5F5',
    padding: Spacing.three,
    borderRadius: 8,
    marginBottom: Spacing.two,
  },
  trendingTopic: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  trendingStats: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color: '#8A8A8A',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.two,
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  agentName: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  agentStats: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: '#8A8A8A',
    marginTop: 2,
  },
  // ── Mobile Elements ─────────────────────────────────────────
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  brandIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitleSmall: {
    fontFamily: 'Outfit',
    fontSize: 20,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.5,
  },
  mobileMenuOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    zIndex: 999,
  },
  mobileMenuBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileMenuSidebar: {
    width: '75%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    height: '100%',
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 14, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: Spacing.six,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: Spacing.six,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Outfit',
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modalMessage: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white/paper-white background
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  loadingText: {
    color: '#8A8A8A',
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    marginTop: 12,
    letterSpacing: 1.5,
  },
  onboardingCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 249, 240, 0.85)', // Frosted glass light
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)', // Subtle ink hairline
    borderRadius: 24,
    padding: Spacing.six,
    alignItems: 'center',
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 92, 0.3)',
  },
  onboardingTitle: {
    fontFamily: 'Outfit',
    fontSize: 24,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  onboardingSubtitle: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#8A8A8A',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.five,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FF3B5C',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  onboardingInput: {
    width: '100%',
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#1A1A1A',
    fontFamily: 'Inter',
    fontSize: 15,
    marginBottom: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  onboardingBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#FF3B5C',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  onboardingBtnText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  avatarItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarItemSelected: {
    borderColor: '#FF3B5C',
    backgroundColor: 'rgba(255, 59, 92, 0.1)',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  quizHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.three,
  },
  quizBackBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  quizProgressText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FF3B5C',
    letterSpacing: 1.5,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: Spacing.five,
  },
  optionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  optionBtnText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#8A8A8A',
    textDecorationLine: 'underline',
  },
}) as any;
