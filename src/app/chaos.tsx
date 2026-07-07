import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Users, ShieldAlert, Hash, ChevronLeft } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { getCurrentUserProfile } from '@/lib/supabase';

const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  border: '#EAEAEA',
  success: '#30D158',
};

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

const DEFAULT_CHANNELS = [
  { id: 'general-spill', name: 'general-spill', desc: 'Main gossip channel for the group.' },
  { id: 'crypto-rumors', name: 'crypto-rumors', desc: 'Leaks and rumors from the web3 space.' },
  { id: 'vc-funding-drama', name: 'vc-funding-drama', desc: 'Downrounds, valuation cuts, pitch decks.' },
];

const ROOM_CONVERSATIONS: Record<string, string[]> = {
  'general-spill': [
    "Did anyone see the CEO of that fintech last night? Absolutely wasted.",
    "Heard someone is leaving the marketing team next week.",
    "Spill the tea on the QA layoffs — who got cut?",
    "Co-founder is apparently locked out of the Github org.",
    "Posting the pitch deck screenshot later. Get your Receipts ready.",
  ],
  'crypto-rumors': [
    "Rumor has it a major L2 is planning an unannounced token airdrop.",
    "A certain web3 VC had their telegram hacked yesterday.",
    "Anyone got the Slack announcement screenshot from the protocol team?",
    "Watching this thread in silence...",
    "Heard that the treasury has less than 6 months of runway left.",
  ],
  'vc-funding-drama': [
    "Are we sure that VC story is even real? Sounds made up.",
    "Valuations are down 80% across the board. Downrounds incoming.",
    "Probably fake gossip posted to farm tokens.",
    "Who verified this screenshot? Could easily be edited in DevTools.",
    "CEO is frantically pitching angels to survive the month.",
  ],
};

const BOT_ALIASES = ['@GossipGirl', '@TeaSpiller_02', '@RumorMill_99', '@SiliconInsider', '@SpyX'];

export default function ChaosRoomsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState(DEFAULT_CHANNELS);
  const [joinCode, setJoinCode] = useState('');
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeUsers, setActiveUsers] = useState(12);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const init = async () => {
      const me = await getCurrentUserProfile();
      if (me) setCurrentUser(me);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeChannel && currentUser) {
      const initialTexts = ROOM_CONVERSATIONS[activeChannel] || ROOM_CONVERSATIONS['general-spill'];
      const seedMsgs: ChatMessage[] = initialTexts.map((text, index) => {
        const randBot = BOT_ALIASES[index % BOT_ALIASES.length];
        return {
          id: `msg-seed-${index}-${activeChannel}`,
          sender: randBot,
          text,
          timestamp: new Date(Date.now() - (initialTexts.length - index) * 120000)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false,
        };
      });
      setMessages(seedMsgs);
      setActiveUsers(Math.floor(Math.random() * 8) + 5);
    }
  }, [activeChannel, currentUser]);

  useEffect(() => {
    const chatSimulator = setInterval(() => {
      if (!currentUser || !activeChannel) return;
      const pool = ROOM_CONVERSATIONS[activeChannel] || ROOM_CONVERSATIONS['general-spill'];
      const randomText = pool[Math.floor(Math.random() * pool.length)];
      const randomBot = BOT_ALIASES[Math.floor(Math.random() * BOT_ALIASES.length)];
      
      const newMsg: ChatMessage = {
        id: `sim-${Date.now()}`,
        sender: randomBot,
        text: randomText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: false,
      };
      setMessages(prev => [...prev, newMsg]);
      setActiveUsers(prev => Math.max(3, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 15000);

    return () => clearInterval(chatSimulator);
  }, [currentUser, activeChannel]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !currentUser) return;
    
    const newMsg: ChatMessage = {
      id: `my-${Date.now()}`,
      sender: `@${currentUser.alias}`,
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleJoinGroup = () => {
    if (!joinCode.trim()) return;
    const cleanId = joinCode.toLowerCase().replace(/\s+/g, '-');
    if (!myGroups.find(g => g.id === cleanId)) {
      setMyGroups(prev => [{
        id: cleanId,
        name: cleanId,
        desc: 'Private encrypted group chat.'
      }, ...prev]);
    }
    setActiveChannel(cleanId);
    setJoinCode('');
  };

  if (!activeChannel) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.roomName}>My Groups</Text>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.four }}>
          <View style={styles.joinCard}>
            <Text style={styles.sectionTitle}>JOIN PRIVATE GROUP</Text>
            <View style={styles.joinRow}>
              <TextInput
                style={styles.joinInput}
                placeholder="Enter Invite Code..."
                placeholderTextColor={T.muted}
                value={joinCode}
                onChangeText={setJoinCode}
              />
              <Pressable style={styles.joinBtn} onPress={handleJoinGroup}>
                <Text style={styles.joinBtnText}>Join</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: Spacing.four, marginBottom: Spacing.two }]}>YOUR GROUPS</Text>
          {myGroups.map(g => (
            <Pressable key={g.id} style={styles.groupCard} onPress={() => setActiveChannel(g.id)}>
              <View style={styles.groupIcon}>
                <Hash size={16} color={T.brand} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.groupCardName}>#{g.name}</Text>
                <Text style={styles.groupCardDesc}>{g.desc}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeChanInfo = myGroups.find(c => c.id === activeChannel) || myGroups[0];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Upper header */}
      <View style={styles.header}>
        <Pressable onPress={() => setActiveChannel(null)} style={{ marginRight: 12 }}>
          <ChevronLeft size={24} color={T.text} />
        </Pressable>
        <View style={styles.titleRow}>
          <View style={styles.pulseDot} />
          <View>
            <Text style={styles.roomName}>#{activeChanInfo.name}</Text>
            <Text style={styles.subtext}>{activeChanInfo.desc}</Text>
          </View>
        </View>
        <View style={styles.roomBadge}>
          <Users size={12} color={T.text} style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>{activeUsers} ONLINE</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          
          {/* Security Banner */}
          <View style={styles.disclaimerRow}>
            <ShieldAlert size={12} color={T.brand} style={{ marginRight: 6 }} />
            <Text style={styles.disclaimerText}>
              Group chat history is not persistent and automatically auto-expires.
            </Text>
          </View>

          {/* Messages Feed */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.messageWrap, item.isMe && styles.messageWrapMe]}>
                <View style={[styles.messageHeaderRow, item.isMe && styles.messageHeaderRowMe]}>
                  <Text style={[styles.senderName, item.isMe && styles.senderNameMe]}>
                    {item.sender}
                  </Text>
                  <Text style={styles.messageTime}>{item.timestamp}</Text>
                </View>
                <View style={[styles.bubble, item.isMe && styles.bubbleMe]}>
                  <Text style={[styles.bubbleText, item.isMe && styles.bubbleTextMe]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Chat Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder={`Message #${activeChanInfo.name}...`}
              placeholderTextColor={T.muted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
              id="input-chat-message"
            />
            <Pressable 
              style={({ pressed }) => [
                styles.sendBtn,
                pressed && styles.pressed,
              ]} 
              onPress={handleSendMessage}
              id="btn-chat-send"
            >
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
    backgroundColor: T.bg,
    width: '100%',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
    backgroundColor: T.bg,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.brand,
  },
  roomName: {
    fontFamily: 'Outfit',
    fontSize: 16,
    fontWeight: '900',
    color: T.text,
  },
  subtext: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: T.muted,
    marginTop: 2,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.border,
  },
  badgeText: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  joinCard: {
    backgroundColor: T.surface,
    borderRadius: 12,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.three,
  },
  joinRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  joinInput: {
    flex: 1,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: 'Inter',
    color: T.text,
  },
  joinBtn: {
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
    height: 44,
  },
  joinBtnText: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 59, 92, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupCardName: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: 'bold',
    color: T.text,
  },
  groupCardDesc: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: T.muted,
    marginTop: 2,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
  },
  disclaimerText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#FF3B5C',
    flex: 1,
  },
  chatList: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  messageWrap: {
    alignItems: 'flex-start',
    width: '100%',
  },
  messageWrapMe: {
    alignItems: 'flex-end',
  },
  messageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  messageHeaderRowMe: {
    flexDirection: 'row-reverse',
  },
  senderName: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  senderNameMe: {
    color: T.brand,
  },
  messageTime: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: T.muted,
  },
  bubble: {
    backgroundColor: T.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: T.border,
  },
  bubbleMe: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  bubbleText: {
    fontFamily: 'Inter',
    fontSize: 13.5,
    lineHeight: 18,
    color: '#1A1A1A',
  },
  bubbleTextMe: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    padding: Spacing.three,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
    gap: Spacing.two,
  },
  chatInput: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: 'Inter',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: T.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
