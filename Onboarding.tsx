import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import appleAuth from '@invertase/react-native-apple-authentication';
import { supabase } from './supabaseClient';
import { saveOnboardingData } from './DataService';

const COLORS = {
  navy: '#0F1A2E',
  navySoft: '#1C2940',
  sky: '#F0F4FF',
  skySoft: '#F7F9FF',
  ink: '#1A2138',
  inkSoft: '#3D4663',
  muted: '#8892A8',
  white: '#FFFFFF',
  cream: '#F8FAFF',
  coral: '#E8734A',
  sage: '#5EC26A',
  gold: '#F0B429',
  warmGray: '#EEF1F8',
  softBorder: '#E2E8F4',
  accent: '#4A7CFF',
  accentSoft: '#E8EFFE',
  accentLight: '#6B9AFF',
  cardBg: '#FFFFFF',
  screenBg: '#F4F7FE',
};

const PRO_ENTITLEMENT_ID = 'undelivery Pro';
const ONBOARDING_DRAFT_KEY_PREFIX = '@onboarding_draft_v2';
const MIN_WEEKLY_BUDGET = 10;
const MAX_WEEKLY_BUDGET = 200;
const { ScreenTimeManager } = NativeModules;

const getOnboardingDraftKey = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  return `${ONBOARDING_DRAFT_KEY_PREFIX}_${data?.user?.id ?? 'guest'}`;
};
const IOS_BUNDLE_ID = 'com.quitbite.quitbite';
const TERMS_URL = 'https://undelivery.app/terms';
const PRIVACY_URL = 'https://undelivery.app/privacy';
const REQUIRED_AFFIRMATION = 'I commit to protecting my health and money by reducing food delivery this week.';
const SUBSCRIPTION_PRODUCT_IDS = {
  weekly: 'com.quitbite.quitbite.weekly',
  monthly: 'com.quitbite.quitbite.monthly',
  annual: 'com.quitbite.quitbite.yearly',
} as const;

const SCREENS = [
  { key: 'splash', type: 'splash' },
  { key: 'welcome', type: 'welcome' },
  {
    key: 'fact-1',
    type: 'fact',
    title: 'Did you know?',
    body:
      'Most people think they spend a little on delivery, but after fees and tips it often ends up being nearly double.',
  },
  {
    key: 'q1',
    type: 'choice',
    label: 'Question 1',
    question: 'How much do you spend on delivery per week?',
    options: ['$0\u2013$25', '$26\u2013$50', '$51\u2013$100', '$101\u2013$200', '$200+'],
  },
  {
    key: 'q2',
    type: 'wheel',
    label: 'Question 2',
    question: 'How many times do you order delivery in a week?',
    options: Array.from({ length: 15 }, (_, i) => `${i + 1}`),
    suffix: 'orders',
    cta: 'Confirm',
  },
  {
    key: 'q3',
    type: 'choice',
    label: 'Question 3',
    question: 'What are your main reasons for ordering delivery?',
    options: ['Convenience', 'Cravings', 'No time to cook', 'Stress/comfort', 'Habit'],
    multiSelect: true,
  },
  {
    key: 'q4',
    type: 'wheel',
    label: 'Question 4',
    question: 'How old are you?',
    options: Array.from({ length: 111 }, (_, i) => `${i + 10}`),
    suffix: 'years old',
    cta: 'Confirm',
  },
  {
    key: 'q5',
    type: 'choice',
    label: 'Question 5',
    question: 'Would you say your delivery food is mostly healthy or unhealthy?',
    options: ['Mostly healthy', 'Mostly unhealthy', 'A mix of both'],
  },
  {
    key: 'q6',
    type: 'choice',
    label: 'Question 6',
    question: 'How often do you regret an order afterward?',
    options: ['Often', 'Sometimes', 'Rarely', 'Never'],
  },
  {
    key: 'q7',
    type: 'choice',
    label: 'Question 7',
    question: 'Where would you rather put this money?',
    options: ['Travel', 'Savings', 'Fitness', 'Paying debt', 'Other goals'],
  },
  {
    key: 'q8',
    type: 'choice',
    label: 'Question 8',
    question: 'How often do you cook at home right now?',
    options: ['Daily', 'A few times a week', 'Rarely', 'Almost never'],
  },
  {
    key: 'consequences',
    type: 'consequences-combined',
    title: 'The real cost of delivery addiction',
  },
  {
    key: 'results-prep',
    type: 'fact-progress',
    title: 'Did you know?',
    body:
      'When people see what one order really costs over time, they are much more likely to skip it.',
    progressLabel: 'Preparing your results... 88%',
    progressValue: 0.88,
  },
  {
    key: 'results',
    type: 'results',
  },
  {
    key: 'ack-1',
    type: 'ack',
    title: 'Awareness unlocked!',
    body: 'You just took the first step toward breaking delivery habits and saving real money.',
  },
  {
    key: 'ack-2',
    type: 'ack',
    title: 'Progress starts now.',
    body: 'Every skipped order moves you closer to your goals and healthier choices.',
  },
  {
    key: 'name',
    type: 'name',
    title: 'What should we call you?',
  },
  {
    key: 'budget',
    type: 'budget',
    title: 'Set your weekly delivery budget',
  },
  {
    key: 'help-2',
    type: 'help',
    title: 'The bridge to simple cooking',
    body: 'Get quick, realistic steps that help you cook easy home meals',
  },
  {
    key: 'help-3',
    type: 'help',
    title: 'See the opportunity cost',
    body: "Every order shows what you're trading away, so it's easier to make your choice",
  },
  {
    key: 'showcase-1',
    type: 'showcase',
    title: 'Block apps when you overspend',
    body: 'QuitBite automatically blocks delivery apps once you hit your weekly budget.',
    showcaseImage: 'block',
  },
  {
    key: 'showcase-2',
    type: 'showcase',
    title: 'Track every dollar in real time',
    body: 'See exactly where your money goes with weekly breakdowns, streaks and reports.',
    showcaseImage: 'track',
  },
  {
    key: 'placeholder-1',
    type: 'placeholder',
    title: '',
    body: '',
  },
  {
    key: 'financial-goal',
    type: 'choice',
    label: 'Money goal',
    question: 'What would you love to do with the money you save?',
    options: [
      'Build a safety fund for emergencies',
      'Pay off credit card or other debt',
      'Save for a trip or vacation',
      'Save to buy something important',
      'Build long-term wealth and invest',
    ],
    multiSelect: true,
  },
  {
    key: 'permission',
    type: 'permission',
    title: 'Allow app blocking',
    body:
      'QuitBite needs Screen Time permission to block delivery apps when you hit your budget.',
  },
  {
    key: 'select-apps',
    type: 'select-apps',
    title: 'Choose apps to block',
    body: 'Pick the delivery apps you want QuitBite to block when you hit your weekly budget.',
  },
  {
    key: 'rating',
    type: 'rating',
    title: 'Give us a rating!',
    body: 'This helps us deliver more of what you need.',
  },
  {
    key: 'commitment',
    type: 'commitment',
    title: 'Sign your commitment',
    body: 'From this day onward I will:',
  },
  {
    key: 'motivation-1',
    type: 'motivation',
    title: "You're now prepared to reset.",
  },
  {
    key: 'auth-choice',
    type: 'auth-choice',
    title: 'Welcome',
    body: 'Choose how you want to get started.',
  },
  {
    key: 'auth-signup',
    type: 'auth-sign-up',
    title: 'Sign up to continue',
    body: 'Please use one of the following ways to create your account.',
  },
  {
    key: 'auth-signin',
    type: 'auth-sign-in',
    title: 'Sign In',
    body: 'Use one of the following ways to sign in to your account.',
  },
  {
    key: 'auth-email-signup',
    type: 'auth-email-sign-up',
    title: 'Create your account',
    body: 'Use your email and password to create your account.',
  },
  {
    key: 'auth-email-signin',
    type: 'auth-email-sign-in',
    title: 'Welcome back',
    body: 'Sign in with your email and password to continue.',
  },
  {
    key: 'paywall',
    type: 'paywall',
    title: 'Choose your plan',
  },
];

export default function Onboarding({
  onSkipToDashboard,
  onOnboardingComplete,
  startAtWelcome = false,
}: {
  onSkipToDashboard?: () => void;
  onOnboardingComplete?: () => void;
  startAtWelcome?: boolean;
}) {
  const authChoiceIndex = SCREENS.findIndex((screen) => screen.type === 'auth-choice');
  const welcomeIndex = SCREENS.findIndex((screen) => screen.type === 'welcome');
  const initialStep = startAtWelcome && welcomeIndex !== -1 ? welcomeIndex : authChoiceIndex !== -1 ? authChoiceIndex : 0;
  const [step, setStep] = useState(initialStep);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [name, setName] = useState('');
  const [weeklyBudget, setWeeklyBudget] = useState('100');
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'annual' | null>('monthly');
  const [didSignIn, setDidSignIn] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authSignInOnlyFromWelcome, setAuthSignInOnlyFromWelcome] = useState(false);
  const [onboardingSaved, setOnboardingSaved] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoringPurchase, setIsRestoringPurchase] = useState(false);
  const [showPlanOverlay, setShowPlanOverlay] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [selectedAppCount, setSelectedAppCount] = useState(0);
  const [affirmation, setAffirmation] = useState('');
  const ratingPromptShownRef = useRef(false);
  const totalSteps = SCREENS.length;
  const current = SCREENS[step];
  const parsedWeeklyBudget = Number.parseInt(weeklyBudget, 10);
  const isWeeklyBudgetValid = Number.isFinite(parsedWeeklyBudget)
    && parsedWeeklyBudget >= MIN_WEEKLY_BUDGET
    && parsedWeeklyBudget <= MAX_WEEKLY_BUDGET;
  const oauthRedirectUrl = 'com.quitbite.quitbite://login-callback';

  const resolvePackageForPlan = (plan: 'weekly' | 'monthly' | 'annual') => {
    const productId = SUBSCRIPTION_PRODUCT_IDS[plan];
    const byExactProductId = packages.find((pkg) => pkg?.product?.identifier === productId);
    if (byExactProductId) return byExactProductId;

    if (plan === 'weekly') {
      return (
        packages.find((pkg) => pkg?.packageType === 'WEEKLY') ??
        packages.find((pkg) => pkg?.identifier === '$rc_weekly') ??
        packages.find((pkg) => String(pkg?.product?.identifier ?? '').toLowerCase().includes('weekly')) ??
        null
      );
    }

    if (plan === 'annual') {
      return (
        packages.find((pkg) => pkg?.packageType === 'ANNUAL') ??
        packages.find((pkg) => pkg?.identifier === '$rc_annual') ??
        packages.find((pkg) => {
          const id = String(pkg?.product?.identifier ?? '').toLowerCase();
          return id.includes('yearly') || id.includes('annual');
        }) ??
        null
      );
    }

    return (
      packages.find((pkg) => pkg?.packageType === 'MONTHLY') ??
      packages.find((pkg) => pkg?.identifier === '$rc_monthly') ??
      packages.find((pkg) => String(pkg?.product?.identifier ?? '').toLowerCase().includes('monthly')) ??
      null
    );
  };

  useEffect(() => {
    if (startAtWelcome) return;
    const restoreDraft = async () => {
      try {
        const draftKey = await getOnboardingDraftKey();
        const raw = await AsyncStorage.getItem(draftKey);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (typeof draft.step === 'number') setStep(draft.step);
        if (typeof draft.name === 'string') setName(draft.name);
        if (typeof draft.weeklyBudget === 'string') setWeeklyBudget(draft.weeklyBudget);
        if (typeof draft.affirmation === 'string') setAffirmation(draft.affirmation);
        if (typeof draft.selectedAppCount === 'number') setSelectedAppCount(draft.selectedAppCount);
        if (draft.answers && typeof draft.answers === 'object') setAnswers(draft.answers);
      } catch (error) {
        console.warn('Failed to restore onboarding draft', error);
      }
    };
    void restoreDraft();
  }, [startAtWelcome]);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        const draftKey = await getOnboardingDraftKey();
        await AsyncStorage.setItem(
          draftKey,
          JSON.stringify({
            step,
            name,
            weeklyBudget,
            affirmation,
            selectedAppCount,
            answers,
          }),
        );
      } catch (error) {
        console.warn('Failed to save onboarding draft', error);
      }
    };
    void saveDraft();
  }, [
    step,
    name,
    weeklyBudget,
    affirmation,
    selectedAppCount,
    answers,
  ]);

  const handleNext = () => {
    setStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const syncSubscription = async (info: any) => {
    const { data, error } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (error || !userId) return;
    const entitlement = (info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
    const rawPeriodType = entitlement?.periodType ?? null;
    const periodType = rawPeriodType ? String(rawPeriodType).toLowerCase() : null;
    const isTrial = Boolean(entitlement) && periodType === 'trial';
    const expiresDate = entitlement?.expirationDate ?? null;
    const willRenew = entitlement?.willRenew ?? null;
    const productIdentifier = entitlement?.productIdentifier ?? null;
    let subscriptionName: string | null = null;
    let subscriptionPrice: string | null = null;

    if (entitlement && productIdentifier) {
      try {
        const products = await Purchases.getProducts([productIdentifier]);
        const product = products?.[0];
        subscriptionName = product?.title ?? null;
        subscriptionPrice = product?.priceString ?? null;
      } catch {
        const matchedPackage = packages.find((pkg) => pkg?.product?.identifier === productIdentifier);
        subscriptionName = matchedPackage?.product?.title ?? null;
        subscriptionPrice = matchedPackage?.product?.priceString ?? null;
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
  };

  const loadOfferings = async () => {
    setIsLoadingOfferings(true);
    setOfferingsError(null);
    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = (offerings as any)?.current;
      const availablePackages = (currentOffering as any)?.availablePackages ?? [];
      setPackages(availablePackages);
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      await syncSubscription(info);
    } catch (e: any) {
      setOfferingsError(e?.message ?? String(e));
      setPackages([]);
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  useEffect(() => {
    if (current.type !== 'rating') {
      ratingPromptShownRef.current = false;
      return;
    }

    if (ratingPromptShownRef.current) return;
    ratingPromptShownRef.current = true;

    Alert.alert(
      'Enjoying undelivery?',
      'Would you like to rate us on the App Store?',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Rate now',
          onPress: () => {
            void requestAppStoreRating();
          },
        },
      ],
      { cancelable: true },
    );
  }, [current.type]);

  const logInRevenueCat = async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;
    try {
      await Purchases.logIn(userId);
    } catch {
      // Ignore login failures.
    }
  };

  const handleBack = () => {
    // Custom auth back flow
    if (current.type === 'auth-sign-in') {
      const choiceIndex = SCREENS.findIndex((screen) => screen.type === 'auth-choice');
      if (choiceIndex !== -1) {
        setStep(choiceIndex);
        return;
      }
    }
    if (current.type === 'auth-email-sign-in') {
      const signInIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-in');
      if (signInIndex !== -1) {
        setStep(signInIndex);
        return;
      }
    }
    if (current.type === 'auth-email-sign-up') {
      const signUpIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-up');
      if (signUpIndex !== -1) {
        setStep(signUpIndex);
        return;
      }
    }
    setStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkipQuiz = () => {
    const index = SCREENS.findIndex((screen) => screen.key === 'consequences');
    if (index !== -1) {
      setStep(index);
    }
  };

  const handleRequestScreenTime = async () => {
    if (!ScreenTimeManager?.requestAuthorization) {
      Alert.alert('Unavailable', 'Screen Time permission is not available on this device.');
      return;
    }
    try {
      await ScreenTimeManager.requestAuthorization();
      Alert.alert('Access granted', 'Screen Time permission enabled.');
    } catch (error: any) {
      Alert.alert('Permission failed', error?.message ?? 'Unable to enable Screen Time access.');
    }
  };

  const requestAppStoreRating = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'App Store ratings are only available on iOS.');
      return;
    }

    try {
      const lookupUrl = `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`;
      const response = await fetch(lookupUrl);
      const payload = await response.json();
      const appId = payload?.results?.[0]?.trackId;
      if (!appId) {
        throw new Error('Unable to resolve App Store app id');
      }

      const reviewUrl = `itms-apps://apps.apple.com/app/id${appId}?action=write-review`;
      const canOpen = await Linking.canOpenURL(reviewUrl);
      if (!canOpen) {
        throw new Error('Cannot open App Store review URL');
      }
      await Linking.openURL(reviewUrl);
    } catch {
      Alert.alert(
        'Could not open rating',
        'Please try again in a moment. If it still fails, search for the app in App Store and leave a review there.',
      );
    }
  };

  useEffect(() => {
    if (current.type !== 'splash') return undefined;
    const timeout = setTimeout(() => {
      handleNext();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [current.type]);

  useEffect(() => {
    let isMounted = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setAuthComplete(Boolean(data.session?.user));
      setAuthUserId(data.session?.user?.id ?? null);
    };
    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setAuthComplete(Boolean(newSession?.user));
      setAuthUserId(newSession?.user?.id ?? null);
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const buildQuizAnswers = () => {
    return Object.entries(answers).reduce<Record<string, string | number>>((acc, [key, selectedValue]) => {
      const screen = SCREENS.find((item) => item.key === key);
      const options = (screen as any)?.options ?? [];
      if (Array.isArray(selectedValue)) {
        acc[key] = selectedValue
          .map((index) => options?.[index] ?? index)
          .join(', ');
        return acc;
      }
      if ((screen as any)?.type === 'wheel') {
        const option = options?.[selectedValue] ?? selectedValue;
        if (key === 'q4') {
          const parsedAge = Number.parseInt(String(option), 10);
          acc[key] = Number.isFinite(parsedAge) ? parsedAge : option;
          return acc;
        }
        const suffix = (screen as any)?.suffix ?? '';
        acc[key] = `${option} ${suffix}`.trim();
        return acc;
      }
      if ((screen as any)?.type === 'choice') {
        acc[key] = options?.[selectedValue] ?? selectedValue;
      }
      return acc;
    }, {});
  };

  const getSelectedAge = (): number | null => {
    const selected = answers.q4;
    if (typeof selected !== 'number') return null;
    const q4 = SCREENS.find((screen) => screen.key === 'q4');
    const option = (q4 as any)?.options?.[selected];
    const parsedAge = Number.parseInt(String(option), 10);
    if (!Number.isFinite(parsedAge)) return null;
    return Math.min(120, Math.max(10, parsedAge));
  };

  const getSelectedSavingsGoal = (): string | null => {
    const selected = answers['financial-goal'];
    const goalScreen = SCREENS.find((screen) => screen.key === 'financial-goal');
    const options = (goalScreen as any)?.options ?? [];
    if (Array.isArray(selected)) {
      const selectedGoals = selected
        .map((index) => options?.[index])
        .filter((goal): goal is string => typeof goal === 'string');
      return selectedGoals.length > 0 ? selectedGoals.join(', ') : null;
    }
    if (typeof selected === 'number') {
      const option = options?.[selected];
      return typeof option === 'string' ? option : null;
    }
    return null;
  };

  const saveOnboarding = async (): Promise<boolean> => {
    if (onboardingSaving || onboardingSaved) return false;
    setOnboardingSaving(true);
    const weeklyBudgetValue = Number(weeklyBudget);
    const sanitizedWeeklyBudget = Number.isFinite(weeklyBudgetValue)
      ? Math.min(MAX_WEEKLY_BUDGET, Math.max(MIN_WEEKLY_BUDGET, weeklyBudgetValue))
      : 120;
    const success = await saveOnboardingData({
      quiz_answers: buildQuizAnswers(),
      name: name.trim(),
      age: getSelectedAge(),
      savings_goal: getSelectedSavingsGoal(),
      weekly_budget: sanitizedWeeklyBudget,
      affirmation: affirmation.trim(),
      selected_app_count: selectedAppCount,
      blocking_mode: 'moderate',
    });
    if (success) {
      setOnboardingSaved(true);
      const draftKey = await getOnboardingDraftKey();
      await AsyncStorage.removeItem(draftKey);
    } else {
      console.warn('Failed to save onboarding data');
    }
    setOnboardingSaving(false);
    return success;
  };

  useEffect(() => {
    if (current.type !== 'auth-sign-up' && current.type !== 'auth-sign-in') return;
    if (!authComplete || !didSignIn) return;

    if (current.type === 'auth-sign-in') {
      const continueSignIn = async () => {
        if (!authUserId) {
          setAuthError('Could not verify account. Please try again.');
          setDidSignIn(false);
          void supabase.auth.signOut();
          return;
        }
        const { data: existingOnboarding, error: onboardingLookupError } = await supabase
          .from('onboarding')
          .select('user_id')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (onboardingLookupError) {
          setAuthError('Could not verify account. Please try again.');
          setDidSignIn(false);
          void supabase.auth.signOut();
          return;
        }

        if (!existingOnboarding) {
          const { error: cleanupError } = await supabase.functions.invoke('cleanup-rejected-oauth-user', {
            body: {},
          });
          if (cleanupError) {
            console.warn('Failed to cleanup rejected OAuth user', cleanupError.message);
          }
          setAuthError(
            authSignInOnlyFromWelcome
              ? 'No account found for this Apple/Google login. Complete onboarding first to create a new account.'
              : 'No account found for this Apple/Google login. Please sign up first.',
          );
          setDidSignIn(false);
          void supabase.auth.signOut();
          return;
        }

        onOnboardingComplete?.();
      };
      void continueSignIn();
      return;
    }

    const continueAfterOAuthSignUp = async () => {
      const paywallIndex = SCREENS.findIndex((screen) => screen.type === 'paywall');
      if (paywallIndex !== -1) {
        setStep(paywallIndex);
      }
    };

    if (onboardingSaved) {
      void continueAfterOAuthSignUp();
      return;
    }
    if (onboardingSaving) return;
    const completeOAuthOnboarding = async () => {
      const saved = await saveOnboarding();
      if (saved) {
        await continueAfterOAuthSignUp();
      }
    };
    void completeOAuthOnboarding();
  }, [
    authComplete,
    authSignInOnlyFromWelcome,
    authUserId,
    didSignIn,
    current.type,
    onboardingSaved,
    onboardingSaving,
  ]);

  useEffect(() => {
    if (!authSignInOnlyFromWelcome) return;
    if (current.type !== 'auth-sign-up' && current.type !== 'auth-email-sign-up') return;
    const signInIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-in');
    if (signInIndex !== -1) {
      setStep(signInIndex);
    }
  }, [authSignInOnlyFromWelcome, current.type]);


  useEffect(() => {
    if (!authComplete) return;
    void logInRevenueCat();
  }, [authComplete]);

  useEffect(() => {
    if (current.type !== 'paywall') return;
    void loadOfferings();
  }, [current.type]);

  useEffect(() => {
    if (current.type !== 'fact-progress') return;
    const timer = setTimeout(() => {
      handleNext();
    }, 5000);
    return () => clearTimeout(timer);
  }, [current.type]);

  useEffect(() => {
    if (current.key !== 'paywall') return;
    if (!authComplete || onboardingSaved || onboardingSaving) return;
    void saveOnboarding();
  }, [authComplete, current.key, onboardingSaved, onboardingSaving]);

  const renderContent = () => {
    if (current.type === 'splash') {
      return (
        <View style={styles.splashWrap}>
          <View style={styles.logoMark}>
            <Image
              source={require('./Gemini_Generated_Image_abwoa5abwoa5abwo (1).png')}
              style={styles.logoImage}
            />
          </View>
        </View>
      );
    }

    if (current.type === 'auth-choice') {
      return (
        <View style={styles.authScreen}>
          <View style={styles.authTopBar}>
            <Pressable
              onPress={() => {
                if (step > 0) {
                  setStep(step - 1);
                }
              }}
              hitSlop={12}
              style={styles.authTopBarBack}
            >
              <Text style={styles.authTopBarBackIcon}>‹</Text>
            </Pressable>
          </View>

          <View style={styles.authHero}>
            <Image source={require('./other_imgs/logo_transp_darkblue.png')} style={styles.authHeroMascot} />
            <Text style={[styles.authHeroTitle, styles.authHeroTitleAccent]}>Let's get started</Text>
            <Text style={styles.authHeroSubtitle}>Sign in to your account or create a new one.</Text>
          </View>

          <View style={styles.authBottomActions}>
            <Pressable
              style={styles.authCta}
              onPress={() => {
                setAuthSignInOnlyFromWelcome(false);
                const targetIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-in');
                if (targetIndex !== -1) {
                  setStep(targetIndex);
                }
              }}
            >
              <Text style={styles.authCtaText}>Log In</Text>
            </Pressable>
            {!authSignInOnlyFromWelcome ? (
              <Pressable
                style={styles.authCtaOutline}
                onPress={() => {
                  setAuthSignInOnlyFromWelcome(false);
                  const targetIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-up');
                  if (targetIndex !== -1) {
                    setStep(targetIndex);
                  }
                }}
              >
                <Text style={styles.authCtaOutlineText}>Create Account</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    }

    if (
      current.type === 'auth-sign-up' ||
      current.type === 'auth-sign-in' ||
      current.type === 'auth-email-sign-up' ||
      current.type === 'auth-email-sign-in'
    ) {
      const isProviderAuthScreen = current.type === 'auth-sign-up' || current.type === 'auth-sign-in';
      const isEmailAuthScreen = current.type === 'auth-email-sign-up' || current.type === 'auth-email-sign-in';
      const isSignInScreen = current.type === 'auth-sign-in' || current.type === 'auth-email-sign-in';

      const handleEmailAuth = async () => {
        setAuthLoading(true);
        setAuthError(null);
        const payload = {
          email: authEmail.trim(),
          password: authPassword,
        };
        const isSignIn = isSignInScreen;
        const { error } = isSignIn
            ? await supabase.auth.signInWithPassword(payload)
            : await supabase.auth.signUp(payload);
        if (error) {
          setAuthError(error.message);
        } else if (isSignIn) {
          onOnboardingComplete?.();
        } else {
          const paywallIndex = SCREENS.findIndex((screen) => screen.type === 'paywall');
          if (paywallIndex !== -1) {
            setStep(paywallIndex);
          }
        }
        setAuthLoading(false);
      };

      const handleAppleAuth = async () => {
        setAuthLoading(true);
        setAuthError(null);
        setDidSignIn(true);
        try {
          const nonce = `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const appleResponse = await appleAuth.performRequest({
            requestedOperation: appleAuth.Operation.LOGIN,
            requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
            nonce,
          });
          const identityToken = appleResponse.identityToken;
          if (!identityToken) {
            setAuthError('Apple sign in failed: missing identity token.');
            return;
          }
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
            nonce,
          });
          if (error) {
            setAuthError(error.message);
          }
        } catch (error: any) {
          if (error?.code === appleAuth.Error.CANCELED) {
            setDidSignIn(false);
            return;
          }
          setAuthError(error?.message ?? 'Unable to sign in with Apple.');
        } finally {
          setAuthLoading(false);
        }
      };

      const handleGoogleAuth = async () => {
        setAuthLoading(true);
        setAuthError(null);
        setDidSignIn(true);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: oauthRedirectUrl,
          },
        });
        if (error) {
          setAuthError(error.message);
        } else if (data?.url) {
          await Linking.openURL(data.url);
        }
        setAuthLoading(false);
      };

      return (
        <View style={styles.authScreen}>
          <View style={styles.authTopBar}>
            <Pressable
              onPress={() => {
                const prevType = isEmailAuthScreen
                  ? (isSignInScreen ? 'auth-sign-in' : 'auth-sign-up')
                  : authSignInOnlyFromWelcome && isSignInScreen
                    ? 'welcome'
                    : 'auth-choice';
                const targetIndex = SCREENS.findIndex((screen) => screen.type === prevType);
                if (targetIndex !== -1) {
                  setStep(targetIndex);
                }
              }}
              hitSlop={12}
              style={styles.authTopBarBack}
            >
              <Text style={styles.authTopBarBackIcon}>‹</Text>
            </Pressable>
          </View>

          {isProviderAuthScreen && !isSignInScreen ? (
            <View style={[styles.authHero, styles.authHeroSignUp]}>
              <Text style={[styles.authHeroTitle, styles.authHeroTitleAccent]}>Create your account</Text>
              <Text style={styles.authHeroSubtitle}>Choose how you'd like to sign up.</Text>
            </View>
          ) : isProviderAuthScreen && isSignInScreen ? (
            <View style={styles.authHero}>
              <Text style={[styles.authHeroTitle, styles.authHeroTitleAccent]}>Welcome back</Text>
              <Text style={styles.authHeroSubtitle}>Sign in to pick up where you left off.</Text>
            </View>
          ) : (
            <View style={[styles.authHero, !isSignInScreen && styles.authHeroSignUp]}>
              <Text style={[styles.authHeroTitle, !isSignInScreen && styles.authHeroTitleAccent]}>
                {isSignInScreen ? 'Sign in with email' : 'Sign up with email'}
              </Text>
            </View>
          )}

          {authError ? (
            <View style={styles.authErrorCard}>
              <Text style={styles.authErrorText}>{authError}</Text>
            </View>
          ) : null}

          <View style={[styles.authFormArea, !isSignInScreen && styles.authFormAreaSignUp]}>
            {isProviderAuthScreen ? (
              <>
                {isSignInScreen ? (
                  <>
                    <View style={styles.authCard}>
                      <View style={styles.authFieldGroup}>
                        <Text style={styles.authFieldLabel}>Email</Text>
                        <TextInput
                          value={authEmail}
                          onChangeText={setAuthEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          placeholder="you@example.com"
                          placeholderTextColor={COLORS.muted}
                          style={styles.authFieldInput}
                        />
                      </View>
                      <View style={styles.authFieldGroup}>
                        <Text style={styles.authFieldLabel}>Password</Text>
                        <TextInput
                          value={authPassword}
                          onChangeText={setAuthPassword}
                          secureTextEntry
                          placeholder="••••••••"
                          placeholderTextColor={COLORS.muted}
                          style={styles.authFieldInput}
                        />
                      </View>
                      <Pressable
                        onPress={handleEmailAuth}
                        disabled={authLoading}
                        style={[styles.authCta, authLoading && styles.authDisabled]}
                      >
                        {authLoading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.authCtaText}>Sign in</Text>
                        )}
                      </Pressable>
                    </View>

                    <View style={styles.authDivider}>
                      <View style={styles.authDividerLine} />
                      <Text style={styles.authDividerLabel}>or</Text>
                      <View style={styles.authDividerLine} />
                    </View>
                  </>
                ) : null}

                <Pressable
                  onPress={handleGoogleAuth}
                  disabled={authLoading}
                  style={[styles.authProviderBtn, authLoading && styles.authDisabled]}
                >
                  <Text style={styles.authProviderBtnIconGoogle}>G</Text>
                  <Text style={styles.authProviderBtnLabel}>Continue with Google</Text>
                </Pressable>

                {Platform.OS === 'ios' ? (
                  <Pressable
                    onPress={handleAppleAuth}
                    disabled={authLoading}
                    style={[styles.authProviderBtn, styles.authProviderBtnDark, authLoading && styles.authDisabled]}
                  >
                    <Text style={styles.authProviderBtnIconApple}></Text>
                    <Text style={styles.authProviderBtnLabelLight}>Continue with Apple</Text>
                  </Pressable>
                ) : null}

                {!isSignInScreen ? (
                  <>
                    <Pressable
                      onPress={() => {
                        setAuthError(null);
                        const targetIndex = SCREENS.findIndex((screen) => screen.type === 'auth-email-sign-up');
                        if (targetIndex !== -1) {
                          setStep(targetIndex);
                        }
                      }}
                      disabled={authLoading}
                      style={[styles.authProviderBtn, authLoading && styles.authDisabled]}
                    >
                      <Text style={styles.authProviderBtnIconEmail}>✉</Text>
                      <Text style={styles.authProviderBtnLabel}>Continue with Email</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        const targetIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-in');
                        if (targetIndex !== -1) {
                          setStep(targetIndex);
                        }
                      }}
                      style={[styles.authSwitchLink, styles.authSwitchLinkTight]}
                    >
                      <Text style={styles.authSwitchLinkText}>Already have an account? Sign in</Text>
                    </Pressable>
                  </>
                ) : null}

                {isSignInScreen && !authSignInOnlyFromWelcome ? (
                  <Pressable
                    onPress={() => {
                      const targetIndex = SCREENS.findIndex((screen) => screen.type === 'auth-sign-up');
                      if (targetIndex !== -1) {
                        setStep(targetIndex);
                      }
                    }}
                    style={[styles.authSwitchLink, styles.authSwitchLinkTight]}
                  >
                    <Text style={styles.authSwitchLinkText}>Don't have an account? Sign up</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.authCard}>
                  <View style={styles.authFieldGroup}>
                    <Text style={styles.authFieldLabel}>Email</Text>
                    <TextInput
                      value={authEmail}
                      onChangeText={setAuthEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="you@example.com"
                      placeholderTextColor={COLORS.muted}
                      style={styles.authFieldInput}
                    />
                  </View>
                  <View style={styles.authFieldGroup}>
                    <Text style={styles.authFieldLabel}>Password</Text>
                    <TextInput
                      value={authPassword}
                      onChangeText={setAuthPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.muted}
                      style={styles.authFieldInput}
                    />
                  </View>
                  <Pressable
                    onPress={handleEmailAuth}
                    disabled={authLoading}
                    style={[styles.authCta, authLoading && styles.authDisabled]}
                  >
                    {authLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.authCtaText}>
                        {isSignInScreen ? 'Sign in' : 'Create account'}
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    const targetType = isSignInScreen ? 'auth-sign-in' : 'auth-sign-up';
                    const targetIndex = SCREENS.findIndex((screen) => screen.type === targetType);
                    if (targetIndex !== -1) {
                      setStep(targetIndex);
                    }
                  }}
                  style={styles.authSwitchLink}
                >
                  <Text style={styles.authSwitchLinkText}>Use Google or Apple instead</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.authFooter}>
            {!isSignInScreen ? (
              <Text style={styles.authTerms}>
                By continuing you confirm that you have read and agreed to our{' '}
                <Text
                  style={styles.authTermsHighlight}
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(TERMS_URL);
                  }}
                >
                  Terms of Service
                </Text>{' '}
                and consent to our{' '}
                <Text
                  style={styles.authTermsHighlight}
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(PRIVACY_URL);
                  }}
                >
                  Privacy Policy
                </Text>.
              </Text>
            ) : null}
          </View>
        </View>
      );
    }

    if (current.type === 'paywall') {
      const plans = [
        {
          key: 'weekly',
          title: 'Weekly',
          price: '$7.99',
          sub: '$7.99 / week',
          note: 'Most flexible',
          periodLabel: 'week',
        },
        {
          key: 'monthly',
          title: 'Monthly',
          price: '$19.99',
          sub: '$4.99 / week',
          note: 'per month',
          periodLabel: 'month',
        },
        {
          key: 'annual',
          title: 'Yearly',
          price: '$99.99',
          sub: '$1.92 / week',
          note: 'per year',
          periodLabel: 'year',
        },
      ] as const;
      return (
        <View style={styles.paywallWrap}>
          {offeringsError ? <Text style={styles.paywallError}>{offeringsError}</Text> : null}
          <View style={styles.paywallPlanList}>
            {plans.map((plan) => (
              <Pressable
                key={plan.key}
                onPress={() => setSelectedPlan(plan.key)}
                style={[styles.paywallPlanCard, selectedPlan === plan.key && styles.paywallPlanCardActive]}
              >
                <View style={styles.paywallPlanRow}>
                  <View style={styles.paywallPlanRadio}>
                    {selectedPlan === plan.key ? <View style={styles.paywallPlanRadioFill} /> : null}
                  </View>
                  <View style={styles.paywallPlanCopy}>
                    <Text style={styles.paywallPlanTitle}>{plan.title}</Text>
                    <Text style={styles.paywallPlanSub}>{plan.sub}</Text>
                  </View>
                  <View style={styles.paywallPlanPriceBlock}>
                    <Text style={styles.paywallPlanPrice}>{plan.price}</Text>
                    <Text style={styles.paywallPlanNote}>{plan.note}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (current.type === 'rating') {
      const reviews = [
        {
          name: 'Chloe Chen',
          username: '@chloe_ch1',
          review:
            'I used to spend $40 on food deliveries everyday like it was nothing. Having the app block uber eats when i\'m over budget is a little annoying, but i actually have money in my savings now.',
          avatar: require('./other_imgs/chloe.jpg'),
        },
        {
          name: 'Silas Kovac',
          username: '@silaskovac_dev',
          review:
            'seeing the app tell me my weekly orders cost me a new TV was the wake up call i needed. the app definitely stops the impulse buys.',
          avatar: require('./other_imgs/silas.jpg'),
        },
        {
          name: 'hannah',
          username: '@hannahv2',
          review:
            'Love QuitBite ! the app actually stops me from ordering unhealthy and save money. the ai health coach is also very helpul.',
          avatar: require('./other_imgs/hannah.jpg'),
        },
      ];
      return (
        <View style={styles.ratingWrap}>
          <Text style={styles.ratingTitle}>{current.title}</Text>
          <Text style={styles.ratingBody}>{current.body}</Text>
          <View style={styles.ratingReviewList}>
            {reviews.map((review) => (
              <View key={review.username} style={styles.ratingReviewCard}>
                <View style={styles.ratingReviewHeader}>
                  <View style={styles.ratingReviewUserBlock}>
                    <Image source={review.avatar} style={styles.ratingReviewAvatar} />
                    <View>
                      <Text style={styles.ratingReviewName}>{review.name}</Text>
                      <Text style={styles.ratingReviewUsername}>{review.username}</Text>
                    </View>
                  </View>
                  <Text style={styles.ratingReviewStars}>★★★★★</Text>
                </View>
                <Text style={styles.ratingReviewText}>{review.review}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (current.type === 'commitment') {
      const items = [
        'Be willing and open to change',
        'Try to become the best version of myself',
        'Save money whenever I can',
        'Care about my personal wellbeing',
      ];
      return (
        <View style={styles.commitmentWrap}>
          <Text style={styles.commitmentTitle}>{current.title}</Text>
          <Text style={styles.commitmentBody}>{current.body}</Text>
          <View style={styles.commitmentList}>
            {items.map((item) => (
              <View key={item} style={styles.commitmentRow}>
                <View style={styles.commitmentCheck}>
                  <Text style={styles.commitmentCheckText}>✓</Text>
                </View>
                <Text style={styles.commitmentText}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={styles.affirmationCard}>
            <Text style={styles.affirmationLabel}>Type this affirmation:</Text>
            <Text style={styles.affirmationPrompt}>“{REQUIRED_AFFIRMATION}”</Text>
            <TextInput
              value={affirmation}
              onChangeText={setAffirmation}
              placeholder={REQUIRED_AFFIRMATION}
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.affirmationInput}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      );
    }

    if (current.type === 'motivation') {
      return (
        <View style={styles.motivationWrap}>
          <Text style={styles.motivationTitle}>{current.title}</Text>
        </View>
      );
    }

    if (current.type === 'placeholder') {
      if (current.key === 'placeholder-1') {
        return (
          <View style={styles.featureWrap}>
            <Text style={[styles.featureTitle, styles.featureTitleAccent]}>Small Cuts. Big Savings.</Text>
            <Text style={styles.featureBody}>
              QuitBite helps you reduce unhealthy food deliveries and save thousands a year.
            </Text>
            <Image source={require('./other_imgs/graph1.png')} style={styles.placeholderGraphImage} />
          </View>
        );
      }

      return (
        <View style={styles.placeholderWrap}>
          <Text style={styles.placeholderText}>Coming soon</Text>
        </View>
      );
    }

    if (current.type === 'access') {
      const items = [
        'Budget protection',
        'Craving blockers',
        'Weekly insights',
        'Opportunity cost',
        'Cooking nudges',
        'Delivery limits',
      ];
      return (
        <View style={styles.accessWrap}>
          <Text style={styles.accessTitle}>{current.title}</Text>
          <View style={styles.accessGrid}>
            {items.map((item) => (
              <View key={item} style={styles.accessTile}>
                <Text style={styles.accessTileIcon}>✦</Text>
                <Text style={styles.accessTileText}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={styles.accessTestimonial}>
            <View style={styles.accessTestimonialHeader}>
              <View style={styles.ratingAvatar} />
              <Text style={styles.accessTestimonialName}>Alex</Text>
              <Text style={styles.accessTestimonialStars}>★★★★★</Text>
            </View>
            <Text style={styles.accessTestimonialBody}>
              "I saved my first $120 in a month. The reminders actually work."
            </Text>
          </View>
        </View>
      );
    }

    if (current.type === 'name') {
      return (
        <View style={styles.formWrap}>
          <Text style={styles.formTitle}>{current.title}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={COLORS.muted}
            style={styles.textField}
          />
        </View>
      );
    }

    if (current.type === 'budget') {
      return (
        <View style={styles.formWrap}>
          <Text style={styles.formTitle}>{current.title}</Text>
          <View style={styles.budgetField}>
            <Text style={styles.budgetCurrency}>$</Text>
            <TextInput
              value={weeklyBudget}
              onChangeText={(value) => {
                const digitsOnly = value.replace(/[^0-9]/g, '');
                if (!digitsOnly) {
                  setWeeklyBudget('');
                  return;
                }
                const numericValue = Number.parseInt(digitsOnly, 10);
                const cappedValue = Math.min(MAX_WEEKLY_BUDGET, numericValue);
                setWeeklyBudget(String(cappedValue));
              }}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.budgetInput}
            />
          </View>
          <Text style={styles.formHint}>Pick a weekly cap between ${MIN_WEEKLY_BUDGET} and ${MAX_WEEKLY_BUDGET}.</Text>
        </View>
      );
    }

    if (current.type === 'help') {
      const helpMascot =
        current.key === 'help-2'
          ? require('./mascots/pijjjaaa.png')
          : current.key === 'help-3'
            ? require('./mascots/superman.png')
            : require('./mascots/bike.png');
      return (
        <View style={styles.featureWrap}>
          <Image source={helpMascot} style={styles.featureMascotImage} />
          <Text style={[styles.featureTitle, styles.featureTitleAccent]}>{current.title}</Text>
          <Text style={styles.featureBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'permission') {
      return (
        <View style={styles.permissionWrap}>
          <Text style={[styles.formTitle, styles.formTitleAccent]}>{current.title}</Text>
          <Text style={styles.formHint}>{current.body}</Text>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Enable Screen Time access</Text>
            <Text style={styles.permissionBody}>
              This lets QuitBite block delivery apps when you hit your weekly budget.
            </Text>
            <Pressable onPress={handleRequestScreenTime} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (current.type === 'consequence') {
      const consequenceMascot =
        current.key === 'consequence-1' ? require('./mascots/fatty.png') :
        current.key === 'consequence-2' ? require('./mascots/boiling.png') :
        current.key === 'consequence-3' ? require('./mascots/fattysleep.png') :
        require('./mascots/brokeahh.png');
      return (
        <View style={styles.consequenceWrap}>
          <Image source={consequenceMascot} style={styles.consequenceMascotImage} />
          <Text style={styles.consequenceTitle}>{current.title}</Text>
          <Text style={styles.consequenceBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'select-apps') {
      const handleSelectApps = async () => {
        if (!ScreenTimeManager?.selectApps) {
          Alert.alert('Unavailable', 'App selection is not available on this device.');
          return;
        }
        try {
          const result = await ScreenTimeManager.selectApps();
          if (result?.cancelled) return;
          const count = result?.count ?? 0;
          setSelectedAppCount(count);
          if (count > 0) {
            Alert.alert('Apps selected', `${count} app${count === 1 ? '' : 's'} will be blocked when you exceed your budget.`);
          }
        } catch (error: any) {
          Alert.alert('Error', error?.message ?? 'Unable to select apps.');
        }
      };
      return (
        <View style={styles.permissionWrap}>
          <Text style={[styles.formTitle, styles.formTitleAccent]}>{current.title}</Text>
          <Text style={styles.formHint}>{current.body}</Text>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>
              {selectedAppCount > 0
                ? `${selectedAppCount} app${selectedAppCount === 1 ? '' : 's'} selected`
                : 'No apps selected yet'}
            </Text>
            <Text style={styles.permissionBody}>
              Tap below to open the app picker and choose which delivery apps to block.
            </Text>
            <Pressable onPress={handleSelectApps} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>
                {selectedAppCount > 0 ? 'Change selection' : 'Select apps'}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (current.type === 'consequences-combined') {
      const rows = [
        { mascot: require('./mascots/fatty.png'), title: 'Cravings get stronger', body: 'The more often you order, the more your brain expects instant comfort on demand.' },
        { mascot: require('./mascots/boiling.png'), title: 'Daily stress rises', body: 'Convenience helps in the moment, but repeated orders usually bring guilt and mental fatigue later.' },
        { mascot: require('./mascots/fattysleep.png'), title: 'Energy drops', body: 'Frequent heavy meals can leave you sluggish and less motivated to take care of yourself.' },
        { mascot: require('./mascots/brokeahh.png'), title: 'Money keeps leaking', body: 'What looks like small orders turns into a serious monthly drain that delays your bigger goals.' },
      ];
      return (
        <View style={styles.consequencesCombinedWrap}>
          <Text style={styles.consequencesCombinedTitle}>{current.title}</Text>
          <Text style={styles.consequencesCombinedSubtext}>This habit doesn&apos;t just affect your wallet — it rewires your routine.</Text>
          <View style={styles.consequencesCombinedList}>
            {rows.map((row) => (
              <View key={row.title} style={styles.consequenceRowItem}>
                <Image source={row.mascot} style={styles.consequenceRowImage} />
                <View style={styles.consequenceRowCopy}>
                  <Text style={styles.consequenceRowTitle}>{row.title}</Text>
                  <Text style={styles.consequenceRowBody}>{row.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (current.type === 'showcase') {
      const showcaseImg = current.showcaseImage === 'block'
        ? require('./mascots/hottea.png')
        : require('./mascots/jollyahh.png');
      return (
        <View style={styles.featureWrap}>
          <Image source={showcaseImg} style={styles.featureMascotImage} />
          <Text style={[styles.featureTitle, styles.featureTitleAccent]}>{current.title}</Text>
          <Text style={styles.featureBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'results') {
      return (
        <View style={styles.resultsWrap}>
          <Text style={styles.resultsTitle}>Your results</Text>
          <View style={styles.resultsMascotArea}>
            <Image source={require('./mascots/scale.png')} style={styles.resultsMascotImage} />
          </View>
          <Text style={styles.resultsSubtitle}>You&apos;re spending more than you think.</Text>
          <Text style={styles.resultsBody}>
            Based on your answers, delivery is taking a big bite out of your weekly budget.
          </Text>
          <Text style={styles.resultsSection}>Insights</Text>
          <View style={styles.resultsCard}>
            <View style={styles.resultsBadge} />
            <Text style={styles.resultsCardText}>At this pace, delivery can quietly wipe out thousands every year that should be building your savings.</Text>
          </View>
          <View style={styles.resultsCard}>
            <View style={[styles.resultsBadge, styles.resultsBadgeWarm]} />
            <Text style={styles.resultsCardText}>Cravings + convenience are running the pattern right now, and that pattern tends to get harder to break each month.</Text>
          </View>
          <View style={styles.resultsCard}>
            <View style={[styles.resultsBadge, styles.resultsBadgeCool]} />
            <Text style={styles.resultsCardText}>You&apos;re ready for a plan that makes skipping easier.</Text>
          </View>
        </View>
      );
    }

    if (current.type === 'ack') {
      const ackMascot = current.key === 'ack-1'
        ? require('./mascots/bulb.png')
        : require('./mascots/climb.png');
      return (
        <View style={styles.ackWrap}>
          <Image source={ackMascot} style={styles.ackMascotImage} />
          <Text style={styles.ackTitle}>{current.title}</Text>
          <Text style={styles.ackBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'welcome') {
      return (
        <View style={styles.welcomeWrap}>
          <View style={styles.welcomeMascotArea}>
            <Image
              source={require('./other_imgs/mascot_transp.png')}
              style={styles.welcomeMascotImage}
            />
          </View>
          <Text style={styles.welcomeTitle}>Welcome.</Text>
          <Text style={styles.welcomeBody}>
            Let’s understand your food delivery habits and help you spend with intention.
          </Text>
        </View>
      );
    }

    if (current.type === 'fact') {
      const factMascot = current.key === 'fact-1'
        ? require('./other_imgs/mascot_screen2.png')
        : require('./other_imgs/mascot_screen3.png');
      const isFactOne = current.key === 'fact-1';
      return (
        <View style={[styles.factWrap, isFactOne && styles.factOneWrap]}>
          <Image source={factMascot} style={[styles.factMascotImage, isFactOne && styles.factOneMascotImage]} />
          <Text style={[styles.factLabel, isFactOne && styles.factOneLabel]}>Did you know?</Text>
          <Text style={[styles.factBody, isFactOne && styles.factOneBody]}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'fact-progress') {
      return (
        <View style={styles.factWrap}>
          <Image source={require('./mascots/cutting.png')} style={[styles.factMascotImage, styles.opportunityMascotImage]} />
          <Text style={styles.factLabel}>{current.title}</Text>
          <Text style={styles.factBody}>{current.body}</Text>
          <Text style={styles.preparingResultsText}>Preparing your results...</Text>
        </View>
      );
    }

    if (current.type === 'choice') {
      const selected = answers[current.key];
      const isMultiSelect = Boolean((current as any).multiSelect);
      const selectedIndexes = Array.isArray(selected)
        ? selected
        : typeof selected === 'number'
          ? [selected]
          : [];
      const options = current.options ?? [];
      return (
        <View style={styles.questionWrap}>
          <Text style={styles.questionLabel}>{current.label}</Text>
          <Text style={styles.questionTitle}>{current.question}</Text>
          {isMultiSelect ? <Text style={styles.questionHint}>Select all that apply</Text> : null}
          <View style={styles.optionList}>
            {options.map((option, index) => (
              <Pressable
                key={option}
                onPress={() => {
                  if (isMultiSelect) {
                    setAnswers((prev) => {
                      const currentValue = prev[current.key];
                      const currentSelections = Array.isArray(currentValue)
                        ? currentValue
                        : typeof currentValue === 'number'
                          ? [currentValue]
                          : [];
                      const alreadySelected = currentSelections.includes(index);
                      const nextSelections = alreadySelected
                        ? currentSelections.filter((item) => item !== index)
                        : [...currentSelections, index];
                      return { ...prev, [current.key]: nextSelections };
                    });
                    return;
                  }
                  setAnswers((prev) => ({ ...prev, [current.key]: index }));
                }}
                style={[styles.optionRow, selectedIndexes.includes(index) && styles.optionRowActive]}
              >
                <View style={[styles.optionIndex, selectedIndexes.includes(index) && styles.optionIndexActive]}>
                  <Text style={[styles.optionIndexText, selectedIndexes.includes(index) && styles.optionIndexTextActive]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.optionText, selectedIndexes.includes(index) && styles.optionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          {current.key === 'q1' ? (
            <Pressable onPress={handleSkipQuiz} style={styles.skipQuizButton}>
              <Text style={styles.skipQuizText}>Skip quiz</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    if (current.type === 'wheel') {
      const selectedValue = answers[current.key];
      const selected = typeof selectedValue === 'number' ? selectedValue : 0;
      const options = current.options ?? [];
      const suffix = current.suffix ?? '';
      return (
        <View style={styles.questionWrap}>
          <Text style={styles.questionLabel}>{current.label}</Text>
          <Text style={styles.questionTitle}>{current.question}</Text>
          <View style={styles.wheelWrap}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              snapToInterval={44}
              decelerationRate="fast"
              contentContainerStyle={styles.wheelContent}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.y / 44);
                setAnswers((prev) => ({ ...prev, [current.key]: index }));
              }}
            >
              {options.map((option) => (
                <View key={option} style={styles.wheelItem}>
                  <Text style={styles.wheelText}>{option}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.wheelHighlight}>
              <Text style={styles.wheelHighlightText}>
                {options[selected]} {suffix}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  const isDarkScreen =
    current.type === 'splash' ||
    current.type === 'welcome' ||
    current.type === 'rating' ||
    current.type === 'commitment' ||
    current.type === 'motivation' ||
    current.type === 'access' ||
    current.type === 'paywall';
  const backgroundColor = useMemo(() => {
    if (isDarkScreen) return COLORS.navy;
    if (
      current.type === 'auth-choice' ||
      current.type === 'auth-sign-up' ||
      current.type === 'auth-sign-in' ||
      current.type === 'auth-email-sign-up' ||
      current.type === 'auth-email-sign-in'
    ) {
      return COLORS.white;
    }
    return COLORS.screenBg;
  }, [current.type, current.key, isDarkScreen]);

  const primaryLabel =
    current.type === 'welcome'
      ? 'Start quiz'
      : current.type === 'consequences-combined'
        ? 'See your results'
        : current.type === 'results'
          ? 'Continue'
          : current.type === 'ack'
            ? 'Continue'
            : current.type === 'showcase'
              ? 'Continue'
              : current.type === 'placeholder'
                ? 'Continue'
                : current.type === 'name'
                  ? 'Continue'
                  : current.type === 'budget'
                    ? 'Continue'
                    : current.type === 'help'
                      ? 'Continue'
                      : current.type === 'permission'
                        ? 'Continue'
                          : current.type === 'select-apps'
                            ? 'Continue'
                            : current.type === 'access'
                            ? 'Start my transformation'
                            : current.type === 'paywall'
                              ? 'Start my journey today'
                              : current.type === 'wheel'
                                ? current.cta
                                : 'Next';
  const isPaywall = current.type === 'paywall';
  const isAuthScreen =
    current.type === 'auth-choice' ||
    current.type === 'auth-sign-up' ||
    current.type === 'auth-sign-in' ||
    current.type === 'auth-email-sign-up' ||
    current.type === 'auth-email-sign-in';
  const isEmailAuthScreen = current.type === 'auth-email-sign-up' || current.type === 'auth-email-sign-in';
  const progressDotIndex = Math.min(2, Math.floor((step / Math.max(1, totalSteps - 1)) * 3));
  const normalizedAffirmationLength = affirmation.trim().length;
  const affirmationLengthDelta = Math.abs(normalizedAffirmationLength - REQUIRED_AFFIRMATION.length);
  const isAffirmationLengthValid = normalizedAffirmationLength > 0 && affirmationLengthDelta <= 10;
  const isNextDisabled =
    current.type === 'choice'
      ? Boolean((current as any).multiSelect)
        ? !Array.isArray(answers[current.key]) || (answers[current.key] as number[]).length === 0
        : typeof answers[current.key] !== 'number'
      : current.type === 'wheel'
        ? answers[current.key] === undefined
        : current.type === 'name'
          ? name.trim().length === 0
          : current.type === 'budget'
            ? !isWeeklyBudgetValid
            : current.type === 'commitment'
              ? !isAffirmationLengthValid
              : isAuthScreen
                ? !authComplete
                : current.type === 'paywall'
                  ? selectedPlan === null || isPurchasing || isRestoringPurchase || isLoadingOfferings
              : false;

  const handlePurchase = async () => {
    if (!isPaywall) {
      handleNext();
      return;
    }
    const weeklyPackage = resolvePackageForPlan('weekly');
    const annualPackage = resolvePackageForPlan('annual');
    const monthlyPackage = resolvePackageForPlan('monthly');
    const selectedPackage =
      selectedPlan === 'weekly'
        ? weeklyPackage
        : selectedPlan === 'annual'
          ? annualPackage
          : monthlyPackage;
    if (!selectedPackage) return;
    setIsPurchasing(true);
    setOfferingsError(null);
    try {
      const result = await Purchases.purchasePackage(selectedPackage);
      const info = (result as any)?.customerInfo ?? (await Purchases.getCustomerInfo());
      setCustomerInfo(info);
      await syncSubscription(info);
      onOnboardingComplete?.();
    } catch (e: any) {
      if (e?.userCancelled) {
        return;
      }
      setOfferingsError(e?.message ?? String(e));
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoringPurchase(true);
    setOfferingsError(null);
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      await syncSubscription(info);
      const hasProEntitlement = Boolean((info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID]);
      if (hasProEntitlement) {
        Alert.alert('Purchases restored', 'Your subscription has been restored successfully.');
        onOnboardingComplete?.();
        return;
      }
      Alert.alert('No purchases found', 'No active purchases were found to restore for this Apple ID.');
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Unable to restore purchases right now. Please try again.');
    } finally {
      setIsRestoringPurchase(false);
    }
  };

  if (current.type === 'welcome') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ImageBackground
          source={require('./screens_bg/screen2.png')}
          style={styles.container}
          resizeMode="cover"
        >
          <ScrollView contentContainerStyle={styles.welcomeContent} showsVerticalScrollIndicator={false}>
            {renderContent()}
          </ScrollView>
          <View style={styles.welcomeBottomBar}>
            <Pressable onPress={() => {
              setAuthSignInOnlyFromWelcome(true);
              const authIndex = SCREENS.findIndex((s) => s.type === 'auth-sign-in');
              if (authIndex !== -1) setStep(authIndex);
            }}>
              <Text style={styles.welcomeSignInHint}>Existing user? Sign in</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAuthSignInOnlyFromWelcome(false);
                handleNext();
              }}
              style={[styles.primaryButton, { width: '100%' }]}
            >
              <Text style={styles.primaryButtonText}>
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        </ImageBackground>
      </View>
    );
  }

  if (current.type === 'paywall') {
    const paywallPlans = [
      { key: 'weekly' as const, title: 'Weekly', price: '$7.99', sub: '$7.99 / week', note: 'Most flexible', badge: null },
      { key: 'monthly' as const, title: 'Monthly', price: '$19.99', sub: '$4.99 / week', note: 'per month', badge: 'Most Popular' },
      { key: 'annual' as const, title: 'Yearly', price: '$99.99', sub: '$1.92 / week', note: 'per year', badge: 'Best Price' },
    ];
    const overlayNextDisabled = selectedPlan === null || isPurchasing || isRestoringPurchase || isLoadingOfferings;
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ImageBackground
          source={require('./other_imgs/paywall text_.png')}
          style={styles.container}
          resizeMode="cover"
        >
          <View style={styles.paywallBottomSheet}>
            <Pressable
              onPress={() => setShowPlanOverlay(true)}
              style={styles.unlockButton}
            >
              <Text style={styles.unlockButtonText}>Continue</Text>
            </Pressable>
          </View>
        </ImageBackground>

        <Modal
          visible={showPlanOverlay}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowPlanOverlay(false)}
        >
          <ImageBackground
            source={require('./other_imgs/overlayscreen.png')}
            style={styles.overlaySheet}
            resizeMode="cover"
          >
            <View style={styles.overlayTopBar}>
              <Pressable onPress={() => setShowPlanOverlay(false)} style={styles.overlayCloseButton}>
                <Text style={styles.overlayCloseIcon}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.overlayContent}>
              {offeringsError ? <Text style={styles.paywallError}>{offeringsError}</Text> : null}
              <View style={styles.paywallPlanList}>
                {paywallPlans.map((plan) => (
                  <View key={plan.key}>
                    {plan.badge ? (
                      <View
                        style={[
                          styles.planBadgeWrap,
                          plan.badge === 'Best Price' ? styles.bestPriceBadgeWrap : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.planBadgeText,
                            plan.badge === 'Best Price' ? styles.bestPriceBadgeText : null,
                          ]}
                        >
                          {plan.badge}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setSelectedPlan(plan.key)}
                      style={[styles.paywallPlanCard, selectedPlan === plan.key && styles.paywallPlanCardActive, plan.badge ? styles.paywallPlanCardBadged : null]}
                    >
                      <View style={styles.paywallPlanRow}>
                        <View style={styles.paywallPlanRadio}>
                          {selectedPlan === plan.key ? <View style={styles.paywallPlanRadioFill} /> : null}
                        </View>
                        <View style={styles.paywallPlanCopy}>
                          <Text style={styles.paywallPlanTitle}>{plan.title}</Text>
                          <Text style={styles.paywallPlanSub}>{plan.sub}</Text>
                        </View>
                        <View style={styles.paywallPlanPriceBlock}>
                          <Text style={styles.paywallPlanPrice}>{plan.price}</Text>
                          <Text style={styles.paywallPlanNote}>{plan.note}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={handlePurchase}
                disabled={overlayNextDisabled}
                style={[styles.overlayTrialButton, overlayNextDisabled && styles.primaryButtonDisabled]}
              >
                <Text style={styles.overlayTrialButtonText}>
                  {isPurchasing ? 'Processing…' : 'Start 3 Days Free Trial'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRestorePurchases}
                disabled={isPurchasing || isRestoringPurchase || isLoadingOfferings}
                style={styles.overlayRestoreButton}
              >
                <Text style={styles.overlayRestoreButtonText}>
                  {isRestoringPurchase ? 'Restoring…' : 'Restore Purchases'}
                </Text>
              </Pressable>
              <Text style={styles.overlayFootnote}>No payment now. Cancel anytime.</Text>
            </View>
          </ImageBackground>
        </Modal>
      </View>
    );
  }

  if (isAuthScreen) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.white }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {renderContent()}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor }]}
      >
        <View style={styles.topNav}>
          {step > 0 && current.key !== 'help-2' && current.key !== 'results' && current.type !== 'fact-progress' ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={[styles.backIcon, isDarkScreen && styles.backIconLight]}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, current.type === 'results' && styles.contentResults]}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>

        {current.type === 'splash' || isAuthScreen || current.type === 'fact-progress' ? null : (
          <View style={styles.bottomBar}>
            <View style={styles.progressDotsRow}>
              {[0, 1, 2].map((dot) => (
                <View key={`dot-${dot}`} style={[styles.progressDot, dot === progressDotIndex && styles.progressDotActive]} />
              ))}
            </View>
            <Pressable
              onPress={isPaywall ? handlePurchase : handleNext}
              disabled={isNextDisabled}
              style={[
                styles.primaryButton,
                isNextDisabled && styles.primaryButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                ]}
              >
                {isPurchasing && isPaywall ? 'Processing…' : primaryLabel}
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topNav: {
    paddingHorizontal: 16,
    paddingTop: 6,
    minHeight: 36,
  },
  welcomeTopNav: {
    paddingHorizontal: 16,
    paddingTop: 60,
    minHeight: 36,
  },
  welcomeBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 44,
    paddingTop: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  welcomeSignInHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  welcomeSkipButton: {
    marginTop: 12,
  },
  welcomeSkipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  welcomeContent: {
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 180,
    flexGrow: 1,
  },
  quizProgressTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.softBorder,
    overflow: 'hidden',
  },
  quizProgressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 36,
    height: 36,
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.ink,
    fontWeight: '600',
  },
  backIconLight: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    flexGrow: 1,
  },
  contentResults: {
    paddingBottom: 220,
  },
  splashWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy,
  },
  logoMark: {
    width: 130,
    height: 130,
    borderRadius: 36,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
  },
  welcomeWrap: {
    marginTop: 12,
    flex: 1,
  },
  welcomeMascotArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 32,
  },
  welcomeMascotImage: {
    width: 260,
    height: 300,
    resizeMode: 'contain',
  },
  illustrationWarm: {
    height: 220,
    borderRadius: 32,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  illustrationLight: {
    height: 150,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  illustrationEmoji: {
    fontSize: 52,
  },
  featureWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  featureMascotImage: {
    width: 290,
    height: 290,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
    maxWidth: 320,
  },
  featureTitleAccent: {
    color: COLORS.accent,
  },
  featureBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    maxWidth: 320,
  },
  welcomeTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
    letterSpacing: -0.8,
  },
  welcomeBody: {
    fontSize: 17,
    lineHeight: 28,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  welcomeHint: {
    fontSize: 14,
    color: COLORS.muted,
  },
  welcomeHintBottom: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeHintTop: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  nonQuizProgressTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.softBorder,
    overflow: 'hidden',
  },
  nonQuizProgressTrackDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  nonQuizProgressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  nonQuizProgressFillDark: {
    backgroundColor: COLORS.accentLight,
  },
  factWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  factOneWrap: {
    paddingTop: 0,
  },
  factMascotImage: {
    width: 280,
    height: 300,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  factOneMascotImage: {
    marginBottom: 8,
    marginTop: -10,
  },
  opportunityMascotImage: {
    width: 260,
    height: 280,
    marginBottom: 16,
  },
  factLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  factOneLabel: {
    marginBottom: 12,
  },
  factBody: {
    fontSize: 20,
    lineHeight: 30,
    color: COLORS.ink,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    maxWidth: 320,
  },
  factOneBody: {
    maxWidth: '94%',
  },
  factProgress: {
    width: '100%',
    marginTop: 28,
    alignItems: 'center',
  },
  resultsProgress: {
    width: '100%',
    marginTop: 28,
    alignItems: 'center',
  },
  resultsBarTrack: {
    height: 5,
    width: '100%',
    backgroundColor: COLORS.softBorder,
    borderRadius: 999,
    overflow: 'hidden',
  },
  resultsBarFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  resultsLabel: {
    fontSize: 12,
    marginTop: 10,
    color: COLORS.muted,
  },
  resultsWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 12,
    letterSpacing: -0.6,
    textAlign: 'center',
    maxWidth: 320,
  },
  resultsMascotArea: {
    alignItems: 'center',
    marginBottom: 4,
  },
  resultsMascotImage: {
    width: 136,
    height: 120,
    resizeMode: 'contain',
  },
  resultsSubtitle: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    maxWidth: 320,
  },
  resultsBody: {
    marginTop: 6,
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 320,
  },
  resultsSection: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  resultsCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.cardBg,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#4A7CFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  resultsBadge: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
  resultsBadgeWarm: {
    backgroundColor: COLORS.gold,
  },
  resultsBadgeCool: {
    backgroundColor: COLORS.sage,
  },
  resultsCardText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.inkSoft,
    lineHeight: 21,
  },
  ackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  ackIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ackIcon: {
    fontSize: 38,
  },
  ackMascotImage: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 28,
  },
  ackTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    maxWidth: 320,
  },
  ackBody: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    maxWidth: 320,
  },
  ratingWrap: {
    marginTop: 2,
    alignItems: 'center',
  },
  ratingStars: {
    fontSize: 22,
    color: COLORS.gold,
    marginBottom: 14,
    letterSpacing: 4,
  },
  ratingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  ratingBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 330,
    marginBottom: 12,
  },
  ratingReviewList: {
    width: '100%',
    gap: 10,
  },
  ratingReviewCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 13,
  },
  ratingReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ratingReviewUserBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  ratingReviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    resizeMode: 'cover',
  },
  ratingReviewName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ratingReviewUsername: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  ratingReviewStars: {
    fontSize: 14,
    color: COLORS.gold,
    letterSpacing: 1.2,
  },
  ratingReviewText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 22,
  },
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  ratingAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74,124,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ratingAvatarOverlap: {
    marginLeft: -10,
  },
  ratingSocial: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    marginLeft: 8,
  },
  ratingCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 12,
  },
  ratingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ratingCardStars: {
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  ratingCardName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
  },
  ratingCardText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  commitmentWrap: {
    marginTop: 16,
  },
  commitmentTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  commitmentBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  commitmentList: {
    gap: 14,
    marginBottom: 24,
  },
  commitmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commitmentCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(74,124,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentCheckText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  commitmentText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    flex: 1,
    lineHeight: 22,
  },
  signatureCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 24,
    alignItems: 'center',
  },
  signatureLine: {
    width: '80%',
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    marginBottom: 14,
  },
  signatureLineShort: {
    width: '55%',
    opacity: 0.5,
  },
  signatureHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  motivationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  motivationTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  motivationHint: {
    marginTop: 20,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
  },
  accessWrap: {
    marginTop: 16,
  },
  accessTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  accessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  accessTile: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  accessTileIcon: {
    fontSize: 14,
    color: COLORS.accentLight,
    marginBottom: 10,
  },
  accessTileText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    fontWeight: '500',
  },
  accessTestimonial: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  accessTestimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  accessTestimonialName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  accessTestimonialStars: {
    marginLeft: 'auto',
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 2,
  },
  accessTestimonialBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  transformationWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  transformationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
    letterSpacing: -0.3,
    fontStyle: 'italic',
  },
  transformationTag: {
    marginTop: 20,
    fontSize: 11,
    letterSpacing: 2.5,
    color: COLORS.accentLight,
    fontWeight: '700',
  },
  transformationDate: {
    marginTop: 8,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  transformationFootnote: {
    marginTop: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  transformationFootnoteText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
  },
  paywallBottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 16,
  },
  unlockButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  overlaySheet: {
    flex: 1,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  overlayTopBar: {
    paddingTop: 56,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 14,
  },
  overlayTrialButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  overlayTrialButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  overlayRestoreButton: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 6,
  },
  overlayRestoreButtonText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  overlayFootnote: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  planBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accent,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 12,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bestPriceBadgeWrap: {
    backgroundColor: COLORS.gold,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bestPriceBadgeText: {
    color: '#2C2200',
  },
  paywallPlanCardBadged: {
    borderTopLeftRadius: 0,
  },
  paywallWrap: {
    marginTop: 16,
  },
  paywallHeader: {
    marginBottom: 20,
  },
  paywallTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  paywallSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.accentLight,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  paywallBenefits: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 20,
  },
  paywallBenefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  paywallBenefitBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  paywallError: {
    marginBottom: 12,
    color: '#FCA5A5',
    fontSize: 13,
  },
  paywallPlanList: {
    gap: 8,
    marginBottom: 10,
  },
  paywallPlanCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
  },
  paywallPlanCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(74,124,255,0.12)',
  },
  paywallPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  paywallPlanRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallPlanRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  paywallPlanCopy: {
    flex: 1,
  },
  paywallPlanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paywallPlanSub: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  paywallPlanPriceBlock: {
    alignItems: 'flex-end',
  },
  paywallPlanPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  paywallPlanNote: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.accentLight,
    fontWeight: '600',
  },
  paywallFootnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paywallFootnoteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.sage,
  },
  paywallFootnoteText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  skipQuizButton: {
    alignSelf: 'center',
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  skipQuizText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
  formWrap: {
    marginTop: 24,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  formTitleAccent: {
    color: COLORS.accent,
  },
  textField: {
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.ink,
    backgroundColor: COLORS.cardBg,
  },
  budgetField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
  },
  budgetCurrency: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.accent,
    marginRight: 8,
  },
  budgetInput: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
    flex: 1,
    letterSpacing: -0.5,
  },
  formHint: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  authScreen: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  authTopBar: {
    paddingTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  authTopBarBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.screenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTopBarBackIcon: {
    fontSize: 26,
    color: COLORS.ink,
    lineHeight: 28,
    fontWeight: '600',
  },
  authHero: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  authHeroSignUp: {
    paddingTop: 56,
    paddingBottom: 14,
  },
  authHeroMascot: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 2,
  },
  authHeroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  authHeroTitleAccent: {
    color: COLORS.accent,
  },
  authHeroSubtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  authErrorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  authErrorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '500',
  },
  authFormArea: {
    flex: 1,
    gap: 12,
    paddingTop: 4,
  },
  authFormAreaSignUp: {
    gap: 16,
    paddingTop: 28,
  },
  authCard: {
    borderRadius: 20,
    backgroundColor: COLORS.screenBg,
    padding: 20,
    gap: 14,
  },
  authFieldGroup: {
    gap: 6,
  },
  authFieldLabel: {
    fontSize: 13,
    color: COLORS.inkSoft,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  authFieldInput: {
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
  },
  authCta: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  authCtaText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  authCtaOutline: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
  },
  authCtaOutlineText: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  authDisabled: {
    opacity: 0.5,
  },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.softBorder,
  },
  authDividerLabel: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
  },
  authProviderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
  },
  authProviderBtnDark: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  authProviderBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  authProviderBtnLabelLight: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  authProviderBtnIconGoogle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    width: 20,
    textAlign: 'center',
  },
  authProviderBtnIconApple: {
    fontSize: 18,
    color: COLORS.white,
    width: 20,
    textAlign: 'center',
  },
  authProviderBtnIconEmail: {
    fontSize: 16,
    color: COLORS.ink,
    width: 20,
    textAlign: 'center',
  },
  authSwitchLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  authSwitchLinkTight: {
    paddingVertical: 2,
    marginTop: -4,
  },
  authSwitchLinkText: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
  },
  authFooter: {
    paddingTop: 8,
    gap: 10,
    alignItems: 'center',
  },
  authTerms: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  authTermsHighlight: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  authBottomActions: {
    marginTop: 12,
    gap: 12,
    paddingTop: 12,
  },
  contentNoScroll: {
    flexGrow: 1,
  },
  helpWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  helpTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
    maxWidth: 320,
  },
  helpBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    maxWidth: 320,
  },
  permissionWrap: {
    marginTop: 20,
  },
  permissionCard: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    padding: 20,
    backgroundColor: COLORS.cardBg,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 8,
  },
  permissionBody: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  permissionButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  consequenceWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  consequenceMascotImage: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  consequenceTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    maxWidth: 320,
  },
  consequenceBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    maxWidth: 320,
  },
  questionWrap: {
    marginTop: 24,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 24,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  questionHint: {
    marginTop: -12,
    marginBottom: 10,
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  optionList: {
    gap: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.cardBg,
  },
  optionRowActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  optionIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.warmGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIndexActive: {
    backgroundColor: COLORS.accent,
  },
  optionIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  optionIndexTextActive: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 15,
    color: COLORS.ink,
    fontWeight: '500',
  },
  optionTextActive: {
    color: COLORS.ink,
    fontWeight: '600',
  },
  wheelWrap: {
    height: 220,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.cardBg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  wheelContent: {
    paddingVertical: 88,
  },
  wheelItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 18,
    color: COLORS.muted,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 88,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  wheelHighlightText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
  },
  bottomProgressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.softBorder,
    overflow: 'hidden',
    marginBottom: 16,
  },
  bottomProgressTrackDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bottomProgressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  bottomProgressFillDark: {
    backgroundColor: COLORS.accentLight,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 14,
    backgroundColor: 'transparent',
  },
  bottomBarDark: {
    backgroundColor: 'transparent',
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryButtonLight: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.25,
  },
  primaryButtonWarm: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.25,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  primaryButtonTextDark: {
    color: '#FFFFFF',
  },
  primaryButtonTextWarm: {
    color: '#FFFFFF',
  },
  progressDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(136,146,168,0.3)',
  },
  progressDotActive: {
    width: 20,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  consequencesCombinedWrap: {
    paddingTop: 6,
  },
  consequencesCombinedTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    lineHeight: 36,
    marginBottom: 10,
    letterSpacing: -0.6,
  },
  consequencesCombinedSubtext: {
    fontSize: 15,
    color: COLORS.inkSoft,
    lineHeight: 23,
    marginBottom: 16,
  },
  consequencesCombinedList: {
    gap: 10,
  },
  consequenceRowItem: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  consequenceRowImage: {
    width: 54,
    height: 54,
    resizeMode: 'contain',
  },
  consequenceRowCopy: {
    flex: 1,
  },
  consequenceRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
  },
  consequenceRowBody: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  consequencesCombinedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  consequenceCard: {
    width: '48%',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  consequenceCardImage: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  consequenceCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  consequenceCardBody: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  showcaseWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  showcaseImageWrap: {
    width: 200,
    height: 200,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  showcaseImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  showcaseTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  showcaseBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  preparingResultsText: {
    marginTop: 24,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  affirmationCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 20,
    padding: 18,
  },
  affirmationLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  affirmationPrompt: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 12,
  },
  affirmationInput: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 24,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderGraphImage: {
    width: '100%',
    maxWidth: 380,
    height: 350,
    resizeMode: 'contain',
    marginTop: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: COLORS.muted,
    fontWeight: '600',
  },
});
