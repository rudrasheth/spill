import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Users, ShieldAlert } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { mockDatabase } from '@/lib/supabase';

const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  glass: '#FFFFFF',
  glassMedium: '#F5F5F5',
  border: '#EAEAEA',
};

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

const ROOM_CONVERSATIONS: Record<string, string[]> = {
  Instigators: [
    "Did anyone see the CEO of that fintech last night? Absolutely wasted.",
    "I heard they are raising a downround. Valuations are down 80%.",
    "Spill the tea on the QA layoffs — who got cut?",
    "The co-founder is apparently locked out of the Github org.",
    "Posting the pitch deck screenshot later. Get your Receipts ready.",
  ],
  Lurkers: [
    "I'm just here for the drama.",
    "Anyone got the Slack announcement screenshot?",
    "Receipt balance is low — need to submit some gossip soon.",
    "Watching this thread in silence...",
    "Worth spending 8 receipts to unlock the AI power grid post?",
  ],
  Skeptics: [
    "Are we sure that VC story is even real? Sounds made up.",
    "No way a nuclear barge operator is talking to them, that's sci-fi.",
    "Probably fake gossip posted to farm tokens.",
    "Who verified this screenshot? Could easily be edited in DevTools.",
    "Don't trust any gossip under 5 receipts unlock price.",
  ],
};

export default function ChaosRoomsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeUsers, setActiveUsers] = useState(12);
  const flatListRef = useRef<FlatList>(null);

  const [behaviorVector, setBehaviorVector] = useState({
    dwellTime: 42, unlockFreq: 0.7, reportRatio: 0.1, postCount: 2,
  });

  const loadUserData = async () => {
    const me = mockDatabase.getCurrentUser();
    if (me) {
      setCurrentUser(me);
      const posts = mockDatabase.getPosts();
      const unlocks = mockDatabase.getUnlocks();
      const reports = mockDatabase.getReports();
      const myUnlocks = unlocks.filter(u => u.unlocker_id === me.id).length;
      const myReports = reports.filter(r => r.reporter_id === me.id).length;
      const myPosts = posts.filter(p => p.hashed_author_id === me.id).length;

      setBehaviorVector({
        dwellTime: 25 + myUnlocks * 5 + myPosts * 10,
        unlockFreq: posts.length > 0 ? Number((myUnlocks / posts.length).toFixed(2)) : 0,
        reportRatio: myUnlocks > 0 ? Number((myReports / myUnlocks).toFixed(2)) : 0,
        postCount: myPosts,
      });

      const currentRoom = me.cluster_id || 'Skeptics';
      const initialTexts = ROOM_CONVERSATIONS[currentRoom] || ROOM_CONVERSATIONS.Skeptics;
      const seedMsgs: ChatMessage[] = initialTexts.map((text, index) => ({
        id: `msg-seed-${index}`,
        sender: `${currentRoom.substring(0, 3).toUpperCase()}_ANON_${200 + index * 17}`,
        text,
        timestamp: new Date(Date.now() - (initialTexts.length - index) * 120000)
          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: false,
      }));
      setMessages(seedMsgs);
      setActiveUsers(Math.floor(Math.random() * 20) + 10);
    }
  };

  useEffect(() => {
    loadUserData();
    const interval = setInterval(() => {
      const me = mockDatabase.getCurrentUser();
      if (me && currentUser && me.cluster_id !== currentUser.cluster_id) loadUserData();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser?.cluster_id]);

  useEffect(() => {
    const chatSimulator = setInterval(() => {
      if (!currentUser) return;
      const room = currentUser.cluster_id || 'Skeptics';
      const pool = ROOM_CONVERSATIONS[room] || ROOM_CONVERSATIONS.Skeptics;
      const randomText = pool[Math.floor(Math.random() * pool.length)];
      const newMsg: ChatMessage = {
        id: `sim-${Date.now()}`,
        sender: `${room.substring(0, 3).toUpperCase()}_ANON_${Math.floor(Math.random() * 800) + 100}`,
        text: randomText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: false,
      };
      setMessages(prev => [...prev, newMsg]);
      setActiveUsers(prev => Math.max(5, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 12000);
    return () => clearInterval(chatSimulator);
  }, [currentUser]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !currentUser) return;
    setMessages(prev => [...prev, {
      id: `my-${Date.now()}`,
      sender: 'YOU (ANON)',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    }]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const currentRoomName = currentUser?.cluster_id || 'Skeptics';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.pulseDot} />
          <View>
            <Text style={styles.roomName}>CHAOS: {currentRoomName.toUpperCase()}</Text>
            <Text style={styles.subtext}>TEMP BEHAVIORAL CLUSTER</Text>
          </View>
        </View>
        <View style={styles.roomBadge}>
          <Users size={12} color="#1A1A1A" style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>{activeUsers} ONLINE</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={{ flex: 1, justifyContent: 'space-between' }}>

          {/* Stats */}
          <View style={styles.statsBanner}>
            {[
              { label: 'DWELL TIME', value: `${behaviorVector.dwellTime}s` },
              { label: 'UNLOCK RATIO', value: `${Math.round(behaviorVector.unlockFreq * 100)}%` },
              { label: 'REPORTS/UNLOCK', value: `${behaviorVector.reportRatio}` },
              { label: 'POST FREQ', value: `${behaviorVector.postCount}` },
            ].map(stat => (
              <View key={stat.label} style={styles.statBox}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimerRow}>
            <ShieldAlert size={11} color={T.brand} />
            <Text style={styles.disclaimerText}>
              Messages encrypted · auto-expire · Screenshots prohibited
            </Text>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.messageWrap, item.isMe && styles.messageWrapMe]}>
                <View style={styles.messageMeta}>
                  <Text style={[styles.senderName, item.isMe && styles.senderNameMe]}>
                    {item.sender}
                  </Text>
                  <Text style={styles.messageTime}>{item.timestamp}</Text>
                </View>
                <View style={[styles.bubble, item.isMe && styles.bubbleMe]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder={`Message #${currentRoomName.toLowerCase()}...`}
              placeholderTextColor={T.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
            />
            <Pressable style={styles.sendBtn} onPress={handleSendMessage}>
              <Send size={16} color="#FFFFFF" />
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
    width: '100%',
  },

  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.brand,
  },
  roomName: {
    fontFamily: 'Outfit',
    fontSize: 17, fontWeight: '800', letterSpacing: 0,
    color: '#1A1A1A',
  },
  subtext: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 8, color: T.brand, fontWeight: '700', letterSpacing: 1,
  },
  roomBadge: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 20, flexDirection: 'row', alignItems: 'center',
  },
  badgeText: { fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 'bold', color: '#1A1A1A' },

  statsBanner: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  statBox: { alignItems: 'center' },
  statLabel: { fontFamily: 'IBM Plex Mono', fontSize: 8, color: T.muted, fontWeight: '600', letterSpacing: 1 },
  statValue: { fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#1A1A1A', fontWeight: 'bold', marginTop: 2 },

  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  disclaimerText: { fontFamily: 'Inter', fontSize: 11, color: T.brand, flex: 1, fontWeight: '600' },

  chatList: { padding: Spacing.three, gap: 14 },
  messageWrap: { maxWidth: '80%', alignSelf: 'flex-start' },
  messageWrapMe: { alignSelf: 'flex-end' },
  messageMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  senderName: { fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 'bold', color: T.muted },
  senderNameMe: { color: T.brand },
  messageTime: { fontFamily: 'IBM Plex Mono', fontSize: 8, color: T.muted },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    borderTopLeftRadius: 2,
    padding: 12,
  },
  bubbleMe: {
    backgroundColor: '#F5F5F5',
    borderColor: '#F5F5F5',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 2,
  },
  bubbleText: { fontFamily: 'Inter', fontSize: 13, color: '#1A1A1A', lineHeight: 18 },

  inputRow: {
    flexDirection: 'row',
    padding: Spacing.three,
    paddingBottom: Platform.OS === 'web' ? Spacing.three : Spacing.five,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 10,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    color: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontFamily: 'Inter',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: T.brand,
    width: 44, height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
