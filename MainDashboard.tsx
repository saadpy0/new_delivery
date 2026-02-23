import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Alert,
  ImageBackground,
  Modal,
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
import Purchases from 'react-native-purchases';
import Svg, { Circle, Path } from 'react-native-svg';
import ScreenTimeTest from './ScreenTimeTest';
import OverrideFlow from './OverrideFlow';
import { blockingService, type BlockType, type BlockMode, type BlockingSettings, type BlockState, type ScheduleConfig, type PerModeCooldown } from './BlockingService';
import { loadDashboardData, getSubscription, addOrder as addOrderToDb, deleteOrder as deleteOrderFromDb, updateBudget, updateBlockingSettings, updateProfile, type Order as DbOrder } from './DataService';
import { supabase } from './supabaseClient';

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
const PRO_ENTITLEMENT_ID = 'undelivery Pro';

const NavIcon = ({ tab, color }: { tab: TabKey; color: string }) => {
  if (tab === 'home') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2.36407 12.9579C1.98463 10.3208 1.79491 9.00229 2.33537 7.87495C2.87583 6.7476 4.02619 6.06234 6.32691 4.69181L7.71175 3.86687C9.80104 2.62229 10.8457 2 12 2C13.1543 2 14.199 2.62229 16.2882 3.86687L17.6731 4.69181C19.9738 6.06234 21.1242 6.7476 21.6646 7.87495C22.2051 9.00229 22.0154 10.3208 21.6359 12.9579L21.3572 14.8952C20.8697 18.2827 20.626 19.9764 19.451 20.9882C18.2759 22 16.5526 22 13.1061 22H10.8939C7.44737 22 5.72409 22 4.54903 20.9882C3.37396 19.9764 3.13025 18.2827 2.64284 14.8952L2.36407 12.9579Z"
          stroke={color}
          strokeWidth={1.6}
        />
        <Path d="M15 18H9" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  if (tab === 'orders') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M7.5 18C8.32843 18 9 18.6716 9 19.5C9 20.3284 8.32843 21 7.5 21C6.67157 21 6 20.3284 6 19.5C6 18.6716 6.67157 18 7.5 18Z" stroke={color} strokeWidth={1.5} />
        <Path d="M16.5 18.0001C17.3284 18.0001 18 18.6716 18 19.5001C18 20.3285 17.3284 21.0001 16.5 21.0001C15.6716 21.0001 15 20.3285 15 19.5001C15 18.6716 15.6716 18.0001 16.5 18.0001Z" stroke={color} strokeWidth={1.5} />
        <Path d="M2 3L2.26121 3.09184C3.5628 3.54945 4.2136 3.77826 4.58584 4.32298C4.95808 4.86771 4.95808 5.59126 4.95808 7.03836V9.76C4.95808 12.7016 5.02132 13.6723 5.88772 14.5862C6.75412 15.5 8.14857 15.5 10.9375 15.5H12M16.2404 15.5C17.8014 15.5 18.5819 15.5 19.1336 15.0504C19.6853 14.6008 19.8429 13.8364 20.158 12.3075L20.6578 9.88275C21.0049 8.14369 21.1784 7.27417 20.7345 6.69708C20.2906 6.12 18.7738 6.12 17.0888 6.12H11.0235M4.95808 6.12H7" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    );
  }

  if (tab === 'reports') {
    return (
      <Svg width={23} height={23} viewBox="-0.5 0 25 25" fill="none">
        <Path d="M3.02 5.5H20.98C21.27 5.5 21.5 5.73 21.5 6.02V18.98C21.5 19.27 21.27 19.5 20.98 19.5H3.02C2.73 19.5 2.5 19.27 2.5 18.98V6.02C2.5 5.73 2.73 5.5 3.02 5.5Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 8.25V10.25" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 15.25V16.75" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M17 8.25V8.95999" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 11.25V16.75" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="7" cy="8.75" r="1" fill={color} />
        <Circle cx="12" cy="12.75" r="1" fill={color} />
        <Circle cx="17" cy="10.96" r="1" fill={color} />
        <Path d="M17 12.96V16.75" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (tab === 'bridge') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M17 3.33782C15.5291 2.48697 13.8214 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22C17.5228 22 22 17.5228 22 12C22 10.1786 21.513 8.47087 20.6622 7"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.6} />
      <Path
        d="M3.66122 10.6392C4.13377 10.9361 4.43782 11.4419 4.43782 11.9999C4.43781 12.558 4.13376 13.0638 3.66122 13.3607C3.33966 13.5627 3.13248 13.7242 2.98508 13.9163C2.66217 14.3372 2.51966 14.869 2.5889 15.3949C2.64082 15.7893 2.87379 16.1928 3.33973 16.9999C3.80568 17.8069 4.03865 18.2104 4.35426 18.4526C4.77508 18.7755 5.30694 18.918 5.83284 18.8488C6.07287 18.8172 6.31628 18.7185 6.65196 18.5411C7.14544 18.2803 7.73558 18.2699 8.21895 18.549C8.70227 18.8281 8.98827 19.3443 9.00912 19.902C9.02332 20.2815 9.05958 20.5417 9.15224 20.7654C9.35523 21.2554 9.74458 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8478 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.9021C15.0117 19.3443 15.2977 18.8281 15.7811 18.549C16.2644 18.27 16.8545 18.2804 17.3479 18.5412C17.6837 18.7186 17.9271 18.8173 18.1671 18.8489C18.693 18.9182 19.2249 18.7756 19.6457 18.4527C19.9613 18.2106 20.1943 17.807 20.6603 17C20.8677 16.6407 21.029 16.3614 21.1486 16.1272M20.3387 13.3608C19.8662 13.0639 19.5622 12.5581 19.5621 12.0001C19.5621 11.442 19.8662 10.9361 20.3387 10.6392C20.6603 10.4372 20.8674 10.2757 21.0148 10.0836C21.3377 9.66278 21.4802 9.13092 21.411 8.60502C21.3591 8.2106 21.1261 7.80708 20.6601 7.00005C20.1942 6.19301 19.9612 5.7895 19.6456 5.54732C19.2248 5.22441 18.6929 5.0819 18.167 5.15113C17.927 5.18274 17.6836 5.2814 17.3479 5.45883C16.8544 5.71964 16.2643 5.73004 15.781 5.45096C15.2977 5.1719 15.0117 4.6557 14.9909 4.09803C14.9767 3.71852 14.9404 3.45835 14.8478 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74458 2.35523 9.35523 2.74458 9.15224 3.23463C9.05958 3.45833 9.02332 3.71848 9.00912 4.09794C8.98826 4.65566 8.70225 5.17191 8.21891 5.45096C7.73557 5.73002 7.14548 5.71959 6.65205 5.4588C6.31633 5.28136 6.0729 5.18269 5.83285 5.15108C5.30695 5.08185 4.77509 5.22436 4.35427 5.54727C4.03866 5.78945 3.80569 6.19297 3.33974 7C2.87379 7.80703 2.64082 8.21055 2.5889 8.60497C2.51966 9.13087 2.66217 9.66273 2.98508 10.0836C3.13248 10.2757 3.33965 10.4372 3.66122 10.6392Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
};

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

const DELIVERY_APPS = ['Uber Eats', 'Just Eat', 'DoorDash', 'Deliveroo', 'GrubHub', 'Postmates'] as const;

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
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showVendorMenu, setShowVendorMenu] = useState(false);
  const [selectedAppLabels, setSelectedAppLabels] = useState<string[]>([]);
  const [budgetReminders, setBudgetReminders] = useState(true);
  const [cookingIdeas, setCookingIdeas] = useState(true);
  const [opportunityAmount, setOpportunityAmount] = useState('22');
  const [subscriptionPlan, setSubscriptionPlan] = useState<'weekly' | 'monthly' | 'yearly' | 'none'>('none');
  const [trialActive, setTrialActive] = useState(false);
  const [subscriptionPeriodType, setSubscriptionPeriodType] = useState('unknown');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [subscriptionWillRenew, setSubscriptionWillRenew] = useState<boolean | null>(null);

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

  const getPlanFromProductId = (productId?: string | null): 'weekly' | 'monthly' | 'yearly' | 'none' => {
    const id = String(productId ?? '').toLowerCase();
    if (!id) return 'none';
    if (id.includes('weekly')) return 'weekly';
    if (id.includes('monthly')) return 'monthly';
    if (id.includes('yearly') || id.includes('annual')) return 'yearly';
    return 'none';
  };

  const applySubscriptionDebugState = (subscription: any) => {
    const hasActiveEntitlement = Boolean(subscription?.rc_entitlement_active);
    setSubscriptionPlan(hasActiveEntitlement ? getPlanFromProductId(subscription?.rc_product_id) : 'none');
    const periodType = String(subscription?.rc_period_type ?? '').toLowerCase();
    const subscriptionName = String(subscription?.rc_subscription_name ?? '').toLowerCase();
    setTrialActive(Boolean(subscription?.rc_is_trial) || periodType === 'trial' || subscriptionName.includes('trial'));
    setSubscriptionPeriodType(periodType || 'unknown');
    setSubscriptionExpiresAt(subscription?.rc_expires_date ?? null);
    setSubscriptionWillRenew(
      typeof subscription?.rc_will_renew === 'boolean'
        ? Boolean(subscription?.rc_will_renew)
        : null,
    );
  };

  const refreshSubscriptionFromRevenueCat = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (error || !userId) return;

    try {
      const info = await Purchases.getCustomerInfo();
      const entitlement = (info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
      const rawPeriodType = entitlement?.periodType ?? null;
      const periodType = rawPeriodType ? String(rawPeriodType).toLowerCase() : null;
      const isTrial = Boolean(entitlement) && periodType === 'trial';
      const expiresDate = entitlement?.expirationDate ?? null;
      const willRenew = entitlement?.willRenew ?? null;
      const productIdentifier = entitlement?.productIdentifier ?? null;

      let subscriptionName: string | null = null;
      let subscriptionPrice: string | null = null;
      if (productIdentifier) {
        try {
          const products = await Purchases.getProducts([productIdentifier]);
          const product = products?.[0];
          subscriptionName = product?.title ?? null;
          subscriptionPrice = product?.priceString ?? null;
        } catch {
          // Keep nulls if product metadata lookup fails.
        }
      }

      await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            rc_customer_id: (info as any)?.originalAppUserId ?? null,
            rc_app_user_id: (info as any)?.appUserId ?? null,
            rc_entitlement_active: Boolean(entitlement),
            rc_entitlement_id: entitlement ? PRO_ENTITLEMENT_ID : null,
            rc_product_id: productIdentifier,
            rc_subscription_name: subscriptionName,
            rc_subscription_price: subscriptionPrice,
            rc_period_type: periodType,
            rc_is_trial: isTrial,
            rc_expires_date: expiresDate,
            rc_will_renew: willRenew,
            rc_last_event_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
    } catch {
      // Leave last-synced state intact if RevenueCat refresh fails.
    }
  }, []);

  useEffect(() => {
    setActiveTab('home');
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setActiveTab('home');
        void refreshSubscriptionFromRevenueCat().then(async () => {
          const latestSubscription = await getSubscription();
          applySubscriptionDebugState(latestSubscription);
        });
      }
    });
    return () => subscription.remove();
  }, [refreshSubscriptionFromRevenueCat]);

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

        await refreshSubscriptionFromRevenueCat();
        const subscription = await getSubscription();
        applySubscriptionDebugState(subscription);
      } catch (e) {
        console.warn('Failed to load dashboard data:', e);
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, [refreshSubscriptionFromRevenueCat]);

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
        const namesFromResult = (result as any)?.appNames;
        if (Array.isArray(namesFromResult)) {
          setSelectedAppLabels(namesFromResult.filter((n: unknown) => typeof n === 'string'));
        }
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
    setShowVendorMenu(false);
    setShowAddOrderModal(false);
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
  const modeVisuals: Record<BlockMode, {
    modeCardBase: string;
    modeCardGlow: string;
    modeCardTint: string;
    modeCardText: string;
    modeCardSubText: string;
    orderBg: string;
    orderBorder: string;
    orderIconBg: string;
    orderAmount: string;
    navBg: string;
    navBorder: string;
    navText: string;
    navActiveBg: string;
    navActiveText: string;
    action: string;
  }> = {
    gentle: {
      modeCardBase: '#20100D',
      modeCardGlow: '#6E2A1E',
      modeCardTint: '#9F3E2A',
      modeCardText: '#FFFFFF',
      modeCardSubText: '#F3C2B8',
      orderBg: '#FFF3EE',
      orderBorder: '#FFD8CC',
      orderIconBg: '#FFE8E0',
      orderAmount: '#D84A27',
      navBg: '#1A0F0D',
      navBorder: '#3C231D',
      navText: '#D9AFA5',
      navActiveBg: '#FF5E37',
      navActiveText: '#FFFFFF',
      action: '#D84A27',
    },
    moderate: {
      modeCardBase: '#10172A',
      modeCardGlow: '#233C82',
      modeCardTint: '#3658C9',
      modeCardText: '#FFFFFF',
      modeCardSubText: '#C9D6FF',
      orderBg: '#EFF3FF',
      orderBorder: '#CCD7FF',
      orderIconBg: '#DEE7FF',
      orderAmount: '#2D4EC1',
      navBg: '#0F1628',
      navBorder: '#243866',
      navText: '#AFC1FA',
      navActiveBg: '#4E6DFF',
      navActiveText: '#FFFFFF',
      action: '#2D4EC1',
    },
    precautionary: {
      modeCardBase: '#0D1D20',
      modeCardGlow: '#1D5C62',
      modeCardTint: '#2F8990',
      modeCardText: '#EEFFFF',
      modeCardSubText: '#BCE8EC',
      orderBg: '#ECFAFB',
      orderBorder: '#C8ECEF',
      orderIconBg: '#DCF5F7',
      orderAmount: '#1A6F77',
      navBg: '#0D1B1E',
      navBorder: '#23484D',
      navText: '#A6D7DC',
      navActiveBg: '#2B8A92',
      navActiveText: '#F4FFFF',
      action: '#1A6F77',
    },
  };
  const activeModeAccent = modeAccent[blockSettings.mode];
  const modeVisual = modeVisuals[blockSettings.mode];
  const homeActionColor = modeVisual.action;
  const ordersHeadingColor = '#FFFFFF';
  const ordersSubColor =
    blockSettings.mode === 'precautionary'
      ? '#0F2740'
      : blockSettings.mode === 'moderate'
        ? '#0F2740'
        : '#B8C8E8';
  const ordersCountColor =
    blockSettings.mode === 'gentle'
      ? '#D5C4E9'
      : blockSettings.mode === 'moderate'
        ? '#6D84AE'
        : '#3F6077';
  const orderActionColor = blockSettings.mode === 'precautionary' ? modeVisual.action : activeModeAccent;
  const orderFieldLabelColor =
    blockSettings.mode === 'precautionary'
      ? '#D6EDF8'
      : blockSettings.mode === 'moderate'
        ? '#D5E4FF'
        : '#B8C8E8';
  const orderFieldBg = blockSettings.mode === 'precautionary' ? '#F3F8FD' : '#EAF1FF';
  const orderFieldText = '#213B61';
  const orderPlaceholder = '#8AA0C4';
  const orderModalTitleColor = '#F4F8FF';
  const orderModalCloseColor = blockSettings.mode === 'precautionary' ? '#4E6D86' : '#C0CDE9';
  const homeBackgroundSource =
    blockSettings.mode === 'gentle'
      ? require('./other_imgs/gentlebg.png')
      : blockSettings.mode === 'precautionary'
        ? require('./other_imgs/precaubg.png')
        : require('./other_imgs/moderate_bg.png');

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
    const modeDesc = MODE_LABELS[blockSettings.mode].desc;

    return (
      <Pressable
        onLongPress={openModeSwitchOptions}
        delayLongPress={280}
        style={{
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 22,
          backgroundColor: modeVisual.modeCardBase,
          borderWidth: 1,
          borderColor: modeVisual.modeCardTint,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: modeVisual.modeCardGlow,
            top: -120,
            right: -40,
            opacity: 0.55,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: modeVisual.modeCardTint,
            bottom: -100,
            left: -60,
            opacity: 0.5,
          }}
        />
        <Text style={{ color: modeVisual.modeCardSubText, fontSize: 13, fontWeight: '700' }}>Current mode</Text>
        <Text style={{ color: modeVisual.modeCardText, fontSize: 39, lineHeight: 44, fontWeight: '800', marginTop: 6 }}>
          {modeLabel}
        </Text>
        <Text style={{ color: modeVisual.modeCardSubText, fontSize: 14, fontWeight: '500', marginTop: 6 }}>
          {modeDesc}
        </Text>
        <Text style={{ color: modeVisual.modeCardSubText, fontSize: 15, fontWeight: '600', marginTop: 8 }}>
          Cooldown: {cooldown} min
        </Text>
        <Text style={{ color: modeVisual.modeCardSubText, fontSize: 13, marginTop: 4 }}>
          Hold to switch mode
        </Text>
      </Pressable>
    );
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: 'transparent', paddingTop: 14 }]}> 
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => setActiveTab('settings')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#4A69FF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
              {(userName?.trim()?.[0] ?? 'U').toUpperCase()}
            </Text>
          </Pressable>
          <Text style={{ marginLeft: 10, fontSize: 21, fontWeight: '500', color: '#151925' }}>
            Hi {userName || 'there'}
          </Text>
        </View>

        <Pressable
          onPress={() => setActiveSheet('reminders')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E4E8F1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#151925', fontSize: 15 }}>🔔</Text>
        </Pressable>
      </View>

      {renderModeSelector()}

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#E4E8F1',
        }}
      >
        <Text style={{ color: '#1A2238', fontSize: 13, fontWeight: '700' }}>
          Subscription: {subscriptionPlan}
        </Text>
        <Text style={{ color: '#4E5A7A', fontSize: 12, marginTop: 4 }}>
          Trial active: {trialActive ? 'yes' : 'no'}
        </Text>
        <Text style={{ color: '#4E5A7A', fontSize: 12, marginTop: 2 }}>
          Period type: {subscriptionPeriodType}
        </Text>
        <Text style={{ color: '#4E5A7A', fontSize: 12, marginTop: 2 }}>
          Will renew: {subscriptionWillRenew === null ? 'unknown' : subscriptionWillRenew ? 'yes' : 'no'}
        </Text>
        <Text style={{ color: '#4E5A7A', fontSize: 12, marginTop: 2 }}>
          Expires: {subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toLocaleString() : 'unknown'}
        </Text>
      </View>

      {blockState.isShieldActive && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#E4E8F1',
          }}
        >
          <Text style={{ color: '#151925', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
            {blockState.activeBlockType === 'budget' ? '🔴 Over-budget block active' : '❄️ Precautionary block active'}
          </Text>
          <Pressable
            onPress={() => setShowOverrideFlow(true)}
            style={{
              marginTop: 12,
              backgroundColor: homeActionColor,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              shadowColor: '#0E1320',
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              Request override
            </Text>
          </Pressable>
        </View>
      )}

      {blockState.autoShiftedFromPrecau && (
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFD7CC' }}>
          <Text style={{ color: '#AA3E28', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
            Over budget — auto-shifted to Gentle mode
          </Text>
        </View>
      )}

      {showPrecauRecommendation && (
        <Pressable
          onPress={() => handleSetMode('precautionary')}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            marginBottom: 10,
            backgroundColor: '#F2F6FF',
            borderWidth: 1,
            borderColor: '#D6E3FF',
          }}
        >
          <Text style={{ color: '#2B4C93', fontWeight: '600', fontSize: 11 }}>
            💡 Under budget: switch to Precautionary for extra protection
          </Text>
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: homePalette.white, borderRadius: 22, padding: 16 }}>
          <Text style={{ color: '#535A70', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>
            Weekly spend
          </Text>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#11131A', marginTop: 6 }}>${totalSpend.toFixed(0)}</Text>
          <Text style={{ marginTop: 4, color: '#5F6577', fontSize: 12, fontWeight: '500' }}>of ${weeklyBudget} budget</Text>
          <View style={{ marginTop: 12, height: 8, borderRadius: 999, backgroundColor: '#DCE0ED' }}>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: homePalette.orange, width: `${budgetProgress * 100}%` }} />
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#E4E8F1' }}>
          <Text style={{ color: '#535A70', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>
            Remaining
          </Text>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#11131A', marginTop: 6 }}>${remaining.toFixed(0)}</Text>
          <Text style={{ marginTop: 4, color: '#5F6577', fontSize: 12, fontWeight: '500' }}>before lock threshold</Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          padding: 18,
          borderWidth: 1,
          borderColor: '#DDE3EF',
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            color: '#2E3140',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: '600',
          }}
        >
          Shielded apps
        </Text>
        <Text style={{
          color: '#151925',
          fontWeight: '700',
          fontSize: 22,
          marginTop: 8,
        }}>
          {blockSettings.selectedAppCount > 0
            ? `${blockSettings.selectedAppCount} app(s) selected`
            : 'No apps selected'}
        </Text>
        {blockSettings.selectedAppCount > 0 ? (
          <Text
            style={{
              color: '#2E3140',
              fontWeight: '500',
              marginTop: 8,
              fontSize: 13,
            }}
          >
            {selectedAppLabels.length > 0
              ? `Selected: ${selectedAppLabels.slice(0, 3).join(', ')}${selectedAppLabels.length > 3 ? ` +${selectedAppLabels.length - 3}` : ''}`
              : `${blockSettings.selectedAppCount} protected app/category selection(s)`}
          </Text>
        ) : (
          <Text
            style={{
              color: '#2E3140',
              fontWeight: '500',
              marginTop: 8,
              fontSize: 13,
            }}
          >
            Choose delivery apps/categories to shield.
          </Text>
        )}

        <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
          <Pressable
            onPress={handleSelectApps}
            style={{
              backgroundColor:
                blockSettings.mode === 'gentle'
                  ? '#DE6B44'
                  : blockSettings.mode === 'moderate'
                    ? '#3E7EC6'
                    : '#41A78F',
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
              {blockSettings.selectedAppCount > 0 ? 'Manage apps' : 'Select apps'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E4E8F1', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#5E667B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>Streak</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#151925', marginTop: 4 }}>3 days</Text>
          </View>
          <Text style={{ fontSize: 32 }}>🔥</Text>
        </View>
        {blockState.overridesThisWeek > 0 && (
          <Text style={{ color: '#5E667B', fontWeight: '500', marginTop: 8, fontSize: 13 }}>
            {blockState.overridesThisWeek} override(s) this week
            {blockSettings.penaltyEnabled ? ` · $${blockState.penaltyAccumulated} guilt jar` : ''}
          </Text>
        )}
      </View>

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
            backgroundColor: modeVisual.orderBg,
            borderWidth: 1,
            borderColor: modeVisual.orderBorder,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: modeVisual.orderIconBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 16 }}>🍽️</Text>
            </View>
            <View>
              <Text style={{ fontWeight: '700', color: '#151925', fontSize: 15 }}>{order.vendor}</Text>
              <Text style={{ marginTop: 4, color: '#6D7386', fontSize: 12 }}>{formatOrderDate(order.ordered_at)}</Text>
            </View>
          </View>
          <Text style={{ fontWeight: '800', color: modeVisual.orderAmount, fontSize: 16 }}>-${order.amount.toFixed(2)}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderOrders = () => (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.ordersHeader}>
          <Text style={[styles.ordersHeaderTitle, { color: ordersHeadingColor }]}>Orders & Spend</Text>
          <Text style={[styles.ordersHeaderSubtitle, { color: ordersSubColor }]}>Track every delivery order</Text>
        </View>

        <Pressable
          onPress={() => setShowAddOrderModal(true)}
          style={[
            styles.addOrderCard,
            {
              backgroundColor: modeVisual.modeCardBase,
              borderColor: modeVisual.modeCardGlow,
            },
          ]}
        >
          <View>
            <Text style={[styles.addOrderCardTitle, { color: modeVisual.modeCardText }]}>Log your next order</Text>
          </View>
          <View style={[styles.addOrderCtaPill, { backgroundColor: orderActionColor }]}>
            <Text style={styles.addOrderCtaText}>Add order</Text>
          </View>
        </Pressable>

        <View style={styles.ordersSectionHeader}>
          <Text style={[styles.ordersSectionTitle, { color: modeVisual.modeCardText }]}>Recent orders</Text>
          <Text style={[styles.ordersSectionCount, { color: ordersCountColor }]}>{orders.length} total</Text>
        </View>

        {orders.length === 0 ? (
          <View
            style={[
              styles.ordersEmptyCard,
              {
                backgroundColor: modeVisual.orderBg,
                borderColor: modeVisual.orderBorder,
              },
            ]}
          >
            <Text style={[styles.ordersEmptyTitle, { color: modeVisual.orderAmount }]}>No orders yet</Text>
            <Text style={[styles.ordersEmptyBody, { color: modeVisual.modeCardSubText }]}>Use Add order to log your first delivery this week.</Text>
          </View>
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              style={[
                styles.orderRow,
                {
                  backgroundColor: modeVisual.orderBg,
                  borderColor: modeVisual.orderBorder,
                },
              ]}
              onLongPress={() =>
                Alert.alert('Delete order?', `${order.vendor} — $${order.amount.toFixed(2)}`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDeleteOrder(order.id) },
                ])
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.orderIconBubble, { backgroundColor: modeVisual.orderIconBg }]}>
                  <Text style={{ fontSize: 16 }}>🍽️</Text>
                </View>
                <View>
                  <Text style={styles.orderVendor}>{order.vendor}</Text>
                  <Text style={styles.orderDate}>{formatOrderDate(order.ordered_at)}</Text>
                </View>
              </View>
              <Text style={[styles.orderAmount, { color: modeVisual.orderAmount }]}>-${order.amount.toFixed(2)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showAddOrderModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddOrderModal(false);
          setShowVendorMenu(false);
        }}
      >
        <View style={styles.orderModalBackdrop}>
          <View style={[styles.orderModalSheet, { backgroundColor: modeVisual.modeCardBase, borderColor: modeVisual.modeCardGlow }]}>
            <View style={styles.orderModalHeader}>
              <Text style={[styles.orderModalTitle, { color: orderModalTitleColor }]}>Add order</Text>
              <Pressable
                onPress={() => {
                  setShowAddOrderModal(false);
                  setShowVendorMenu(false);
                }}
              >
                <Text style={[styles.orderModalClose, { color: orderModalCloseColor }]}>Close</Text>
              </Pressable>
            </View>

            <Text style={[styles.orderFieldLabel, { color: orderFieldLabelColor }]}>Vendor</Text>
            <Pressable
              onPress={() => setShowVendorMenu((prev) => !prev)}
              style={[styles.vendorSelect, { borderColor: modeVisual.orderBorder, backgroundColor: orderFieldBg }]}
            >
              <Text style={[styles.vendorSelectText, { color: newOrderVendor ? orderFieldText : orderPlaceholder }]}>{newOrderVendor || 'Select delivery app'}</Text>
              <Text style={[styles.vendorSelectChevron, { color: orderPlaceholder }]}>{showVendorMenu ? '▲' : '▼'}</Text>
            </Pressable>

            {showVendorMenu && (
              <View style={[styles.vendorMenu, { borderColor: modeVisual.orderBorder, backgroundColor: orderFieldBg }]}>
                {DELIVERY_APPS.map((app) => (
                  <Pressable
                    key={app}
                    onPress={() => {
                      setNewOrderVendor(app);
                      setShowVendorMenu(false);
                    }}
                    style={[styles.vendorMenuItem, { borderBottomColor: 'rgba(33,59,97,0.12)' }]}
                  >
                    <Text style={[styles.vendorMenuItemText, { color: orderFieldText }]}>{app}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={[styles.orderFieldLabel, { color: orderFieldLabelColor }]}>Total amount</Text>
            <TextInput
              placeholder="$0.00"
              placeholderTextColor={orderPlaceholder}
              value={newOrderAmount}
              onChangeText={setNewOrderAmount}
              keyboardType="decimal-pad"
              style={[
                styles.orderAmountInput,
                {
                  borderColor: modeVisual.orderBorder,
                  backgroundColor: orderFieldBg,
                  color: orderFieldText,
                },
              ]}
            />

            <Pressable
              style={[styles.orderSubmitButton, { backgroundColor: orderActionColor }]}
              onPress={handleAddOrder}
              disabled={!newOrderVendor.trim() || Number.isNaN(Number.parseFloat(newOrderAmount))}
            >
              <Text style={styles.orderSubmitButtonText}>Add order</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={styles.reminderOverlayBackdrop}>
          <View style={styles.reminderOverlayCard}>
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
        </View>
      </Modal>
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

  const isModeThemedTab =
    activeTab === 'home' ||
    activeTab === 'orders' ||
    activeTab === 'bridge' ||
    activeTab === 'reports' ||
    activeTab === 'settings';
  const containerBg = isModeThemedTab ? '#FFFFFF' : COLORS.cream;
  const tabBarBg = isModeThemedTab ? modeVisual.navBg : COLORS.white;
  const tabBarBorder = isModeThemedTab ? modeVisual.navBorder : COLORS.border;
  const tabTextColor = isModeThemedTab ? modeVisual.navText : COLORS.muted;
  const tabActiveTextColor = isModeThemedTab ? modeVisual.navActiveText : COLORS.ink;
  const tabActiveBg = isModeThemedTab ? modeVisual.navActiveBg : COLORS.cream;

  const content = (
    <SafeAreaView style={[styles.container, { backgroundColor: isModeThemedTab ? 'transparent' : containerBg }]}> 
      {renderContent()}
      {renderSheet()}
      <View style={[styles.tabBar, { backgroundColor: tabBarBg, borderColor: tabBarBorder }]}> 
        {([
          { key: 'home' },
          { key: 'orders' },
          { key: 'bridge' },
          { key: 'reports' },
          { key: 'settings' },
        ] as { key: TabKey }[]).map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabItem, activeTab === tab.key && { backgroundColor: tabActiveBg }]}
          >
            <View style={styles.tabIconWrap}>
              <NavIcon tab={tab.key} color={activeTab === tab.key ? tabActiveTextColor : tabTextColor} />
            </View>
            {activeTab === tab.key ? <View style={[styles.tabDot, { backgroundColor: tabActiveTextColor }]} /> : null}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );

  if (isModeThemedTab) {
    return (
      <ImageBackground
        source={homeBackgroundSource}
        style={styles.container}
        imageStyle={{ resizeMode: 'cover' }}
      >
        {content}
      </ImageBackground>
    );
  }

  return content;
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
  reminderOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingHorizontal: 16,
  },
  reminderOverlayCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
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
  ordersHeader: {
    marginBottom: 18,
  },
  ordersHeaderTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F4F7FF',
  },
  ordersHeaderSubtitle: {
    marginTop: 6,
    color: '#B6C4E8',
    fontSize: 14,
    fontWeight: '500',
  },
  addOrderCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addOrderCardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addOrderCardBody: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  addOrderCtaPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addOrderCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ordersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ordersSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  ordersSectionCount: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ordersEmptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  ordersEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  ordersEmptyBody: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '500',
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
  orderIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
  orderModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 22, 0.55)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 88,
    paddingHorizontal: 16,
  },
  orderModalSheet: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
  },
  orderModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  orderModalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  orderModalClose: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  vendorSelect: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendorSelectText: {
    fontSize: 15,
    fontWeight: '600',
  },
  vendorSelectChevron: {
    fontSize: 12,
    fontWeight: '700',
  },
  vendorMenu: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  vendorMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  vendorMenuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderAmountInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  orderSubmitButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  orderSubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
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
    left: 20,
    right: 20,
    bottom: 16,
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
