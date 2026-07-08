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
import { Send, Users, ShieldAlert, Hash, ChevronLeft, Lock } from 'lucide-react-native';

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

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

export default function ChaosRoomsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  
  const [publicGroups, setPublicGroups] = useState<any[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [myPrivateGroups, setMyPrivateGroups] = useState<any[]>([]);
  
  const [joinCode, setJoinCode] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeUsers, setActiveUsers] = useState(12);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadGroupsData = async (userProfile: any) => {
    if (!userProfile) return;
    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userProfile.id);
      
      const memberIds = (memberships || []).map((m: any) => m.group_id);
      setJoinedGroupIds(memberIds);

      const { data: allDbGroups } = await supabase.from('groups').select('*');
      if (allDbGroups) {
        const publics = allDbGroups.filter((g: any) => !g.is_private);
        setPublicGroups(publics);

        const privates = allDbGroups.filter((g: any) => g.is_private && memberIds.includes(g.id));
        setMyPrivateGroups(privates);
      }
    } catch (err) {
      console.error("Error loading groups:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const me = await getCurrentUserProfile();
      if (me) {
        setCurrentUser(me);
        await loadGroupsData(me);
      }
    };
    init();
  }, []);

  const loadMessages = async (channelId: string) => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    
    const { data } = await supabase
      .from('group_messages')
      .select('*, users(alias)')
      .eq('group_id', channelId)
      .gt('created_at', fifteenMinsAgo)
      .order('created_at', { ascending: true });

    if (data && currentUser) {
      const formatted = data.map((msg: any) => ({
        id: msg.id,
        sender: `@${msg.users?.alias || 'Unknown'}`,
        text: msg.message,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: msg.sender_id === currentUser.id,
      }));
      setMessages(formatted);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  useEffect(() => {
    if (!activeChannel || !currentUser) return;
    
    loadMessages(activeChannel);
    setActiveUsers(Math.floor(Math.random() * 8) + 5);

    const subscription = supabase
      .channel(`room:${activeChannel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${activeChannel}` }, async (payload) => {
        const newMsg = payload.new;
        const { data: user } = await supabase.from('users').select('alias').eq('id', newMsg.sender_id).single();
        
        const formatted: ChatMessage = {
          id: newMsg.id,
          sender: `@${user?.alias || 'Unknown'}`,
          text: newMsg.message,
          timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: newMsg.sender_id === currentUser.id,
        };
        
        setMessages(prev => {
          if (prev.find(m => m.id === formatted.id)) return prev;
          return [...prev, formatted];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeChannel, currentUser]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser || !activeChannel) return;
    const textToSend = inputText.trim();
    setInputText('');

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      sender: `@${currentUser.alias}`,
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const { error } = await supabase.from('group_messages').insert([{
      group_id: activeChannel,
      sender_id: currentUser.id,
      message: textToSend,
    }]);

    if (error) {
      console.error("Failed to send:", error);
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
  };

  const handleJoinPublicGroup = async (groupId: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('group_members').insert([{
        group_id: groupId,
        user_id: currentUser.id
      }]);
      
      if (error && error.code !== '23505') {
        console.error("Error joining group:", error);
        showAlert("Failed to join public group.", "Error", "error");
        return;
      }
      
      await loadGroupsData(currentUser);
      setActiveChannel(groupId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPrivateGroup = async () => {
    if (!joinCode.trim() || !currentUser) return;
    setLoading(true);
    try {
      const { data: matchedGroups, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', joinCode.trim())
        .eq('is_private', true);

      if (groupErr || !matchedGroups || matchedGroups.length === 0) {
        showAlert("Invalid private invite code.", "Access Denied", "error");
        return;
      }

      const targetGroup = matchedGroups[0];

      const { error: joinErr } = await supabase.from('group_members').insert([{
        group_id: targetGroup.id,
        user_id: currentUser.id
      }]);

      if (joinErr && joinErr.code !== '23505') {
        console.error("Error joining private group:", joinErr);
        showAlert("Failed to join private group.", "Error", "error");
        return;
      }

      await loadGroupsData(currentUser);
      setActiveChannel(targetGroup.id);
      setJoinCode('');
      showAlert(`Successfully joined private room #${targetGroup.name}!`, "Access Granted", "success");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
                placeholder="Enter Invite Code (e.g. SECRET123)..."
                placeholderTextColor={T.muted}
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="none"
              />
              <Pressable style={styles.joinBtn} onPress={handleJoinPrivateGroup}>
                <Text style={styles.joinBtnText}>Join</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: Spacing.two, marginBottom: Spacing.two }]}>PUBLIC CHANNELS</Text>
          {publicGroups.map(g => {
            const hasJoined = joinedGroupIds.includes(g.id);
            return (
              <View key={g.id} style={styles.groupCard}>
                <View style={styles.groupIcon}>
                  <Hash size={16} color={T.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupCardName}>#{g.name}</Text>
                  <Text style={styles.groupCardDesc}>{g.description}</Text>
                </View>
                {hasJoined ? (
                  <Pressable 
                    style={styles.enterBtn} 
                    onPress={() => setActiveChannel(g.id)}
                  >
                    <Text style={styles.enterBtnText}>Open</Text>
                  </Pressable>
                ) : (
                  <Pressable 
                    style={styles.joinChannelBtn} 
                    onPress={() => handleJoinPublicGroup(g.id)}
                  >
                    <Text style={styles.joinChannelBtnText}>Join</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Text style={[styles.sectionTitle, { marginTop: Spacing.four, marginBottom: Spacing.two }]}>YOUR PRIVATE GROUPS</Text>
          {myPrivateGroups.length === 0 ? (
            <Text style={styles.noGroupsText}>No private groups joined yet. Enter an invite code above.</Text>
          ) : (
            myPrivateGroups.map(g => (
              <Pressable key={g.id} style={styles.groupCard} onPress={() => setActiveChannel(g.id)}>
                <View style={[styles.groupIcon, { backgroundColor: 'rgba(232, 178, 61, 0.1)' }]}>
                  <Lock size={14} color="#E8B23D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupCardName}>#{g.name}</Text>
                  <Text style={styles.groupCardDesc}>{g.description || 'Private encrypted group chat.'}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const allGroups = [...publicGroups, ...myPrivateGroups];
  const activeChanInfo = allGroups.find(c => c.id === activeChannel) || { id: 'general-spill', name: 'general-spill', desc: 'Main gossip channel for the group.' };

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
              Group chat history is retained server-side for 24h, but auto-expires from this UI after 15 minutes.
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
  joinChannelBtn: {
    backgroundColor: T.brand,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  joinChannelBtnText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  enterBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  enterBtnText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 'bold',
    color: T.text,
  },
  noGroupsText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: T.muted,
    fontStyle: 'italic',
    padding: Spacing.two,
  },
});
