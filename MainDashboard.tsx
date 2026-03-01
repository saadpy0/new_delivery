import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  Linking,
  Modal,
  NativeModules,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OPENAI_API_KEY } from '@env';
import OverrideFlow from './OverrideFlow';
import { blockingService, type BlockType, type BlockMode, type BlockingSettings, type BlockState, type PerModeCooldown } from './BlockingService';
import { loadDashboardData, getSubscription, getChatHistory, upsertChatHistory, addOrder as addOrderToDb, deleteOrder as deleteOrderFromDb, updateBudget, updateBlockingSettings, updateProfile, type Order as DbOrder } from './DataService';
import { supabase } from './supabaseClient';

const { NotificationPermissionManager } = NativeModules;

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


const MODE_LABELS: Record<BlockMode, { label: string; emoji: string; desc: string }> = {
  gentle: { label: 'Guarded', emoji: '🔥', desc: 'Blocks when over budget. Hardest override.' },
  moderate: { label: 'Balanced', emoji: '🛡️', desc: 'Blocks when over budget. Faster override.' },
  precautionary: { label: 'Preventive', emoji: '❄️', desc: 'Blocks even under budget. Lightest friction.' },
};

type TabKey = 'home' | 'orders' | 'reports' | 'chat' | 'settings';
type SheetKey = 'budget' | 'opportunity' | null;
type SettingsScreenKey = 'account' | 'blocker' | 'faq' | 'contact' | 'privacy' | 'terms' | null;
const PRO_ENTITLEMENT_ID = 'undelivery Pro';
const OPENAI_API_KEY_PLACEHOLDER = 'OPENAI_API_KEY_HERE';
const APP_STORE_REVIEW_URL = 'https://apps.apple.com/app/id0000000000?action=write-review';
const APP_STORE_FALLBACK_URL = 'https://apps.apple.com/';
const HOME_WEEK_START_KEY = '@quitbite_home_week_start_v1';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const normalizeAssistantText = (raw: string) => {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content: "Hey — I can help you reduce delivery spend, plan quick meals, and stay on budget. What's one thing you want help with right now?",
  },
];

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

  if (tab === 'chat') {
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
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const ORDER_EMOJIS = ['🍔', '🍕', '🍟', '🌯', '🍜', '🍣', '🥗', '🌮', '🍛', '🥪', '🍗', '🍱'] as const;

const getOrderEmoji = (vendor: string, amount: number) => {
  const seed = `${vendor}-${amount.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return ORDER_EMOJIS[Math.abs(hash) % ORDER_EMOJIS.length];
};

const getWeekStartIso = (dateLike: string | Date) => {
  const date = new Date(dateLike);
  const normalized = new Date(date);
  const dayIndex = normalized.getDay();
  normalized.setDate(normalized.getDate() - dayIndex);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString().slice(0, 10);
};

export default function MainDashboard({
  email,
  pendingOverride,
  onOverrideHandled,
  onSignOut,
}: MainDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
  const [activeSettingsScreen, setActiveSettingsScreen] = useState<SettingsScreenKey>(null);
  const [showOverrideFlow, setShowOverrideFlow] = useState(false);
  const [blockSettings, setBlockSettings] = useState<BlockingSettings>(blockingService.getSettings());
  const [blockState, setBlockState] = useState<BlockState>(blockingService.getState());
  const [userName, setUserName] = useState('');
  const [accountNameInput, setAccountNameInput] = useState('');
  const [accountAgeInput, setAccountAgeInput] = useState('');
  const [savedAccountAge, setSavedAccountAge] = useState('');
  const [savingsGoals, setSavingsGoals] = useState<string[]>([]);
  const [weeklyBudget, setWeeklyBudget] = useState(120);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newOrderVendor, setNewOrderVendor] = useState('');
  const [newOrderAmount, setNewOrderAmount] = useState('');
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showVendorMenu, setShowVendorMenu] = useState(false);
  const [selectedAppLabels, setSelectedAppLabels] = useState<string[]>([]);
  const [lastOverrideAt, setLastOverrideAt] = useState<number | null>(null);
  const lastAppStateRef = useRef(AppState.currentState);
  const [currentWeekStartIso, setCurrentWeekStartIso] = useState(getWeekStartIso(new Date()));
  const [homeWeekStartIso, setHomeWeekStartIso] = useState(getWeekStartIso(new Date()));
  const [opportunityAmount, setOpportunityAmount] = useState('22');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(DEFAULT_CHAT_MESSAGES);
  const [chatHistoryReady, setChatHistoryReady] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
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

  const ordersThisWeek = useMemo(
    () => orders.filter((order) => getWeekStartIso(order.ordered_at) === currentWeekStartIso),
    [orders, currentWeekStartIso],
  );

  const totalSpend = useMemo(
    () => ordersThisWeek.reduce((sum, order) => sum + order.amount, 0),
    [ordersThisWeek],
  );
  const remaining = Math.max(weeklyBudget - totalSpend, 0);
  const budgetProgress = Math.min(totalSpend / Math.max(weeklyBudget, 1), 1);

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

  const scheduleOverrideOrderPrompt = useCallback(async () => {
    if (!NotificationPermissionManager?.scheduleOverrideOrderPrompt || !lastOverrideAt) return;
    const elapsedMs = Date.now() - lastOverrideAt;
    const maxMs = 10 * 60 * 1000;
    if (elapsedMs > maxMs) return;
    const delaySeconds = 5;
    try {
      if (NotificationPermissionManager?.requestAuthorization) {
        const granted = await NotificationPermissionManager.requestAuthorization();
        if (!granted) return;
      }
      await NotificationPermissionManager.scheduleOverrideOrderPrompt(delaySeconds);
    } catch (error) {
      console.warn('Failed to schedule override order prompt', error);
    }
  }, [lastOverrideAt]);

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
    const syncWeeklyBoundaries = async () => {
      const weekStart = getWeekStartIso(new Date());
      setCurrentWeekStartIso(weekStart);
      try {
        const savedHomeWeekStart = await AsyncStorage.getItem(HOME_WEEK_START_KEY);
        if (!savedHomeWeekStart) {
          await AsyncStorage.setItem(HOME_WEEK_START_KEY, weekStart);
          setHomeWeekStartIso(weekStart);
          return;
        }

        if (savedHomeWeekStart !== weekStart) {
          await AsyncStorage.setItem(HOME_WEEK_START_KEY, weekStart);
          setHomeWeekStartIso(weekStart);
          return;
        }
        setHomeWeekStartIso(savedHomeWeekStart);
      } catch (error) {
        console.warn('Failed to sync weekly boundaries', error);
      }
    };

    void syncWeeklyBoundaries();
    const interval = setInterval(() => {
      void syncWeeklyBoundaries();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const previousState = lastAppStateRef.current;
      const movedToBackground = previousState === 'active' && (state === 'inactive' || state === 'background');
      if (lastOverrideAt && movedToBackground) {
        void scheduleOverrideOrderPrompt();
      }
      lastAppStateRef.current = state;

      if (state === 'active') {
        if (NotificationPermissionManager?.cancelOverrideOrderPrompt) {
          void NotificationPermissionManager.cancelOverrideOrderPrompt();
        }
        setActiveTab('home');
        setCurrentWeekStartIso(getWeekStartIso(new Date()));
        void refreshSubscriptionFromRevenueCat().then(async () => {
          const latestSubscription = await getSubscription();
          applySubscriptionDebugState(latestSubscription);
        });
      }
    });
    return () => subscription.remove();
  }, [refreshSubscriptionFromRevenueCat, lastOverrideAt, scheduleOverrideOrderPrompt]);

  useEffect(() => {
    setAccountNameInput(userName);
  }, [userName]);

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
        setAccountNameInput(data.profile?.name ?? '');
        const profileAge = data.profile?.age;
        const normalizedAge = typeof profileAge === 'number'
          ? String(Math.min(120, Math.max(10, Math.trunc(profileAge))))
          : '';
        setAccountAgeInput(normalizedAge);
        setSavedAccountAge(normalizedAge);
        const parsedGoals = String(data.onboarding?.savings_goal ?? '')
          .split(',')
          .map((goal) => goal.trim())
          .filter((goal) => goal.length > 0);
        setSavingsGoals(parsedGoals);
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
            superStrict: false,
            cooldowns: {
              gentle: data.blockingSettings.cooldown_gentle,
              moderate: data.blockingSettings.cooldown_moderate,
              precautionary: data.blockingSettings.cooldown_precautionary,
            },
            penaltyEnabled: false,
            penaltyAmount: 0,
            selectedAppCount: data.blockingSettings.selected_app_count,
          });
          setBlockSettings(blockingService.getSettings());
        }

        const history = await getChatHistory();
        if (history?.messages?.length) {
          setChatMessages(history.messages);
        } else {
          setChatMessages(DEFAULT_CHAT_MESSAGES);
        }

        await refreshSubscriptionFromRevenueCat();
        const subscription = await getSubscription();
        applySubscriptionDebugState(subscription);
      } catch (e) {
        console.warn('Failed to load dashboard data:', e);
      } finally {
        setChatHistoryReady(true);
        setIsLoading(false);
      }
    };
    void init();
  }, [refreshSubscriptionFromRevenueCat]);

  useEffect(() => {
    if (!chatHistoryReady) return;
    void upsertChatHistory(chatMessages);
  }, [chatMessages, chatHistoryReady]);

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
      super_strict: false,
      cooldown_gentle: s.cooldowns.gentle,
      cooldown_moderate: s.cooldowns.moderate,
      cooldown_precautionary: s.cooldowns.precautionary,
      penalty_enabled: false,
      penalty_amount: 0,
      selected_app_count: s.selectedAppCount,
      schedule_enabled: false,
      schedule_start_hour: 11,
      schedule_start_min: 0,
      schedule_end_hour: 14,
      schedule_end_min: 0,
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

  const handleSetCooldown = useCallback(async (mode: BlockMode, value: string) => {
    const mins = Math.max(0, Number.parseInt(value || '0', 10));
    await blockingService.updateSettings({ cooldowns: { [mode]: mins } as any });
    refreshBlockState();
  }, [refreshBlockState]);

  const handleRateApp = useCallback(async () => {
    const targetUrl = APP_STORE_REVIEW_URL.includes('id0000000000') ? APP_STORE_FALLBACK_URL : APP_STORE_REVIEW_URL;
    const supported = await Linking.canOpenURL(targetUrl);
    if (!supported) {
      Alert.alert('Unavailable', 'Unable to open the App Store right now.');
      return;
    }
    await Linking.openURL(targetUrl);
  }, []);

  const handleSaveAccountInfo = useCallback(async () => {
    const trimmedName = accountNameInput.trim();
    const normalizedAge = accountAgeInput.replace(/[^0-9]/g, '').slice(0, 3);
    if (normalizedAge && (Number(normalizedAge) < 10 || Number(normalizedAge) > 120)) {
      Alert.alert('Invalid age', 'Please enter a valid age between 10 and 120.');
      return;
    }

    try {
      await updateProfile({
        name: trimmedName || null,
        age: normalizedAge ? Number(normalizedAge) : null,
      });
      setUserName(trimmedName);

      setAccountAgeInput(normalizedAge);
      setSavedAccountAge(normalizedAge);
      Alert.alert('Saved', 'Your account details were updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save account details.');
    }
  }, [accountNameInput, accountAgeInput]);

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

  const sendChatMessageWithText = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isChatSending) return;

    if (!OPENAI_API_KEY || OPENAI_API_KEY === OPENAI_API_KEY_PLACEHOLDER) {
      Alert.alert(
        'OpenAI key missing',
        'Set OPENAI_API_KEY in your .env file to use the chatbot tab.',
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const recentHistory = [...chatMessages, userMessage].slice(-12);
    const hiddenContext = `Weekly budget: $${weeklyBudget}. Total spend: $${totalSpend.toFixed(2)}. Orders this week: ${orders.length}. Current block mode: ${blockSettings.mode}.`;

    setChatInput('');
    setChatError(null);
    setChatMessages((prev) => [...prev, userMessage]);
    setIsChatSending(true);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.6,
          messages: [
            {
              role: 'system',
              content: `You are an accountability and budgeting coach for food delivery spending. Keep responses concise, practical, and action-oriented. Give direct next steps.\n${hiddenContext}`,
            },
            ...recentHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Chat request failed.');
      }

      const assistantTextRaw = data?.choices?.[0]?.message?.content;
      const assistantText =
        (typeof assistantTextRaw === 'string' ? assistantTextRaw.trim() : '') ||
        'I could not generate a response. Please try again.';

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: normalizeAssistantText(assistantText),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const message = err?.message || 'Something went wrong while contacting OpenAI.';
      setChatError(message);
    } finally {
      setIsChatSending(false);
    }
  }, [chatMessages, isChatSending, weeklyBudget, totalSpend, orders.length, blockSettings.mode]);

  const sendChatMessage = useCallback(async () => {
    await sendChatMessageWithText(chatInput);
  }, [chatInput, sendChatMessageWithText]);

  const handleHealthyOptionChosen = useCallback((alternativeTitle: string) => {
    setShowOverrideFlow(false);
    setActiveTab('chat');
    void sendChatMessageWithText(
      `I chose this healthier option instead of ordering delivery: ${alternativeTitle}. Give me a simple step-by-step recipe to cook it now, with ingredients, prep, and a quick 15-minute version if possible.`
    );
  }, [sendChatMessageWithText]);

  const handleClearChatHistory = useCallback(() => {
    Alert.alert(
      'Clear chat history?',
      'This will remove all messages in Chat Coach for this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setChatMessages(DEFAULT_CHAT_MESSAGES);
            setChatInput('');
            setChatError(null);
          },
        },
      ],
    );
  }, []);


  const overBudget = totalSpend >= weeklyBudget;

  // Under-budget recommendation: if not on precautionary, suggest it
  const showPrecauRecommendation = !overBudget && blockSettings.mode !== 'precautionary';
  // Over-budget: precautionary is locked
  const precauLocked = overBudget;
  const modeVisuals: Record<BlockMode, {
    modeCardBase: string; modeCardGlow: string; modeCardTint: string;
    modeCardText: string; modeCardSubText: string;
    orderBg: string; orderBorder: string; orderIconBg: string; orderAmount: string;
    navBg: string; navBorder: string; navText: string; navActiveBg: string; navActiveText: string;
    action: string; cardSurface: string; cardBorder: string;
    labelColor: string; valueColor: string; dimText: string; progressTrack: string; accentGlow: string;
  }> = {
    gentle: {
      modeCardBase: '#100403', modeCardGlow: '#7A2818', modeCardTint: '#C04428',
      modeCardText: '#FFF5F2', modeCardSubText: '#FFB8A0',
      orderBg: '#321410', orderBorder: '#6A2C1C', orderIconBg: '#3E1A12', orderAmount: '#FF6B42',
      navBg: '#0C0302', navBorder: '#3E1A12', navText: '#D4907E', navActiveBg: '#E8512E', navActiveText: '#FFFFFF',
      action: '#E8512E', cardSurface: '#301410', cardBorder: '#6A2C1C',
      labelColor: '#D4907E', valueColor: '#FFF5F2', dimText: '#CC8070', progressTrack: '#3E1A12', accentGlow: '#FF6B42',
    },
    moderate: {
      modeCardBase: '#050A18', modeCardGlow: '#1C3272', modeCardTint: '#2E52CC',
      modeCardText: '#EEF2FF', modeCardSubText: '#A8BEFF',
      orderBg: '#172448', orderBorder: '#2E4490', orderIconBg: '#1C2E60', orderAmount: '#6B8FFF',
      navBg: '#040814', navBorder: '#1C2E60', navText: '#8AABE8', navActiveBg: '#3A5EFF', navActiveText: '#FFFFFF',
      action: '#3A5EFF', cardSurface: '#162248', cardBorder: '#2E4490',
      labelColor: '#8AABE8', valueColor: '#EEF2FF', dimText: '#7A96D4', progressTrack: '#1C2E60', accentGlow: '#4A6EFF',
    },
    precautionary: {
      modeCardBase: '#030C0E', modeCardGlow: '#0E4C5C', modeCardTint: '#1A7A84',
      modeCardText: '#E8FEFF', modeCardSubText: '#80D8E0',
      orderBg: '#103038', orderBorder: '#205E70', orderIconBg: '#123038', orderAmount: '#2EC4D0',
      navBg: '#02090B', navBorder: '#123038', navText: '#60B8C4', navActiveBg: '#1A8A94', navActiveText: '#E8FEFF',
      action: '#1A8A94', cardSurface: '#0F3038', cardBorder: '#205E70',
      labelColor: '#60B8C4', valueColor: '#E8FEFF', dimText: '#58AABC', progressTrack: '#123038', accentGlow: '#2EC4D0',
    },
  };
  const modeVisual = modeVisuals[blockSettings.mode];
  const homeActionColor = modeVisual.action;
  const orderActionColor = modeVisual.action;
  const orderFieldLabelColor = modeVisual.modeCardSubText;
  const orderFieldBg = modeVisual.orderBg;
  const orderFieldText = modeVisual.valueColor;
  const orderPlaceholder = modeVisual.dimText;
  const orderModalTitleColor = modeVisual.valueColor;
  const orderModalCloseColor = modeVisual.labelColor;
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
    const modeEmoji = MODE_LABELS[blockSettings.mode].emoji;
    const cooldown = blockSettings.cooldowns[blockSettings.mode];
    const modeDesc = MODE_LABELS[blockSettings.mode].desc;

    return (
      <Pressable
        onLongPress={openModeSwitchOptions}
        delayLongPress={280}
        style={{
          borderRadius: 28,
          paddingHorizontal: 22,
          paddingVertical: 24,
          backgroundColor: modeVisual.cardSurface,
          borderWidth: 1,
          borderColor: modeVisual.cardBorder,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: modeVisual.modeCardTint, top: -160, right: -100, opacity: 0.22 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: modeVisual.accentGlow, bottom: -90, left: -50, opacity: 0.16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: modeVisual.labelColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' }}>Active mode</Text>
          <View style={{ backgroundColor: modeVisual.modeCardGlow, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: modeVisual.modeCardSubText, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>Hold to switch</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
          <Text style={{ color: modeVisual.modeCardText, fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.5 }}>{modeLabel}</Text>
          <Text style={{ fontSize: 26, marginBottom: 6 }}>{modeEmoji}</Text>
        </View>
        <Text style={{ color: modeVisual.modeCardSubText, fontSize: 13, fontWeight: '400', lineHeight: 19, marginBottom: 16 }}>{modeDesc}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ backgroundColor: modeVisual.modeCardGlow, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: modeVisual.modeCardSubText, fontSize: 11, fontWeight: '700' }}>⏱ {cooldown}m cooldown</Text>
          </View>
          <View style={{ backgroundColor: modeVisual.modeCardGlow, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: modeVisual.modeCardSubText, fontSize: 11, fontWeight: '700' }}>
              {blockState.isShieldActive ? '🔴 Blocking' : blockSettings.enabled ? '🟢 Active' : '⚪ Off'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: 'transparent', paddingTop: 14 }]}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => setActiveTab('settings')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: modeVisual.action,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
              {(userName?.trim()?.[0] ?? 'U').toUpperCase()}
            </Text>
          </Pressable>
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: modeVisual.labelColor, letterSpacing: 0.8, textTransform: 'uppercase' }}>Welcome back</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: modeVisual.valueColor, marginTop: 1 }}>
              {userName || 'there'}
            </Text>
          </View>
        </View>
      </View>

      {renderModeSelector()}

      {/* Shield active banner */}
      {blockState.isShieldActive && (
        <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: modeVisual.modeCardGlow }}>
          <Text style={{ color: modeVisual.modeCardText, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>
            {blockState.activeBlockType === 'budget' ? '🔴 Over-budget block active' : '❄️ Precautionary block active'}
          </Text>
          <Pressable
            onPress={() => setShowOverrideFlow(true)}
            style={{ backgroundColor: homeActionColor, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Request override</Text>
          </Pressable>
        </View>
      )}

      {/* Auto-shift notice */}
      {blockState.autoShiftedFromPrecau && (
        <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: modeVisual.modeCardGlow }}>
          <Text style={{ color: modeVisual.accentGlow, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
            Over budget — auto-shifted to Gentle mode
          </Text>
        </View>
      )}

      {/* Precau recommendation */}
      {showPrecauRecommendation && (
        <Pressable
          onPress={() => handleSetMode('precautionary')}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginBottom: 14, backgroundColor: modeVisual.cardSurface, borderWidth: 1, borderColor: modeVisual.cardBorder }}
        >
          <Text style={{ color: modeVisual.labelColor, fontWeight: '600', fontSize: 11 }}>
            💡 Under budget — switch to Precautionary
          </Text>
        </Pressable>
      )}

      {/* Budget row */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: modeVisual.cardSurface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: modeVisual.cardBorder }}>
          <Text style={{ color: modeVisual.labelColor, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' }}>Weekly spend</Text>
          <Text style={{ fontSize: 32, fontWeight: '800', color: modeVisual.valueColor, marginTop: 8, letterSpacing: -1 }}>${totalSpend.toFixed(0)}</Text>
          <Text style={{ marginTop: 4, color: modeVisual.dimText, fontSize: 12 }}>of ${weeklyBudget} budget</Text>
          <View style={{ marginTop: 14, height: 4, borderRadius: 999, backgroundColor: modeVisual.progressTrack }}>
            <View style={{ height: 4, borderRadius: 999, backgroundColor: overBudget ? '#FF4444' : modeVisual.accentGlow, width: `${budgetProgress * 100}%` }} />
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: modeVisual.cardSurface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: modeVisual.cardBorder }}>
          <Text style={{ color: modeVisual.labelColor, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' }}>Remaining</Text>
          <Text style={{ fontSize: 32, fontWeight: '800', color: overBudget ? '#FF4444' : modeVisual.accentGlow, marginTop: 8, letterSpacing: -1 }}>${remaining.toFixed(0)}</Text>
          <Text style={{ marginTop: 4, color: modeVisual.dimText, fontSize: 12 }}>before lock</Text>
        </View>
      </View>

      {/* Streak card */}
      <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: modeVisual.cardBorder, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: modeVisual.labelColor, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' }}>Streak</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: modeVisual.valueColor, marginTop: 4, letterSpacing: -0.3 }}>3 days</Text>
          </View>
          <Text style={{ fontSize: 26 }}>🔥</Text>
        </View>
        {blockState.overridesThisWeek > 0 && (
          <Text style={{ color: modeVisual.dimText, fontWeight: '500', marginTop: 6, fontSize: 11 }}>
            {blockState.overridesThisWeek} override(s) this week
          </Text>
        )}
      </View>

      {/* Shielded apps card */}
      <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: modeVisual.cardBorder, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: modeVisual.labelColor, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' }}>Shielded apps</Text>
            <Text style={{ color: modeVisual.valueColor, fontWeight: '800', fontSize: 16, letterSpacing: -0.3, marginTop: 3 }}>
              {blockSettings.selectedAppCount > 0 ? `${blockSettings.selectedAppCount} protected` : 'None selected'}
            </Text>
            <Text numberOfLines={1} style={{ color: modeVisual.dimText, fontWeight: '500', marginTop: 2, fontSize: 11 }}>
              {blockSettings.selectedAppCount > 0
                ? (selectedAppLabels.length > 0
                  ? selectedAppLabels.slice(0, 3).join(', ') + (selectedAppLabels.length > 3 ? ` +${selectedAppLabels.length - 3}` : '')
                  : `${blockSettings.selectedAppCount} protected selection(s)`)
                : 'Choose delivery apps to shield from impulse orders.'}
            </Text>
          </View>
          <Pressable
            onPress={handleSelectApps}
            style={{ backgroundColor: modeVisual.action, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
              {blockSettings.selectedAppCount > 0 ? 'Manage apps' : 'Select apps'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Recent orders */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.3 }}>Recent orders</Text>
        <Pressable onPress={() => setActiveTab('orders')}>
          <Text style={{ color: modeVisual.accentGlow, fontWeight: '700', fontSize: 13 }}>View all</Text>
        </Pressable>
      </View>
      {homeRecentOrders.length === 0 && (
        <Text style={{ color: modeVisual.dimText, fontSize: 13, marginBottom: 12 }}>No orders yet. Add one in the Orders tab.</Text>
      )}
      {homeRecentOrders.slice(0, 3).map((order) => (
        <View
          key={order.id}
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: modeVisual.orderBg,
            borderWidth: 1,
            borderColor: modeVisual.orderBorder,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: modeVisual.orderIconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 16 }}>{getOrderEmoji(order.vendor, order.amount)}</Text>
            </View>
            <View>
              <Text style={{ fontWeight: '700', color: modeVisual.valueColor, fontSize: 14 }}>{order.vendor}</Text>
              <Text style={{ marginTop: 3, color: modeVisual.dimText, fontSize: 12 }}>{formatOrderDate(order.ordered_at)}</Text>
            </View>
          </View>
          <Text style={{ fontWeight: '800', color: modeVisual.orderAmount, fontSize: 15 }}>-${order.amount.toFixed(2)}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderOrders = () => (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={{ marginBottom: 20, paddingTop: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Orders & Spend</Text>
          <Text style={{ fontSize: 13, color: modeVisual.labelColor, marginTop: 4, fontWeight: '500' }}>Track every delivery order</Text>
        </View>

        {/* Add order card */}
        <Pressable
          onPress={() => setShowAddOrderModal(true)}
          style={{
            backgroundColor: modeVisual.modeCardBase,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: modeVisual.modeCardGlow,
            padding: 20,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: modeVisual.modeCardTint, top: -110, right: -60, opacity: 0.12 }} />
          <View>
            <Text style={{ color: modeVisual.labelColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>New entry</Text>
            <Text style={{ color: modeVisual.modeCardText, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }}>Log your next order</Text>
          </View>
          <View style={{ backgroundColor: orderActionColor, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ Add</Text>
          </View>
        </Pressable>

        {/* Section header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: modeVisual.valueColor, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 }}>Recent orders</Text>
          <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: modeVisual.cardBorder }}>
            <Text style={{ color: modeVisual.dimText, fontSize: 11, fontWeight: '700' }}>{orders.length} total</Text>
          </View>
        </View>

        {orders.length === 0 ? (
          <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: modeVisual.cardBorder, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, marginBottom: 10 }}>🛒</Text>
            <Text style={{ color: modeVisual.valueColor, fontWeight: '700', fontSize: 16, marginBottom: 6 }}>No orders yet</Text>
            <Text style={{ color: modeVisual.dimText, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>Tap Add to log your first delivery this week.</Text>
          </View>
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              style={{
                backgroundColor: modeVisual.orderBg,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: modeVisual.orderBorder,
                padding: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
              onLongPress={() =>
                Alert.alert('Delete order?', `${order.vendor} — $${order.amount.toFixed(2)}`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDeleteOrder(order.id) },
                ])
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: modeVisual.orderIconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 17 }}>{getOrderEmoji(order.vendor, order.amount)}</Text>
                </View>
                <View>
                  <Text style={{ fontWeight: '700', color: modeVisual.valueColor, fontSize: 14 }}>{order.vendor}</Text>
                  <Text style={{ marginTop: 3, color: modeVisual.dimText, fontSize: 12 }}>{formatOrderDate(order.ordered_at)}</Text>
                </View>
              </View>
              <Text style={{ fontWeight: '800', color: modeVisual.orderAmount, fontSize: 15 }}>-${order.amount.toFixed(2)}</Text>
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
                    style={[styles.vendorMenuItem, { borderBottomColor: modeVisual.orderBorder }]}
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

  const avgOrderAmount = ordersThisWeek.length > 0 ? totalSpend / ordersThisWeek.length : 0;
  const moneySaved = Math.max(weeklyBudget - totalSpend, 0);
  const budgetUsedPercent = Math.round(budgetProgress * 100);

  const weekdaySpend = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const order of ordersThisWeek) {
      const day = new Date(order.ordered_at).getDay();
      totals[day] += order.amount;
    }
    return totals;
  }, [ordersThisWeek]);

  const topVendorShare = useMemo(() => {
    if (!vendorBreakdown.length || totalSpend <= 0) return 0;
    return Math.round((vendorBreakdown[0].total / totalSpend) * 100);
  }, [vendorBreakdown, totalSpend]);

  const homeRecentOrders = useMemo(
    () => orders.filter((order) => getWeekStartIso(order.ordered_at) === homeWeekStartIso),
    [orders, homeWeekStartIso],
  );

  const highestSpendDay = useMemo(() => {
    let max = 0;
    let idx = 0;
    weekdaySpend.forEach((amount, i) => {
      if (amount > max) {
        max = amount;
        idx = i;
      }
    });
    return { amount: max, label: WEEKDAY_LABELS[idx] };
  }, [weekdaySpend]);

  const projectionForMonth = Math.round(avgOrderAmount * Math.max(orders.length / 1.2, 10));
  const weeklyBurnRate = Math.round((totalSpend / Math.max(weeklyBudget, 1)) * 100);
  const maxWeekdaySpend = Math.max(...weekdaySpend, 1);

  const renderReports = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={{ marginBottom: 20, paddingTop: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Reports</Text>
        <Text style={{ fontSize: 13, color: modeVisual.labelColor, marginTop: 4, fontWeight: '500' }}>Actionable insights from your actual behavior</Text>
      </View>

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: modeVisual.labelColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Key numbers</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Spent', value: `$${totalSpend.toFixed(0)}`, hint: `${budgetUsedPercent}% used` },
            { label: 'Remaining', value: `$${moneySaved.toFixed(0)}`, hint: 'left this week' },
            { label: 'Orders', value: `${ordersThisWeek.length}`, hint: `avg $${avgOrderAmount.toFixed(1)}` },
            { label: 'Overrides', value: `${blockState.overridesThisWeek}`, hint: blockState.overridesThisWeek === 0 ? 'strong discipline' : 'friction used' },
          ].map((item) => (
            <View key={item.label} style={{ width: '48%', backgroundColor: modeVisual.orderBg, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }}>{item.label}</Text>
              <Text style={{ color: modeVisual.valueColor, fontSize: 20, fontWeight: '800', marginTop: 3 }}>{item.value}</Text>
              <Text style={{ color: modeVisual.dimText, fontSize: 10, marginTop: 2 }}>{item.hint}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: modeVisual.labelColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>Day-of-week spend pattern</Text>
        <Text style={{ color: modeVisual.dimText, fontSize: 12, marginBottom: 10 }}>Your trigger days stand out visually.</Text>
        <View style={{ gap: 8 }}>
          {WEEKDAY_LABELS.map((day, idx) => {
            const amount = weekdaySpend[idx];
            const widthPercent = Math.max((amount / maxWeekdaySpend) * 100, amount > 0 ? 8 : 2);
            return (
              <View key={day} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ width: 32, color: modeVisual.valueColor, fontSize: 11, fontWeight: '700' }}>{day}</Text>
                <View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: modeVisual.progressTrack, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: 10,
                      width: `${widthPercent}%`,
                      borderRadius: 999,
                      backgroundColor: amount === highestSpendDay.amount && amount > 0 ? modeVisual.orderAmount : modeVisual.accentGlow,
                    }}
                  />
                </View>
                <Text style={{ width: 44, textAlign: 'right', color: modeVisual.dimText, fontSize: 11 }}>${amount.toFixed(0)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: modeVisual.labelColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>What matters most right now</Text>
        <View style={{ gap: 12 }}>
          <Text style={{ color: modeVisual.valueColor, fontSize: 13, lineHeight: 20 }}>
            • <Text style={{ fontWeight: '700' }}>Burn rate:</Text> You are at {weeklyBurnRate}% of weekly budget.
            {weeklyBurnRate >= 90 ? ' Set a no-order buffer for the next 2 days.' : ' Keep this pace and you should finish under budget.'}
          </Text>
          <Text style={{ color: modeVisual.valueColor, fontSize: 13, lineHeight: 20 }}>
            • <Text style={{ fontWeight: '700' }}>Dependency risk:</Text>{' '}
            {vendorBreakdown.length ? `${vendorBreakdown[0].vendor} drives ${topVendorShare}% of your spend.` : 'No dominant vendor yet.'}
          </Text>
          <Text style={{ color: modeVisual.valueColor, fontSize: 13, lineHeight: 20 }}>
            • <Text style={{ fontWeight: '700' }}>Peak trigger day:</Text>{' '}
            {highestSpendDay.amount > 0
              ? `${highestSpendDay.label} is highest at $${highestSpendDay.amount.toFixed(2)}. Pre-plan one backup meal.`
              : 'No spending pattern yet this week.'}
          </Text>
          <Text style={{ color: modeVisual.valueColor, fontSize: 13, lineHeight: 20 }}>
            • <Text style={{ fontWeight: '700' }}>Projected monthly spend:</Text> ~${projectionForMonth} if current order size/frequency continues.
          </Text>
        </View>
      </View>

      {vendorBreakdown.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: modeVisual.labelColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Top vendors</Text>
          {vendorBreakdown.slice(0, 5).map((v) => (
            <View key={v.vendor} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <View>
                  <Text style={{ color: modeVisual.valueColor, fontWeight: '700', fontSize: 14 }}>{v.vendor}</Text>
                  <Text style={{ color: modeVisual.dimText, fontSize: 11, marginTop: 2 }}>{v.count} order(s)</Text>
                </View>
                <Text style={{ color: modeVisual.orderAmount, fontWeight: '800', fontSize: 15 }}>${v.total.toFixed(2)}</Text>
              </View>
              <View style={{ height: 4, borderRadius: 999, backgroundColor: modeVisual.progressTrack }}>
                <View style={{ height: 4, borderRadius: 999, backgroundColor: modeVisual.accentGlow, width: `${(v.total / Math.max(totalSpend, 1)) * 100}%` }} />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderChat = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={{ marginBottom: 20, paddingTop: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Chat Coach</Text>
          <Pressable
            onPress={handleClearChatHistory}
            style={{ backgroundColor: modeVisual.orderBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
          >
            <Text style={{ color: modeVisual.labelColor, fontSize: 12, fontWeight: '700' }}>Clear</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 13, color: modeVisual.labelColor, marginTop: 6, fontWeight: '500' }}>Get quick budget and meal guidance</Text>
      </View>

      <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, padding: 14, marginBottom: 12 }}>
        {chatMessages.map((message) => (
          <View
            key={message.id}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              backgroundColor: message.role === 'user' ? modeVisual.action : modeVisual.orderBg,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: message.role === 'user' ? '#FFFFFF' : modeVisual.valueColor, fontSize: 13, lineHeight: 19 }}>
              {message.content}
            </Text>
          </View>
        ))}
        {isChatSending ? (
          <Text style={{ color: modeVisual.dimText, fontSize: 12, marginTop: 2 }}>Thinking…</Text>
        ) : null}
        {chatError ? (
          <Text style={{ color: '#FF7D7D', fontSize: 12, marginTop: 2 }}>{chatError}</Text>
        ) : null}
      </View>

      <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Ask for meal ideas, budget tips, or anti-craving plans"
          placeholderTextColor={modeVisual.dimText}
          style={{ flex: 1, color: modeVisual.valueColor, fontSize: 14, paddingHorizontal: 8, paddingVertical: 10 }}
          editable={!isChatSending}
          onSubmitEditing={() => {
            void sendChatMessage();
          }}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => {
            void sendChatMessage();
          }}
          disabled={isChatSending || !chatInput.trim()}
          style={{
            backgroundColor: isChatSending || !chatInput.trim() ? modeVisual.progressTrack : modeVisual.action,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderSettings = () => {
    const subscriptionTier = subscriptionPlan === 'none'
      ? 'Free'
      : `${subscriptionPlan[0].toUpperCase()}${subscriptionPlan.slice(1)}${trialActive ? ' (Trial)' : ''}`;

    const normalizedAgeInput = accountAgeInput.replace(/[^0-9]/g, '').slice(0, 3);
    const hasAccountChanges = accountNameInput.trim() !== userName.trim() || normalizedAgeInput !== savedAccountAge;

    if (activeSettingsScreen === 'account') {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setActiveSettingsScreen(null)} style={{ marginBottom: 10 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, fontWeight: '700' }}>← Back to settings</Text>
            </Pressable>
            <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Account</Text>
          </View>
          <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, borderWidth: 1, borderColor: modeVisual.cardBorder, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 16 }}>
            <Text style={{ color: modeVisual.labelColor, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>Name</Text>
            <TextInput
              value={accountNameInput}
              onChangeText={setAccountNameInput}
              placeholder="Enter your name"
              placeholderTextColor={modeVisual.dimText}
              style={{ marginTop: 8, marginBottom: 14, borderWidth: 1, borderColor: modeVisual.cardBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: modeVisual.valueColor, fontSize: 15, fontWeight: '600' }}
            />

            <Text style={{ color: modeVisual.labelColor, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>Age</Text>
            <TextInput
              value={accountAgeInput}
              onChangeText={(value) => setAccountAgeInput(value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="Enter your age"
              placeholderTextColor={modeVisual.dimText}
              keyboardType="number-pad"
              style={{ marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: modeVisual.cardBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: modeVisual.valueColor, fontSize: 15, fontWeight: '600' }}
            />

            {hasAccountChanges ? (
              <Pressable onPress={() => { void handleSaveAccountInfo(); }} style={{ backgroundColor: modeVisual.action, borderRadius: 12, alignItems: 'center', paddingVertical: 11, marginBottom: 16 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Save changes</Text>
              </Pressable>
            ) : null}

            <View style={{ borderTopWidth: 1, borderTopColor: modeVisual.cardBorder, paddingTop: 14 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>Email</Text>
              <Text style={{ color: modeVisual.valueColor, fontSize: 15, fontWeight: '600', marginTop: 6 }}>{email ?? 'Not available'}</Text>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: modeVisual.cardBorder, paddingTop: 14, marginTop: 14 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>Subscription tier</Text>
              <Text style={{ color: modeVisual.valueColor, fontSize: 15, fontWeight: '600', marginTop: 6 }}>{subscriptionTier}</Text>
            </View>
          </View>
        </ScrollView>
      );
    }

    if (activeSettingsScreen === 'blocker') {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setActiveSettingsScreen(null)} style={{ marginBottom: 10 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, fontWeight: '700' }}>← Back to settings</Text>
            </Pressable>
            <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Blocker settings</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 4 }}>Configure apps and mode behavior.</Text>
          </View>

          <Pressable style={[styles.primaryButton, { backgroundColor: modeVisual.action, marginBottom: 14 }]} onPress={handleSelectApps}>
            <Text style={styles.primaryButtonText}>
              {blockSettings.selectedAppCount > 0
                ? `Change apps (${blockSettings.selectedAppCount} selected)`
                : 'Select apps to block'}
            </Text>
          </Pressable>

          <Text style={{ color: modeVisual.labelColor, fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 }}>Cooldown per mode (minutes)</Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {(['gentle', 'moderate', 'precautionary'] as BlockMode[]).map((m) => (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: modeVisual.cardSurface, borderWidth: 1, borderColor: modeVisual.cardBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: modeVisual.valueColor, fontSize: 14, fontWeight: '700' }}>{MODE_LABELS[m].emoji} {MODE_LABELS[m].label}</Text>
                <TextInput
                  value={String(blockSettings.cooldowns[m])}
                  onChangeText={(v) => {
                    void handleSetCooldown(m, v);
                  }}
                  keyboardType="number-pad"
                  style={{ minWidth: 64, textAlign: 'center', color: modeVisual.valueColor, borderWidth: 1, borderColor: modeVisual.cardBorder, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, fontWeight: '700' }}
                />
              </View>
            ))}
          </View>
          <Text style={{ color: modeVisual.dimText, fontSize: 12, marginBottom: 16 }}>How long a user waits before override unlock in each mode.</Text>

          {blockState.isShieldActive && blockState.activeBlockType === 'budget' && (
            <View style={[styles.blockStatusBanner, { backgroundColor: modeVisual.modeCardGlow, borderColor: modeVisual.modeCardTint }]}> 
              <Text style={[styles.blockStatusText, { color: modeVisual.modeCardText }]}> 
                🔴 Over-budget block is active
              </Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (activeSettingsScreen === 'faq') {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setActiveSettingsScreen(null)} style={{ marginBottom: 10 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, fontWeight: '700' }}>← Back to settings</Text>
            </Pressable>
            <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>FAQ</Text>
          </View>
          {[
            { q: 'How does blocking work?', a: 'The app evaluates your spending against your budget and selected mode, then applies iOS Screen Time shields to selected delivery apps.' },
            { q: 'When does my weekly budget reset?', a: 'Your budget is tracked weekly. You can update the weekly amount anytime from Settings > Budget.' },
            { q: 'Will chat coach history be saved?', a: 'Yes. Chat history is tied to your account and restored when you sign back in.' },
            { q: 'Can I customize blocker intensity?', a: 'Yes. Choose Gentle, Moderate, or Precautionary and tune cooldowns per mode in Blocker settings.' },
          ].map((item) => (
            <View key={item.q} style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 14, borderWidth: 1, borderColor: modeVisual.cardBorder, padding: 14, marginBottom: 10 }}>
              <Text style={{ color: modeVisual.valueColor, fontSize: 14, fontWeight: '700' }}>{item.q}</Text>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 6, lineHeight: 19 }}>{item.a}</Text>
            </View>
          ))}
        </ScrollView>
      );
    }

    if (activeSettingsScreen === 'contact') {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setActiveSettingsScreen(null)} style={{ marginBottom: 10 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, fontWeight: '700' }}>← Back to settings</Text>
            </Pressable>
            <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Contact support</Text>
          </View>
          <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 14, borderWidth: 1, borderColor: modeVisual.cardBorder, padding: 16 }}>
            <Text style={{ color: modeVisual.valueColor, fontSize: 14, fontWeight: '700' }}>Need help with billing, blocking, or bugs?</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 8, lineHeight: 20 }}>Email us at support@undelivery.app with your account email and a short issue description. We usually respond within 24–48 hours.</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>For billing issues, include your subscription tier and purchase date to speed up resolution.</Text>
          </View>
        </ScrollView>
      );
    }

    if (activeSettingsScreen === 'privacy') {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setActiveSettingsScreen(null)} style={{ marginBottom: 10 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, fontWeight: '700' }}>← Back to settings</Text>
            </Pressable>
            <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Privacy Policy</Text>
          </View>
          <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 14, borderWidth: 1, borderColor: modeVisual.cardBorder, padding: 16 }}>
            <Text style={{ color: modeVisual.valueColor, fontSize: 14, fontWeight: '700' }}>Effective date: February 24, 2026</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>We collect account data (name, email), budget and order data, blocker settings, and chat history to provide core app functionality. We use this data to operate blocking workflows, display reports, and sync progress across sessions.</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>We do not sell personal data. Subscription status is processed via RevenueCat and Apple. You can request deletion of account data by contacting support@undelivery.app from your account email.</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>By using the app, you consent to this processing for service delivery, security, analytics required for app operation, and legal compliance.</Text>
          </View>
        </ScrollView>
      );
    }

    if (activeSettingsScreen === 'terms') {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ marginBottom: 22, paddingTop: 4 }}>
            <Pressable onPress={() => setActiveSettingsScreen(null)} style={{ marginBottom: 10 }}>
              <Text style={{ color: modeVisual.labelColor, fontSize: 13, fontWeight: '700' }}>← Back to settings</Text>
            </Pressable>
            <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Terms of Use</Text>
          </View>
          <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 14, borderWidth: 1, borderColor: modeVisual.cardBorder, padding: 16 }}>
            <Text style={{ color: modeVisual.valueColor, fontSize: 14, fontWeight: '700' }}>Effective date: February 24, 2026</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>Undelivery provides budgeting and app-blocking assistance tools. It is not financial, medical, or legal advice. You are responsible for your spending and device usage decisions.</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>Subscriptions auto-renew unless canceled in Apple ID settings at least 24 hours before renewal. Payment is charged to your Apple account according to the selected plan and trial terms shown before purchase.</Text>
            <Text style={{ color: modeVisual.labelColor, fontSize: 13, marginTop: 10, lineHeight: 20 }}>You agree not to misuse the service, reverse engineer it, or use it in ways that violate applicable law. We may suspend accounts for abuse, fraud, or security risks.</Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ marginBottom: 24, paddingTop: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: modeVisual.valueColor, letterSpacing: -0.8 }}>Settings</Text>
        </View>

        <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, borderWidth: 1, borderColor: modeVisual.cardBorder, overflow: 'hidden', marginBottom: 12 }}>
          {[
            { label: 'Account', value: '→', onPress: () => setActiveSettingsScreen('account') },
            { label: 'Budget', value: `$${weeklyBudget} / week`, onPress: () => setActiveSheet('budget') },
            { label: 'App blocker', value: blockState.isShieldActive ? '🔴 Blocking' : blockSettings.enabled ? '🟢 Ready' : 'Off', onPress: () => setActiveSettingsScreen('blocker') },
            { label: 'Rate us', value: 'App Store', onPress: () => { void handleRateApp(); } },
            { label: 'Privacy policy', value: '→', onPress: () => setActiveSettingsScreen('privacy') },
            { label: 'Terms of use', value: '→', onPress: () => setActiveSettingsScreen('terms') },
          ].map((row, i, arr) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: modeVisual.cardBorder }}
            >
              <Text style={{ color: modeVisual.valueColor, fontWeight: '600', fontSize: 15 }}>{row.label}</Text>
              <Text style={{ color: modeVisual.labelColor, fontWeight: '600', fontSize: 14 }}>{row.value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, borderWidth: 1, borderColor: modeVisual.cardBorder, overflow: 'hidden', marginBottom: 12 }}>
          {[
            { label: 'FAQ', value: 'Open', onPress: () => setActiveSettingsScreen('faq') },
            { label: 'Contact support', value: 'Open', onPress: () => setActiveSettingsScreen('contact') },
          ].map((row, i, arr) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: modeVisual.cardBorder }}
            >
              <Text style={{ color: modeVisual.valueColor, fontWeight: '600', fontSize: 15 }}>{row.label}</Text>
              <Text style={{ color: modeVisual.labelColor, fontWeight: '600', fontSize: 14 }}>{row.value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ backgroundColor: modeVisual.cardSurface, borderRadius: 20, borderWidth: 1, borderColor: modeVisual.cardBorder, overflow: 'hidden', marginBottom: 12 }}>
          <Pressable
            onPress={onSignOut}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16 }}
          >
            <Text style={{ color: '#FF4444', fontWeight: '600', fontSize: 15 }}>Sign out</Text>
            <Text style={{ color: modeVisual.dimText, fontWeight: '600', fontSize: 14 }}>↗</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  const sheetBg = modeVisual.modeCardBase;
  const sheetBorder = modeVisual.modeCardGlow;
  const sheetTitleColor = modeVisual.valueColor;
  const sheetCloseColor = modeVisual.labelColor;
  const sheetLabelColor = modeVisual.labelColor;
  const sheetHintColor = modeVisual.dimText;
  const sheetInputBg = modeVisual.cardSurface;
  const sheetInputBorder = modeVisual.cardBorder;
  const sheetInputText = modeVisual.valueColor;
  const sheetDividerColor = modeVisual.cardBorder;

  const renderSheet = () => {
    if (!activeSheet) return null;
    if (activeSheet === 'budget') {
      return (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveSheet(null)}
        >
          <View style={styles.reminderOverlayBackdrop}>
            <View style={[styles.reminderOverlayCard, { backgroundColor: sheetBg, borderColor: sheetBorder }]}> 
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: sheetTitleColor }]}>Budget settings</Text>
                <Pressable onPress={() => setActiveSheet(null)}>
                  <Text style={[styles.sheetClose, { color: sheetCloseColor }]}>Close</Text>
                </Pressable>
              </View>
              <Text style={[styles.sheetLabel, { color: sheetLabelColor }]}>Weekly budget</Text>
              <TextInput
                value={String(weeklyBudget)}
                onChangeText={(value) => {
                  const num = Number.parseInt(value || '0', 10);
                  setWeeklyBudget(num);
                  void updateBudget({ weekly_limit: num });
                }}
                keyboardType="number-pad"
                style={[styles.input, { backgroundColor: sheetInputBg, borderColor: sheetInputBorder, color: sheetInputText }]}
              />
              <Text style={[styles.sheetHint, { color: sheetHintColor }]}>Blocks trigger once you hit the limit.</Text>
            </View>
          </View>
        </Modal>
      );
    }
    if (activeSheet === 'opportunity') {
      return (
        <View style={[styles.sheet, { backgroundColor: sheetBg, borderColor: sheetBorder }]}> 
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: sheetTitleColor }]}>Opportunity cost</Text>
            <Pressable onPress={() => setActiveSheet(null)}>
              <Text style={[styles.sheetClose, { color: sheetCloseColor }]}>Close</Text>
            </Pressable>
          </View>
          <Text style={[styles.sheetLabel, { color: sheetLabelColor }]}>Order amount</Text>
          <TextInput
            value={opportunityAmount}
            onChangeText={setOpportunityAmount}
            keyboardType="decimal-pad"
            style={[styles.input, { backgroundColor: sheetInputBg, borderColor: sheetInputBorder, color: sheetInputText }]}
          />
          {GOALS.map((goal) => {
            const amount = Number.parseFloat(opportunityAmount) || 0;
            const ratio = Math.min(amount / goal.target, 1);
            return (
              <View key={goal.id} style={[styles.goalRow, { borderBottomColor: sheetDividerColor }]}>
                <View>
                  <Text style={[styles.goalTitle, { color: sheetTitleColor }]}>{goal.title}</Text>
                  <Text style={[styles.goalHint, { color: sheetHintColor }]}>
                    {goal.unit}{amount.toFixed(0)} / {goal.unit}{goal.target}
                  </Text>
                </View>
                <View style={[styles.goalTrack, { backgroundColor: sheetInputBorder }]}>
                  <View style={[styles.goalFill, { width: `${ratio * 100}%`, backgroundColor: modeVisual.accentGlow }]} />
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    return null;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHome();
      case 'orders':
        return renderOrders();
      case 'reports':
        return renderReports();
      case 'chat':
        return renderChat();
      case 'settings':
        return renderSettings();
      default:
        return renderHome();
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0A0A12' }]}>
        <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#4A5580', fontSize: 15, fontWeight: '600' }}>Loading your data…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (showOverrideFlow && blockState.isShieldActive) {
    return (
      <OverrideFlow
        blockType={blockState.activeBlockType}
        mode={blockSettings.mode}
        cooldownMinutes={blockingService.getEffectiveCooldown()}
        penaltyAmount={null}
        totalSpend={totalSpend}
        weeklyBudget={weeklyBudget}
        savingsGoals={savingsGoals}
        onChooseHealthyOption={handleHealthyOptionChosen}
        onComplete={() => {
          setLastOverrideAt(Date.now());
          setShowOverrideFlow(false);
          refreshBlockState();
        }}
        onCancel={() => setShowOverrideFlow(false)}
      />
    );
  }

  const rootBg = modeVisual.modeCardBase;
  const tabBarBg = modeVisual.navBg;
  const tabBarBorder = modeVisual.navBorder;
  const tabTextColor = modeVisual.navText;
  const tabActiveTextColor = modeVisual.navActiveText;
  const tabActiveBg = modeVisual.navActiveBg;

  return (
    <View style={[styles.container, { backgroundColor: rootBg }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {renderContent()}
        {renderSheet()}
        <View style={[styles.tabBar, { backgroundColor: tabBarBg, borderColor: tabBarBorder }]}>
          {([
            { key: 'home' },
            { key: 'orders' },
            { key: 'chat' },
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A12',
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
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontWeight: '800',
    fontSize: 17,
  },
  sheetClose: {
    fontWeight: '600',
    fontSize: 14,
  },
  sheetLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    fontWeight: '700',
  },
  sheetHint: {
    fontSize: 12,
    lineHeight: 17,
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
    fontWeight: '600',
    fontSize: 14,
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
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
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
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  blockStatusText: {
    fontWeight: '700',
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
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    width: 52,
    textAlign: 'center',
  },
  scheduleColon: {
    fontSize: 20,
    fontWeight: '700',
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
