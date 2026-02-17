import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Alert,
  NativeModules,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from 'react-native';
import ScreenTimeTest from './ScreenTimeTest';
import OverrideFlow from './OverrideFlow';
import { blockingService, type BlockType, type BlockMode, type BlockingSettings, type BlockState, type ScheduleConfig, type PerModeCooldown } from './BlockingService';
import { loadDashboardData, addOrder as addOrderToDb, deleteOrder as deleteOrderFromDb, updateBudget, updateBlockingSettings, updateProfile, type Order as DbOrder } from './DataService';

const COLORS = {
  ink: '#1A1A2E',
  muted: '#8E8E93',
  cream: '#FAF8F5',
  warmGray: '#F2EFEB',
  coral: '#E8734A',
  sage: '#7BAE7F',
  gold: '#D4A853',
  white: '#FFFFFF',
  border: '#E6E1DB',
};

// Per-mode theme palettes
const MODE_THEMES: Record<BlockMode, {
  bg: string; cardBg: string; accent: string; accentSoft: string;
  text: string; muted: string; border: string; tabBg: string;
  selectorActive: string; selectorText: string;
}> = {
  gentle: {
    bg: '#1A1028',
    cardBg: '#251838',
    accent: '#E85454',
    accentSoft: '#3D1F2E',
    text: '#FFFFFF',
    muted: '#9B8AAE',
    border: '#3A2850',
    tabBg: '#1E1430',
    selectorActive: '#E85454',
    selectorText: '#FFFFFF',
  },
  moderate: {
    bg: '#0F1B3D',
    cardBg: '#162450',
    accent: '#4A90D9',
    accentSoft: '#1A2E5C',
    text: '#FFFFFF',
    muted: '#7B8DB5',
    border: '#233566',
    tabBg: '#0D1733',
    selectorActive: '#4A90D9',
    selectorText: '#FFFFFF',
  },
  precautionary: {
    bg: '#E8F4FD',
    cardBg: '#FFFFFF',
    accent: '#2BA5D6',
    accentSoft: '#D0ECFA',
    text: '#1A1A2E',
    muted: '#6B8FA8',
    border: '#B8DDF0',
    tabBg: '#D5EEFA',
    selectorActive: '#2BA5D6',
    selectorText: '#FFFFFF',
  },
};

const MODE_LABELS: Record<BlockMode, { label: string; emoji: string; desc: string }> = {
  gentle: { label: 'Gentle', emoji: '🔥', desc: 'Blocks when over budget. Hard to override.' },
  moderate: { label: 'Moderate', emoji: '🛡️', desc: 'Blocks when over budget. Easier override.' },
  precautionary: { label: 'Precaution', emoji: '❄️', desc: 'Blocks even under budget. Quick friction.' },
};

type TabKey = 'home' | 'orders' | 'reports' | 'bridge' | 'settings';
type SheetKey = 'budget' | 'blocker' | 'opportunity' | 'reminders' | null;

type MainDashboardProps = {
  email: string | null;
  pendingOverride?: boolean;
  onOverrideHandled?: () => void;
  onSignOut: () => void;
  onReturnToWelcome?: () => void;
};

type Order = {
  id: string;
  vendor: string;
  amount: number;
  ordered_at: string;
};

type Goal = {
  id: string;
  title: string;
  target: number;
  unit: string;
};

const GOALS: Goal[] = [
  { id: 'goal-1', title: 'Weekend trip fund', target: 320, unit: '$' },
  { id: 'goal-2', title: 'Student loan payment', target: 180, unit: '$' },
  { id: 'goal-3', title: 'Fitness plan month', target: 70, unit: '$' },
];

export default function MainDashboard({
  email,
  pendingOverride,
  onOverrideHandled,
  onSignOut,
  onReturnToWelcome,
}: MainDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
  const [showScreenTimeTest, setShowScreenTimeTest] = useState(false);
  const [showOverrideFlow, setShowOverrideFlow] = useState(false);
  const [blockSettings, setBlockSettings] = useState<BlockingSettings>(blockingService.getSettings());
  const [blockState, setBlockState] = useState<BlockState>(blockingService.getState());
  const [userName, setUserName] = useState('');
  const [weeklyBudget, setWeeklyBudget] = useState(120);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newOrderVendor, setNewOrderVendor] = useState('');
  const [newOrderAmount, setNewOrderAmount] = useState('');
  const [budgetReminders, setBudgetReminders] = useState(true);
  const [cookingIdeas, setCookingIdeas] = useState(true);
  const [opportunityAmount, setOpportunityAmount] = useState('22');

  useEffect(() => {
    setActiveTab('home');
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setActiveTab('home');
      }
    });
    return () => subscription.remove();
  }, []);

  const formatOrderDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const totalSpend = useMemo(
    () => orders.reduce((sum, order) => sum + order.amount, 0),
    [orders],
  );
  const remaining = Math.max(weeklyBudget - totalSpend, 0);
  const budgetProgress = Math.min(totalSpend / weeklyBudget, 1);

  // ── Initialize BlockingService + load Supabase data on mount ──
  useEffect(() => {
    const init = async () => {
      // Load blocking service
      await blockingService.initialize();
      setBlockSettings(blockingService.getSettings());
      setBlockState(blockingService.getState());

      // Load all per-account data from Supabase
      try {
        const data = await loadDashboardData();
        if (data.profile?.name) setUserName(data.profile.name);
        if (data.budget) setWeeklyBudget(data.budget.weekly_limit);
        if (data.orders.length > 0) {
          setOrders(data.orders.map((o) => ({
            id: o.id,
            vendor: o.vendor,
            amount: o.amount,
            ordered_at: o.ordered_at,
          })));
        }
        if (data.blockingSettings) {
          await blockingService.updateSettings({
            enabled: data.blockingSettings.enabled,
            mode: data.blockingSettings.mode,
            superStrict: data.blockingSettings.super_strict,
            cooldowns: {
              gentle: data.blockingSettings.cooldown_gentle,
              moderate: data.blockingSettings.cooldown_moderate,
              precautionary: data.blockingSettings.cooldown_precautionary,
            },
            penaltyEnabled: data.blockingSettings.penalty_enabled,
            penaltyAmount: data.blockingSettings.penalty_amount,
            selectedAppCount: data.blockingSettings.selected_app_count,
          });
          setBlockSettings(blockingService.getSettings());
        }
      } catch (e) {
        console.warn('Failed to load dashboard data:', e);
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, []);

  // ── Auto-open override flow when deep link arrives ──
  useEffect(() => {
    if (pendingOverride && blockState.isShieldActive) {
      setShowOverrideFlow(true);
      onOverrideHandled?.();
    } else if (pendingOverride) {
      onOverrideHandled?.();
    }
  }, [pendingOverride, blockState.isShieldActive, onOverrideHandled]);

  // ── Auto-evaluate blocks when spend or budget changes ──
  useEffect(() => {
    if (blockSettings.selectedAppCount === 0) return;
    blockingService.evaluateBlock(totalSpend, weeklyBudget).then(() => {
      setBlockSettings(blockingService.getSettings());
      setBlockState(blockingService.getState());
    });
  }, [totalSpend, weeklyBudget, blockSettings.selectedAppCount, blockSettings.mode]);

  const refreshBlockState = useCallback(() => {
    const s = blockingService.getSettings();
    setBlockSettings(s);
    setBlockState(blockingService.getState());
    // Sync to Supabase in background
    void updateBlockingSettings({
      enabled: s.enabled,
      mode: s.mode,
      super_strict: s.superStrict,
      cooldown_gentle: s.cooldowns.gentle,
      cooldown_moderate: s.cooldowns.moderate,
      cooldown_precautionary: s.cooldowns.precautionary,
      penalty_enabled: s.penaltyEnabled,
      penalty_amount: s.penaltyAmount,
      selected_app_count: s.selectedAppCount,
      schedule_enabled: s.schedule.enabled,
      schedule_start_hour: s.schedule.startHour,
      schedule_start_min: s.schedule.startMinute,
      schedule_end_hour: s.schedule.endHour,
      schedule_end_min: s.schedule.endMinute,
    });
  }, []);

  const handleSelectApps = useCallback(async () => {
    try {
      await NativeModules.ScreenTimeManager.requestAuthorization();
      const result = await blockingService.selectApps();
      if (!result.cancelled) {
        refreshBlockState();
        Alert.alert('Apps selected', `${result.count} app(s)/categories selected for blocking.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to select apps.');
    }
  }, [refreshBlockState]);

  const handleSetMode = useCallback(async (mode: BlockMode) => {
    await blockingService.updateSettings({ mode });
    await blockingService.evaluateBlock(totalSpend, weeklyBudget);
    refreshBlockState();
  }, [totalSpend, weeklyBudget, refreshBlockState]);

  const handleToggleSuperStrict = useCallback(async (value: boolean) => {
    await blockingService.updateSettings({ superStrict: value });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleTogglePenalty = useCallback(async (value: boolean) => {
    await blockingService.updateSettings({ penaltyEnabled: value });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleSetCooldown = useCallback(async (mode: BlockMode, value: string) => {
    const mins = Math.max(0, Number.parseInt(value || '0', 10));
    await blockingService.updateSettings({ cooldowns: { [mode]: mins } as any });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleSetPenaltyAmount = useCallback(async (value: string) => {
    const amount = Math.max(1, Number.parseInt(value || '5', 10));
    await blockingService.updateSettings({ penaltyAmount: amount });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleToggleSchedule = useCallback(async (value: boolean) => {
    await blockingService.setSchedule({ enabled: value });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleSetScheduleTime = useCallback(async (field: 'startHour' | 'startMinute' | 'endHour' | 'endMinute', value: string) => {
    const num = Number.parseInt(value || '0', 10);
    const clamped = field.includes('Hour') ? Math.min(23, Math.max(0, num)) : Math.min(59, Math.max(0, num));
    await blockingService.setSchedule({ [field]: clamped });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleDeleteOrder = async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    void deleteOrderFromDb(orderId);
  };

  const handleAddOrder = async () => {
    const amount = Number.parseFloat(newOrderAmount);
    if (!newOrderVendor.trim() || Number.isNaN(amount)) return;
    const saved = await addOrderToDb({ vendor: newOrderVendor.trim(), amount });
    if (saved) {
      setOrders((prev) => [{ id: saved.id, vendor: saved.vendor, amount: saved.amount, ordered_at: saved.ordered_at }, ...prev]);
    } else {
      // Fallback to local-only if save fails
      setOrders((prev) => [{ id: `${Date.now()}`, vendor: newOrderVendor.trim(), amount, ordered_at: new Date().toISOString() }, ...prev]);
    }
    setNewOrderVendor('');
    setNewOrderAmount('');
  };

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable onPress={() => setActiveSheet('reminders')} style={styles.headerChip}>
        <Text style={styles.headerChipText}>Reminders</Text>
      </Pressable>
    </View>
  );

  const theme = MODE_THEMES[blockSettings.mode];
  const overBudget = totalSpend >= weeklyBudget;

  // Under-budget recommendation: if not on precautionary, suggest it
  const showPrecauRecommendation = !overBudget && blockSettings.mode !== 'precautionary';
  // Over-budget: precautionary is locked
  const precauLocked = overBudget;
  const homePalette = {
    bg: '#FFFFFF',
    panel: '#11141B',
    panelSoft: '#1A1E28',
    text: '#F6F8FF',
    muted: '#8E96AC',
    orange: '#FF4D2D',
    blue: '#4A69FF',
    white: '#F3F4F8',
  };
  const modeAccent: Record<BlockMode, string> = {
    gentle: homePalette.orange,
    moderate: homePalette.blue,
    precautionary: homePalette.white,
  };
  const activeModeAccent = modeAccent[blockSettings.mode];
  const homeActionColor = blockSettings.mode === 'precautionary' ? '#1F3E8A' : activeModeAccent;

  const openModeSwitchOptions = () => {
    const availableModes = (['moderate', 'precautionary'] as BlockMode[])
      .filter((m) => !(m === 'precautionary' && precauLocked))
      .filter((m) => m !== blockSettings.mode);

    const actions = [
      ...availableModes.map((m) => ({
        text: `Switch to ${MODE_LABELS[m].label}`,
        onPress: () => {
          void handleSetMode(m);
        },
      })),
      ...(blockSettings.mode !== 'gentle'
        ? [{
            text: `Switch to ${MODE_LABELS.gentle.label}`,
            onPress: () => {
              void handleSetMode('gentle');
            },
          }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert('Switch blocking mode', 'Choose a mode to use next.', actions);
  };

  const renderModeSelector = () => {
    const modeLabel = MODE_LABELS[blockSettings.mode].label;
    const cooldown = blockSettings.cooldowns[blockSettings.mode];
    const cardBg = blockSettings.mode === 'precautionary' ? '#EEF1FF' : '#A795F7';
    const cardText = '#121524';
    const cardSubText = '#2D3348';

    return (
      <Pressable
        onLongPress={openModeSwitchOptions}
        delayLongPress={280}
        style={{
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 22,
          backgroundColor: cardBg,
          marginBottom: 14,
        }}
      >
        <Text style={{ color: cardSubText, fontSize: 13, fontWeight: '700' }}>Current mode</Text>
        <Text style={{ color: cardText, fontSize: 39, lineHeight: 44, fontWeight: '900', marginTop: 6 }}>
          {modeLabel}
        </Text>
        <Text style={{ color: cardSubText, fontSize: 15, fontWeight: '600', marginTop: 8 }}>
          Cooldown: {cooldown} min
        </Text>
        <Text style={{ color: cardSubText, fontSize: 13, marginTop: 4 }}>
          Hold to switch mode
        </Text>
      </Pressable>
    );
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: homePalette.bg, paddingTop: 14 }]}> 
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#151925', lineHeight: 34 }}>
            Hi {userName || 'there'}
          </Text>
        </View>

        <Pressable
          onPress={() => setActiveTab('settings')}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: '#4A69FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
            {(userName?.trim()?.[0] ?? 'U').toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {renderModeSelector()}

      <Text style={{ color: '#79819A', fontSize: 13, marginBottom: 14, textAlign: 'center' }}>
        {MODE_LABELS[blockSettings.mode].desc}
      </Text>

      {blockState.autoShiftedFromPrecau && (
        <View style={{ backgroundColor: '#321710', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: homePalette.orange }}>
          <Text style={{ color: '#FF876E', fontWeight: '800', fontSize: 14, textAlign: 'center' }}>
            Over budget — auto-shifted to Gentle mode
          </Text>
        </View>
      )}

      {showPrecauRecommendation && (
        <Pressable
          onPress={() => handleSetMode('precautionary')}
          style={{ backgroundColor: '#131A2B', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#264A8F' }}
        >
          <Text style={{ color: '#8CB3FF', fontWeight: '800', fontSize: 13 }}>
            💡 You're under budget — switch to Precautionary for extra protection
          </Text>
          <Text style={{ color: homePalette.muted, fontSize: 12, marginTop: 4 }}>
            Current mode ({MODE_LABELS[blockSettings.mode].label}) only activates when you go over budget.
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleSelectApps}
        style={{
          backgroundColor: activeModeAccent,
          borderRadius: 22,
          padding: 18,
          borderWidth: 1,
          borderColor: activeModeAccent,
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            color: blockSettings.mode === 'precautionary' ? '#252834' : '#FFD8D1',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: '700',
          }}
        >
          Shielded apps
        </Text>
        <Text style={{
          color: blockSettings.mode === 'precautionary' ? '#16171F' : '#FFFFFF',
          fontWeight: '800',
          fontSize: 24,
          marginTop: 8,
        }}>
          {blockSettings.selectedAppCount > 0
            ? `${blockSettings.selectedAppCount} app(s) selected`
            : 'No apps selected'}
        </Text>
        <Text
          style={{
            color: blockSettings.mode === 'precautionary' ? '#2A2E3D' : '#FFE4DE',
            fontWeight: '700',
            marginTop: 8,
            fontSize: 13,
          }}
        >
          {blockSettings.selectedAppCount > 0 ? 'Tap to change' : 'Tap to select delivery apps'}
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: homePalette.white, borderRadius: 22, padding: 16 }}>
          <Text style={{ color: '#535A70', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}>
            Weekly spend
          </Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#11131A', marginTop: 6 }}>${totalSpend.toFixed(0)}</Text>
          <Text style={{ marginTop: 4, color: '#5F6577', fontSize: 12, fontWeight: '600' }}>of ${weeklyBudget} budget</Text>
          <View style={{ marginTop: 12, height: 8, borderRadius: 999, backgroundColor: '#DCE0ED' }}>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: homePalette.orange, width: `${budgetProgress * 100}%` }} />
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: homePalette.blue, borderRadius: 22, padding: 16 }}>
          <Text style={{ color: '#D7DEFF', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}>
            Remaining
          </Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', marginTop: 6 }}>${remaining.toFixed(0)}</Text>
          <Text style={{ marginTop: 4, color: '#D7DEFF', fontSize: 12, fontWeight: '600' }}>before lock threshold</Text>
        </View>
      </View>

      <View style={{ backgroundColor: homePalette.panel, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#242A38', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: homePalette.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}>Streak</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: homePalette.text, marginTop: 4 }}>3 days</Text>
          </View>
          <Text style={{ fontSize: 32 }}>🔥</Text>
        </View>
        {blockState.overridesThisWeek > 0 && (
          <Text style={{ color: activeModeAccent, fontWeight: '700', marginTop: 8, fontSize: 13 }}>
            {blockState.overridesThisWeek} override(s) this week
            {blockSettings.penaltyEnabled ? ` · $${blockState.penaltyAccumulated} guilt jar` : ''}
          </Text>
        )}
      </View>

      {blockState.isShieldActive && (
        <View style={{ backgroundColor: homePalette.panelSoft, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#2A3042' }}>
          <Text style={{ color: homePalette.text, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
            {blockState.activeBlockType === 'budget' ? '🔴 Over-budget block active' : '❄️ Precautionary block active'}
          </Text>
          <Pressable
            onPress={() => setShowOverrideFlow(true)}
            style={{ marginTop: 10, backgroundColor: activeModeAccent, paddingVertical: 11, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: blockSettings.mode === 'precautionary' ? '#171922' : '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
              Request override
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#151925' }}>Recent orders</Text>
        <Pressable onPress={() => setActiveTab('orders')}>
          <Text style={{ color: homeActionColor, fontWeight: '700', fontSize: 13 }}>View all</Text>
        </Pressable>
      </View>
      {orders.length === 0 && (
        <Text style={{ color: homePalette.muted, fontSize: 13, marginBottom: 12 }}>No orders yet. Add one in the Orders tab.</Text>
      )}
      {orders.slice(0, 3).map((order) => (
        <View
          key={order.id}
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: homePalette.panel,
            borderWidth: 1,
            borderColor: '#232837',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View>
            <Text style={{ fontWeight: '700', color: homePalette.text, fontSize: 15 }}>{order.vendor}</Text>
            <Text style={{ marginTop: 4, color: homePalette.muted, fontSize: 12 }}>{formatOrderDate(order.ordered_at)}</Text>
          </View>
          <Text style={{ fontWeight: '800', color: homePalette.orange, fontSize: 16 }}>-${order.amount.toFixed(2)}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderOrders = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {renderHeader('Orders & Spend', 'Track every delivery order')}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Quick add order</Text>
        <TextInput
          placeholder="Vendor"
          placeholderTextColor={COLORS.muted}
          value={newOrderVendor}
          onChangeText={setNewOrderVendor}
          style={styles.input}
        />
        <TextInput
          placeholder="$0.00"
          placeholderTextColor={COLORS.muted}
          value={newOrderAmount}
          onChangeText={setNewOrderAmount}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <Pressable style={styles.primaryButton} onPress={handleAddOrder}>
          <Text style={styles.primaryButtonText}>Add order</Text>
        </Pressable>
      </View>

      {orders.map((order) => (
        <Pressable
          key={order.id}
          style={styles.orderRow}
          onLongPress={() =>
            Alert.alert('Delete order?', `${order.vendor} — $${order.amount.toFixed(2)}`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => handleDeleteOrder(order.id) },
            ])
          }
        >
          <View>
            <Text style={styles.orderVendor}>{order.vendor}</Text>
            <Text style={styles.orderDate}>{formatOrderDate(order.ordered_at)}</Text>
          </View>
          <Text style={styles.orderAmount}>-${order.amount.toFixed(2)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const vendorBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const order of orders) {
      if (!map[order.vendor]) map[order.vendor] = { total: 0, count: 0 };
      map[order.vendor].total += order.amount;
      map[order.vendor].count += 1;
    }
    return Object.entries(map)
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [orders]);

  const avgOrderAmount = orders.length > 0 ? totalSpend / orders.length : 0;
  const moneySaved = Math.max(weeklyBudget - totalSpend, 0);
  const budgetUsedPercent = Math.round(budgetProgress * 100);

  const renderReports = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {renderHeader('Reports', 'Your weekly insights')}

      <View style={styles.reportSectionRow}>
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>Total spent</Text>
          <Text style={styles.reportValue}>${totalSpend.toFixed(2)}</Text>
          <Text style={styles.reportHint}>{budgetUsedPercent}% of budget</Text>
        </View>
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>Money saved</Text>
          <Text style={[styles.reportValue, { color: COLORS.sage }]}>${moneySaved.toFixed(2)}</Text>
          <Text style={styles.reportHint}>remaining this week</Text>
        </View>
      </View>

      <View style={styles.reportSectionRow}>
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>Orders</Text>
          <Text style={styles.reportValue}>{orders.length}</Text>
          <Text style={styles.reportHint}>avg ${avgOrderAmount.toFixed(2)} each</Text>
        </View>
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>Overrides</Text>
          <Text style={styles.reportValue}>{blockState.overridesThisWeek}</Text>
          <Text style={styles.reportHint}>
            {blockState.overridesThisWeek === 0 ? 'staying strong!' : 'this week'}
          </Text>
        </View>
      </View>

      {blockSettings.penaltyEnabled && blockState.penaltyAccumulated > 0 && (
        <View style={styles.reportCardWide}>
          <Text style={styles.reportTitle}>Guilt jar</Text>
          <Text style={[styles.reportValue, { color: COLORS.coral }]}>
            ${blockState.penaltyAccumulated.toFixed(2)}
          </Text>
          <Text style={styles.reportHint}>
            from {blockState.overridesThisWeek} override(s) at ${blockSettings.penaltyAmount} each
          </Text>
        </View>
      )}

      <View style={styles.reportCardWide}>
        <Text style={styles.reportTitle}>Block status</Text>
        <View style={styles.reportStatusRow}>
          <View style={[styles.reportStatusDot, {
            backgroundColor: blockState.isShieldActive ? '#D32F2F' : blockSettings.enabled ? COLORS.sage : COLORS.muted,
          }]} />
          <Text style={styles.reportStatusText}>
            {blockState.isShieldActive
              ? `${blockState.activeBlockType === 'budget' ? 'Over-budget' : 'Precautionary'} block active`
              : blockSettings.enabled
              ? 'Monitoring — under budget'
              : 'Not configured'}
          </Text>
        </View>
        <Text style={styles.reportHint}>
          {blockSettings.selectedAppCount} app(s) selected · {blockSettings.mode} mode
          {blockSettings.schedule.enabled
            ? ` · scheduled ${blockSettings.schedule.startHour}:${String(blockSettings.schedule.startMinute).padStart(2, '0')}–${blockSettings.schedule.endHour}:${String(blockSettings.schedule.endMinute).padStart(2, '0')}`
            : ''}
        </Text>
      </View>

      <View style={styles.reportCardWide}>
        <Text style={styles.reportTitle}>Budget progress</Text>
        <View style={styles.reportProgressTrack}>
          <View style={[
            styles.reportProgressFill,
            {
              width: `${budgetUsedPercent}%`,
              backgroundColor: budgetProgress >= 1 ? '#D32F2F' : budgetProgress >= 0.75 ? COLORS.coral : COLORS.sage,
            },
          ]} />
        </View>
        <Text style={styles.reportHint}>
          ${totalSpend.toFixed(2)} / ${weeklyBudget} ({budgetUsedPercent}%)
        </Text>
      </View>

      {vendorBreakdown.length > 0 && (
        <View style={styles.reportCardWide}>
          <Text style={styles.reportTitle}>Top vendors</Text>
          {vendorBreakdown.map((v) => (
            <View key={v.vendor} style={styles.vendorRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorName}>{v.vendor}</Text>
                <Text style={styles.vendorCount}>{v.count} order(s)</Text>
              </View>
              <Text style={styles.vendorTotal}>${v.total.toFixed(2)}</Text>
              <View style={styles.vendorBarTrack}>
                <View style={[styles.vendorBarFill, { width: `${(v.total / totalSpend) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );

  const renderBridge = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {renderHeader('Bridge Resources', 'Simple steps to cook more')}
      <Pressable style={styles.bridgeMiniButton} onPress={onReturnToWelcome}>
        <Text style={styles.bridgeMiniButtonText}>Welcome</Text>
      </Pressable>
      <View style={styles.bridgeCard}>
        <Text style={styles.bridgeTitle}>15-minute meal kit</Text>
        <Text style={styles.bridgeBody}>Pick 2 staples + a sauce. No recipe, just assemble.</Text>
      </View>
      <View style={styles.bridgeCard}>
        <Text style={styles.bridgeTitle}>Snack-to-dinner plan</Text>
        <Text style={styles.bridgeBody}>Make a quick protein + veggie and scale up later.</Text>
      </View>
      <View style={styles.bridgeCard}>
        <Text style={styles.bridgeTitle}>Emergency freezer list</Text>
        <Text style={styles.bridgeBody}>Stock 3 go-to frozen meals to skip delivery.</Text>
      </View>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {renderHeader('Settings', email ?? 'Signed in')}
      <Pressable style={styles.settingsRow} onPress={() => setActiveSheet('reminders')}>
        <Text style={styles.settingsText}>Reminders</Text>
        <Text style={styles.settingsValue}>Manage</Text>
      </Pressable>
      <Pressable style={styles.settingsRow} onPress={() => setActiveSheet('budget')}>
        <Text style={styles.settingsText}>Budget</Text>
        <Text style={styles.settingsValue}>${weeklyBudget} / week</Text>
      </Pressable>
      <Pressable style={styles.settingsRow} onPress={() => setActiveSheet('blocker')}>
        <Text style={styles.settingsText}>App blocker</Text>
        <Text style={styles.settingsValue}>
          {blockState.isShieldActive ? '🔴 Blocking' : blockSettings.enabled ? '🟢 Ready' : 'Off'}
        </Text>
      </Pressable>
      <Pressable style={styles.settingsRow} onPress={() => setShowScreenTimeTest(true)}>
        <Text style={styles.settingsText}>Screen Time Test</Text>
        <Text style={styles.settingsValue}>Dev →</Text>
      </Pressable>
      <Pressable style={styles.settingsRow} onPress={onSignOut}>
        <Text style={styles.settingsText}>Sign out</Text>
        <Text style={styles.settingsValue}>↗</Text>
      </Pressable>
    </ScrollView>
  );

  const renderSheet = () => {
    if (!activeSheet) return null;
    if (activeSheet === 'budget') {
      return (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Budget settings</Text>
            <Pressable onPress={() => setActiveSheet(null)}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetLabel}>Weekly budget</Text>
          <TextInput
            value={String(weeklyBudget)}
            onChangeText={(value) => {
              const num = Number.parseInt(value || '0', 10);
              setWeeklyBudget(num);
              void updateBudget({ weekly_limit: num });
            }}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.sheetHint}>Blocks trigger once you hit the limit.</Text>
        </View>
      );
    }
    if (activeSheet === 'blocker') {
      return (
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Blocker settings</Text>
            <Pressable onPress={() => setActiveSheet(null)}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryButton} onPress={handleSelectApps}>
            <Text style={styles.primaryButtonText}>
              {blockSettings.selectedAppCount > 0
                ? `Change apps (${blockSettings.selectedAppCount} selected)`
                : 'Select apps to block'}
            </Text>
          </Pressable>

          <View style={styles.scheduleDivider} />

          <Text style={styles.sheetLabel}>Cooldown per mode (minutes)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {(['gentle', 'moderate', 'precautionary'] as BlockMode[]).map((m) => (
              <View key={m} style={{ flex: 1 }}>
                <Text style={{ color: COLORS.muted, fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'capitalize' }}>
                  {MODE_LABELS[m].emoji} {MODE_LABELS[m].label}
                </Text>
                <TextInput
                  value={String(blockSettings.cooldowns[m])}
                  onChangeText={(v) => handleSetCooldown(m, v)}
                  keyboardType="number-pad"
                  style={[styles.input, { marginBottom: 0 }]}
                />
              </View>
            ))}
          </View>
          <Text style={styles.sheetHint}>
            How long the user must wait before overriding a block in each mode.
          </Text>

          <View style={styles.scheduleDivider} />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Super strict (Gentle mode)</Text>
            <Switch
              value={blockSettings.superStrict}
              onValueChange={handleToggleSuperStrict}
            />
          </View>
          <Text style={styles.sheetHint}>
            Triples the Gentle cooldown (min 60 min). Makes overriding extremely hard.
          </Text>

          <View style={styles.scheduleDivider} />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Guilt jar penalty</Text>
            <Switch
              value={blockSettings.penaltyEnabled}
              onValueChange={handleTogglePenalty}
            />
          </View>
          {blockSettings.penaltyEnabled && (
            <>
              <Text style={styles.sheetLabel}>Penalty per override ($)</Text>
              <TextInput
                value={String(blockSettings.penaltyAmount)}
                onChangeText={handleSetPenaltyAmount}
                keyboardType="number-pad"
                style={styles.input}
              />
              <Text style={styles.sheetHint}>
                Honor system — tracks how much you owe your guilt jar.
              </Text>
            </>
          )}

          <View style={styles.scheduleDivider} />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Scheduled blocking</Text>
            <Switch
              value={blockSettings.schedule.enabled}
              onValueChange={handleToggleSchedule}
            />
          </View>
          <Text style={styles.sheetHint}>
            Automatically block delivery apps during set hours every day.
          </Text>

          {blockSettings.schedule.enabled && (
            <View style={styles.scheduleTimeRow}>
              <View style={styles.scheduleTimeGroup}>
                <Text style={styles.scheduleTimeLabel}>From</Text>
                <View style={styles.scheduleInputRow}>
                  <TextInput
                    value={String(blockSettings.schedule.startHour)}
                    onChangeText={(v) => handleSetScheduleTime('startHour', v)}
                    keyboardType="number-pad"
                    style={styles.scheduleInput}
                    maxLength={2}
                    placeholder="HH"
                  />
                  <Text style={styles.scheduleColon}>:</Text>
                  <TextInput
                    value={String(blockSettings.schedule.startMinute).padStart(2, '0')}
                    onChangeText={(v) => handleSetScheduleTime('startMinute', v)}
                    keyboardType="number-pad"
                    style={styles.scheduleInput}
                    maxLength={2}
                    placeholder="MM"
                  />
                </View>
              </View>
              <View style={styles.scheduleTimeGroup}>
                <Text style={styles.scheduleTimeLabel}>To</Text>
                <View style={styles.scheduleInputRow}>
                  <TextInput
                    value={String(blockSettings.schedule.endHour)}
                    onChangeText={(v) => handleSetScheduleTime('endHour', v)}
                    keyboardType="number-pad"
                    style={styles.scheduleInput}
                    maxLength={2}
                    placeholder="HH"
                  />
                  <Text style={styles.scheduleColon}>:</Text>
                  <TextInput
                    value={String(blockSettings.schedule.endMinute).padStart(2, '0')}
                    onChangeText={(v) => handleSetScheduleTime('endMinute', v)}
                    keyboardType="number-pad"
                    style={styles.scheduleInput}
                    maxLength={2}
                    placeholder="MM"
                  />
                </View>
              </View>
            </View>
          )}

          {blockState.isShieldActive && (
            <View style={styles.blockStatusBanner}>
              <Text style={styles.blockStatusText}>
                {blockState.activeBlockType === 'budget' ? '🔴 Over-budget' : '❄️ Precautionary'} block is active
              </Text>
            </View>
          )}
        </ScrollView>
      );
    }
    if (activeSheet === 'opportunity') {
      return (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Opportunity cost</Text>
            <Pressable onPress={() => setActiveSheet(null)}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetLabel}>Order amount</Text>
          <TextInput
            value={opportunityAmount}
            onChangeText={setOpportunityAmount}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          {GOALS.map((goal) => {
            const amount = Number.parseFloat(opportunityAmount) || 0;
            const ratio = Math.min(amount / goal.target, 1);
            return (
              <View key={goal.id} style={styles.goalRow}>
                <View>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Text style={styles.goalHint}>
                    {goal.unit}{amount.toFixed(0)} / {goal.unit}{goal.target}
                  </Text>
                </View>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${ratio * 100}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    return (
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Reminders</Text>
          <Pressable onPress={() => setActiveSheet(null)}>
            <Text style={styles.sheetClose}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Daily budget reminders</Text>
          <Switch value={budgetReminders} onValueChange={setBudgetReminders} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Cooking ideas before meals</Text>
          <Switch value={cookingIdeas} onValueChange={setCookingIdeas} />
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHome();
      case 'orders':
        return renderOrders();
      case 'reports':
        return renderReports();
      case 'bridge':
        return renderBridge();
      case 'settings':
        return renderSettings();
      default:
        return renderHome();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.muted, fontSize: 16 }}>Loading your data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showOverrideFlow && blockState.isShieldActive) {
    return (
      <OverrideFlow
        blockType={blockState.activeBlockType}
        mode={blockSettings.mode}
        cooldownMinutes={blockingService.getEffectiveCooldown()}
        penaltyAmount={blockSettings.penaltyEnabled ? blockSettings.penaltyAmount : null}
        totalSpend={totalSpend}
        weeklyBudget={weeklyBudget}
        onComplete={() => {
          setShowOverrideFlow(false);
          refreshBlockState();
        }}
        onCancel={() => setShowOverrideFlow(false)}
      />
    );
  }

  if (showScreenTimeTest) {
    return <ScreenTimeTest onBack={() => setShowScreenTimeTest(false)} />;
  }

  const isHomeTab = activeTab === 'home';
  const containerBg = isHomeTab ? '#FFFFFF' : COLORS.cream;
  const tabBarBg = isHomeTab ? '#FFFFFF' : COLORS.white;
  const tabBarBorder = isHomeTab ? '#E4E8F1' : COLORS.border;
  const tabTextColor = isHomeTab ? '#8E96AC' : COLORS.muted;
  const tabActiveTextColor = isHomeTab ? '#151925' : COLORS.ink;
  const tabActiveBg = isHomeTab ? '#F1F3F8' : COLORS.cream;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: containerBg }]}>
      {renderContent()}
      {renderSheet()}
      <View style={[styles.tabBar, { backgroundColor: tabBarBg, borderColor: tabBarBorder }]}>
        {([
          { key: 'home', label: 'Home' },
          { key: 'orders', label: 'Orders' },
          { key: 'reports', label: 'Reports' },
          { key: 'bridge', label: 'Bridge' },
          { key: 'settings', label: 'Settings' },
        ] as { key: TabKey; label: string }[]).map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabItem, activeTab === tab.key && { backgroundColor: tabActiveBg }]}
          >
            <Text style={[styles.tabText, { color: tabTextColor }, activeTab === tab.key && { color: tabActiveTextColor }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
  },
  headerSubtitle: {
    marginTop: 4,
    color: COLORS.muted,
  },
  headerChip: {
    borderRadius: 999,
    backgroundColor: COLORS.warmGray,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerChipText: {
    color: COLORS.ink,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
    marginTop: 8,
  },
  summaryHint: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 12,
  },
  summaryBadge: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.coral,
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.warmGray,
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.coral,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  ctaCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ctaTitle: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  ctaBody: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  sectionLink: {
    color: COLORS.coral,
    fontWeight: '600',
  },
  orderRow: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderVendor: {
    fontWeight: '600',
    color: COLORS.ink,
  },
  orderDate: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
  },
  orderAmount: {
    fontWeight: '700',
    color: COLORS.coral,
  },
  blockCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  blockTitle: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  blockBody: {
    marginTop: 6,
    color: COLORS.muted,
  },
  blockHint: {
    marginTop: 10,
    color: COLORS.sage,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.ink,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  reportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 14,
  },
  reportTitle: {
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  reportValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
  },
  reportHint: {
    marginTop: 6,
    color: COLORS.sage,
    fontWeight: '600',
  },
  bridgeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 14,
  },
  bridgeMiniButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  bridgeMiniButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  bridgeTitle: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  bridgeBody: {
    marginTop: 6,
    color: COLORS.muted,
    lineHeight: 20,
  },
  settingsRow: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingsText: {
    fontWeight: '600',
    color: COLORS.ink,
  },
  settingsValue: {
    color: COLORS.muted,
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.ink,
  },
  sheetClose: {
    color: COLORS.coral,
    fontWeight: '600',
  },
  sheetLabel: {
    color: COLORS.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  sheetHint: {
    color: COLORS.muted,
    fontSize: 12,
  },
  blockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  blockRowText: {
    color: COLORS.ink,
    fontWeight: '600',
  },
  blockRowBadge: {
    color: COLORS.coral,
    fontWeight: '700',
  },
  goalRow: {
    marginBottom: 12,
  },
  goalTitle: {
    fontWeight: '600',
    color: COLORS.ink,
  },
  goalHint: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
  },
  goalTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.warmGray,
  },
  goalFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.gold,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    color: COLORS.ink,
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
  },
  tabItemActive: {
    backgroundColor: COLORS.cream,
  },
  tabText: {
    color: COLORS.muted,
    fontWeight: '600',
    fontSize: 12,
  },
  tabTextActive: {
    color: COLORS.ink,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  modeButtonActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  modeButtonText: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  modeButtonTextActive: {
    color: COLORS.white,
  },
  blockStatusBanner: {
    marginTop: 16,
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  blockStatusText: {
    fontWeight: '700',
    color: '#D32F2F',
    fontSize: 15,
  },
  overrideTriggerButton: {
    marginTop: 12,
    backgroundColor: '#FFF0F0',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  overrideTriggerText: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: 14,
  },
  scheduleDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  scheduleTimeRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  scheduleTimeGroup: {
    flex: 1,
  },
  scheduleTimeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scheduleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    width: 52,
    textAlign: 'center',
  },
  scheduleColon: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
    marginHorizontal: 4,
  },
  reportSectionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  reportCardWide: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 12,
  },
  reportStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  reportStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  reportStatusText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  reportProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.warmGray,
    marginTop: 10,
    marginBottom: 8,
  },
  reportProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  vendorCount: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  vendorTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginRight: 12,
  },
  vendorBarTrack: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warmGray,
  },
  vendorBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },
  historySectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  historySectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
  },
  historySectionHint: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 14,
    lineHeight: 18,
  },
  historyButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  historyClearButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD0D0',
    backgroundColor: '#FFF5F5',
  },
  historyClearText: {
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 14,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  monthLabel: {
    width: 65,
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
  },
  monthBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.warmGray,
    marginHorizontal: 8,
  },
  monthBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.sage,
  },
  monthTotal: {
    width: 50,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'right',
  },
  shareButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C47FF',
    backgroundColor: '#F8F6FF',
  },
  shareButtonText: {
    color: '#6C47FF',
    fontWeight: '700',
    fontSize: 14,
  },
  aiButton: {
    flex: 1,
    backgroundColor: '#6C47FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  aiButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  aiInsightsCard: {
    backgroundColor: '#F8F6FF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0D8FF',
    padding: 18,
    marginTop: 12,
    marginBottom: 12,
  },
  aiSummary: {
    fontSize: 15,
    color: COLORS.ink,
    lineHeight: 22,
    marginBottom: 14,
  },
  aiSection: {
    marginBottom: 12,
  },
  aiSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C47FF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  aiBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  aiBulletDot: {
    fontSize: 14,
    color: '#6C47FF',
    marginRight: 8,
    marginTop: 1,
  },
  aiBulletText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    lineHeight: 20,
  },
  aiTimestamp: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 8,
    textAlign: 'right',
  },
});
