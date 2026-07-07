import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, ArrowUpRight, ArrowDownLeft, Flame, Info, TrendingDown } from 'lucide-react-native';

import { Spacing } from '@/constants/theme';
import { supabase, getCurrentUserProfile } from '@/lib/supabase';

const T = {
  brand: '#FF3B5C',
  bg: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#8A8A8A',
  surface: '#F5F5F5',
  border: '#EAEAEA',
  success: '#30D158',
};

interface LedgerItem {
  id: string;
  type: 'spend' | 'earn' | 'purchase';
  amount: number;
  label: string;
  timestamp: string;
}

export default function WalletScreen() {
  const [balance, setBalance] = useState(10);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const loadWalletData = async () => {
    const me = await getCurrentUserProfile();
    if (me) {
      setBalance(me.token_balance);

      const { data: unlocksData } = await supabase.from('unlocks').select('*').eq('unlocker_id', me.id);
      const { data: postsData } = await supabase.from('posts').select('*');
      
      const unlocks = unlocksData || [];
      const posts = postsData || [];

      let newLedger: LedgerItem[] = [];

      for (const u of unlocks) {
        const post = posts.find(p => p.id === u.post_id);
        if (post) {
          const { data: authorUser } = await supabase.from('users').select('alias').eq('id', post.author_id).single();
          newLedger.push({
            id: u.id,
            type: 'spend',
            amount: post.unlock_price,
            label: `Unlocked intel from @${authorUser?.alias || 'Unknown'}`,
            timestamp: new Date(u.created_at).toLocaleDateString(),
          });
        }
      }

      const myPosts = posts.filter(p => p.author_id === me.id);
      for (const p of myPosts) {
        const { data: myUnlocks } = await supabase.from('unlocks').select('*').eq('post_id', p.id);
        if (myUnlocks && myUnlocks.length > 0) {
          myUnlocks.forEach(u => {
            newLedger.push({
              id: `earned-${u.id}`,
              type: 'earn',
              amount: Math.floor(p.unlock_price * 3 / 5),
              label: `Payout for spill ID ${p.id.substring(0, 8)}`,
              timestamp: new Date(u.created_at).toLocaleDateString(),
            });
          });
        }
      }

      newLedger.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLedger(newLedger);
    }
  };

  useEffect(() => {
    loadWalletData();
    const interval = setInterval(loadWalletData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBuyTokens = async (amount: number, desc: string) => {
    const me = await getCurrentUserProfile();
    if (me) {
      const newBalance = me.token_balance + amount;
      await supabase.from('users').update({ token_balance: newBalance }).eq('id', me.id);
      loadWalletData();
      alert(`Successfully acquired ${amount} tokens (${desc}).`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>BALANCE & TRANSACTION SINK</Text>
          <Text style={styles.title}>Token Wallet</Text>
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
            <Text style={styles.tokenUnit}>TK</Text>
          </View>

          <View style={styles.sinkBanner}>
            <TrendingDown size={14} color="#FF3B5C" style={{ marginRight: 6 }} />
            <Text style={styles.sinkText}>
              DEFLATIONARY SINK: Reader pays unlock cost, author receives 60% reward, remainder burned.
            </Text>
          </View>
        </View>

        {/* Acquire Tokens packages */}
        <Text style={styles.sectionTitle}>ACQUIRE TOKENS</Text>
        <View style={[styles.packagesContainer, isMobile && { flexDirection: 'column' }]}>
          {[
            { amount: 10, price: '$1.99', desc: 'LURKER BUNDLE' },
            { amount: 25, price: '$3.99', desc: 'INVESTIGATOR PACK' },
            { amount: 60, price: '$7.99', desc: 'GOSSIP MAKER SPEC' },
          ].map((pkg, idx) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [
                styles.packageCard,
                pressed && styles.pressed,
              ]}
              onPress={() => handleBuyTokens(pkg.amount)}
              id={`btn-buy-package-${pkg.amount}`}
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
                    <ArrowUpRight size={16} color="#FF3B5C" />
                  ) : (
                    <ArrowDownLeft size={16} color="#30D158" />
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
  container: { flex: 1, backgroundColor: T.bg },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 80,
  },
  header: {
    marginBottom: Spacing.four,
  },
  title: {
    fontFamily: 'Outfit',
    fontSize: 24,
    fontWeight: '900',
    color: T.text,
  },
  subtitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: T.brand,
    fontWeight: '700',
    letterSpacing: 2,
  },
  balanceCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: Spacing.five,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: Spacing.five,
  },
  ticketCornerTopLeft: {
    position: 'absolute',
    top: -12,
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  ticketCornerTopRight: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  ticketCornerBottomLeft: {
    position: 'absolute',
    bottom: -12,
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  ticketCornerBottomRight: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  balanceLabel: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 2,
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.four,
  },
  balanceValue: {
    fontFamily: 'Outfit',
    fontSize: 44,
    fontWeight: '900',
    color: T.text,
    lineHeight: 50,
  },
  tokenUnit: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '800',
    color: '#E8B23D',
    marginTop: 14,
  },
  sinkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
    padding: Spacing.three,
    borderRadius: 10,
  },
  sinkText: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#FF3B5C',
    flex: 1,
    lineHeight: 16,
  },
  sectionTitle: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    fontWeight: '700',
    color: T.brand,
    letterSpacing: 1.5,
    marginBottom: Spacing.three,
  },
  packagesContainer: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  packageCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'center',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  packageAmount: {
    fontFamily: 'Outfit',
    fontSize: 16,
    fontWeight: '900',
    color: T.text,
  },
  packageDesc: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: T.muted,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: T.brand,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  buyBtnText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ledgerList: {
    gap: Spacing.two,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: Spacing.three,
  },
  ledgerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  spendIcon: {
    backgroundColor: 'rgba(255, 59, 92, 0.05)',
  },
  earnIcon: {
    backgroundColor: 'rgba(48, 209, 88, 0.05)',
  },
  ledgerDetails: {
    flex: 1,
  },
  ledgerLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
    color: T.text,
  },
  ledgerTime: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: T.muted,
    marginTop: 2,
  },
  ledgerAmount: {
    fontFamily: 'Outfit',
    fontSize: 15,
    fontWeight: '800',
  },
  spendAmountText: {
    color: '#FF3B5C',
  },
  earnAmountText: {
    color: '#30D158',
  },
  emptyCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: Spacing.five,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: T.muted,
  },
  pressed: {
    opacity: 0.85,
  },
});
