import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, ArrowUpRight, ArrowDownLeft, Flame, Info, TrendingDown } from 'lucide-react-native';

import { Colors, Spacing } from '@/constants/theme';
import { supabase, mockDatabase } from '@/lib/supabase';

interface LedgerItem {
  id: string;
  type: 'spend' | 'earn' | 'purchase';
  amount: number;
  label: string;
  timestamp: string;
}

export default function WalletScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark'];

  const [balance, setBalance] = useState(10);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);

  const loadWalletData = async () => {
    const me = mockDatabase.getCurrentUser();
    if (me) {
      setBalance(me.token_balance);

      // Construct a dynamic transaction ledger from unlocks, posts, and purchases
      const unlocks = mockDatabase.getUnlocks().filter(u => u.unlocker_id === me.id);
      const posts = mockDatabase.getPosts();
      const myPosts = posts.filter(p => p.hashed_author_id === me.id);

      const items: LedgerItem[] = [];

      // Add unlocks (Spends)
      unlocks.forEach((un) => {
        const post = posts.find(p => p.id === un.post_id);
        const cost = post ? post.unlock_price : 5;
        items.push({
          id: un.id,
          type: 'spend',
          amount: cost,
          label: `Unlocked Gossip: ${post?.id || 'Unknown'}`,
          timestamp: new Date(un.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        });
      });

      // Add posts (Earnings)
      myPosts.forEach((post) => {
        items.push({
          id: post.id,
          type: 'earn',
          amount: 3, // posting reward
          label: `Submitted Gossip Proof: ${post.id}`,
          timestamp: new Date(post.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        });
      });

      // Mock starting purchase
      items.push({
        id: 'init-purchase',
        type: 'purchase',
        amount: 10,
        label: 'Platform Welcome Grant',
        timestamp: new Date(me.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      });

      // Sort items by date (newest first)
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLedger(items);
    }
  };

  useEffect(() => {
    loadWalletData();
    // Poll balance and ledger
    const interval = setInterval(loadWalletData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleBuyTokens = (amount: number) => {
    const me = mockDatabase.getCurrentUser();
    if (me) {
      mockDatabase.grantTokens(me.id, amount);
      loadWalletData();
      alert(`Successfully loaded +${amount} Receipts!`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>RECEIPTS WALLET</Text>
          <Text style={styles.subtitle}>LEDGER & TRANSACTION SINK</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.ticketCornerTopLeft} />
          <View style={styles.ticketCornerTopRight} />
          <View style={styles.ticketCornerBottomLeft} />
          <View style={styles.ticketCornerBottomRight} />

          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <View style={styles.balanceRow}>
            <Ticket size={36} color="#E8B23D" />
            <Text style={styles.balanceValue}>{balance}</Text>
            <Text style={styles.tokenUnit}>RCPT</Text>
          </View>

          <View style={styles.sinkBanner}>
            <TrendingDown size={14} color="#C4362E" />
            <Text style={styles.sinkText}>
              DEFLATIONARY SINK ACTIVE: Reader pays 5, poster gets 3, platform burns 2 tokens.
            </Text>
          </View>
        </View>

        {/* Purchase Packages */}
        <Text style={styles.sectionTitle}>ACQUIRE RECEIPTS</Text>
        <View style={styles.packagesContainer}>
          {[
            { amount: 10, price: '$1.99', desc: 'LURKER BUNDLE' },
            { amount: 25, price: '$3.99', desc: 'INVESTIGATOR PACK' },
            { amount: 60, price: '$7.99', desc: 'CHAOS MAKER SPEC' },
          ].map((pkg, idx) => (
            <Pressable
              key={idx}
              style={styles.packageCard}
              onPress={() => handleBuyTokens(pkg.amount)}
            >
              <View style={styles.packageHeader}>
                <Ticket size={18} color="#E8B23D" />
                <Text style={styles.packageAmount}>+{pkg.amount}</Text>
              </View>
              <Text style={styles.packageDesc}>{pkg.desc}</Text>
              <View style={styles.buyBtn}>
                <Text style={styles.buyBtnText}>{pkg.price}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Transaction History Ledger */}
        <Text style={styles.sectionTitle}>TRANSACTION LEDGER</Text>
        {ledger.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No transaction records found.</Text>
          </View>
        ) : (
          <View style={styles.ledgerList}>
            {ledger.map((item) => (
              <View key={item.id} style={styles.ledgerItem}>
                <View style={[
                  styles.ledgerIcon,
                  item.type === 'spend' ? styles.spendIcon : styles.earnIcon
                ]}>
                  {item.type === 'spend' ? (
                    <ArrowUpRight size={16} color="#C4362E" />
                  ) : (
                    <ArrowDownLeft size={16} color="#2E7D6B" />
                  )}
                </View>
                <View style={styles.ledgerDetails}>
                  <Text style={styles.ledgerLabel}>{item.label}</Text>
                  <Text style={styles.ledgerTime}>{item.timestamp}</Text>
                </View>
                <Text style={[
                  styles.ledgerAmount,
                  item.type === 'spend' ? styles.spendAmountText : styles.earnAmountText
                ]}>
                  {item.type === 'spend' ? '-' : '+'}{item.amount}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 80,
    width: '100%',
    flexGrow: 1,
  },
  header: { marginBottom: Spacing.three },
  title: {
    fontFamily: 'Outfit', fontSize: 26, fontWeight: '900',
    color: '#1A1A2E', letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#FF3B5C',
    fontWeight: 'bold', letterSpacing: 1, marginTop: 2,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: Spacing.four,
    marginBottom: Spacing.four,
    position: 'relative',
    overflow: 'hidden',
  },
  ticketCornerTopLeft: {
    position: 'absolute', top: -12, left: -12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'transparent',
  },
  ticketCornerTopRight: {
    position: 'absolute', top: -12, right: -12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'transparent',
  },
  ticketCornerBottomLeft: {
    position: 'absolute', bottom: -12, left: -12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'transparent',
  },
  ticketCornerBottomRight: {
    position: 'absolute', bottom: -12, right: -12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'transparent',
  },
  balanceLabel: {
    fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'rgba(26,26,46,0.55)',
    fontWeight: 'bold', letterSpacing: 2, textAlign: 'center', marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginVertical: 12,
  },
  balanceValue: {
    fontFamily: 'IBM Plex Mono', fontSize: 52, fontWeight: '900', color: '#1A1A2E',
  },
  tokenUnit: {
    fontFamily: 'Outfit', fontSize: 18, color: '#1A1A2E',
    fontWeight: '900', transform: [{ translateY: 10 }],
  },
  sinkBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1, borderColor: '#EAEAEA',
    borderStyle: 'dashed', padding: 10, marginTop: Spacing.two, borderRadius: 8, gap: 8,
  },
  sinkText: {
    fontFamily: 'Inter', fontSize: 10, color: '#1A1A1A', flex: 1, lineHeight: 14, fontWeight: '600',
  },
  sectionTitle: {
    fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'rgba(26,26,46,0.6)',
    fontWeight: 'bold', marginBottom: 10, marginTop: Spacing.four, letterSpacing: 2,
  },

  packagesContainer: {
    flexDirection: 'row', gap: 12, marginBottom: Spacing.three,
  },
  packageCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 14,
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 120,
  },
  packageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  packageAmount: {
    fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 'bold', color: '#1A1A2E',
  },
  packageDesc: {
    fontFamily: 'IBM Plex Mono', fontSize: 8, color: '#8A8A8A',
    fontWeight: 'bold', textAlign: 'center', marginVertical: 8, letterSpacing: 1,
  },
  buyBtn: {
    backgroundColor: '#FF3B5C', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8,
  },
  buyBtnText: {
    fontFamily: 'Outfit', fontSize: 11, fontWeight: '800', color: '#FFFFFF',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#EAEAEA',
    padding: Spacing.four, borderRadius: 12, alignItems: 'center',
  },
  emptyText: { fontFamily: 'Inter', fontSize: 12, color: '#8A8A8A' },
  ledgerList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#EAEAEA',
    borderRadius: 12, overflow: 'hidden',
  },
  ledgerItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.three,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  ledgerIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  spendIcon: { backgroundColor: '#F5F5F5' },
  earnIcon:  { backgroundColor: '#F5F5F5' },
  ledgerDetails: { flex: 1 },
  ledgerLabel: { fontFamily: 'Inter', fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  ledgerTime:  { fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#8A8A8A', marginTop: 2 },
  ledgerAmount: { fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 'bold' },
  spendAmountText: { color: '#1A1A1A' },
  earnAmountText:  { color: '#1A1A1A' },
});
