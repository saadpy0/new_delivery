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
  Switch,
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
  navy: '#1A1A2E',
  navySoft: '#2D2D44',
  sky: '#F5E6D3',
  skySoft: '#FAF3EB',
  ink: '#1A1A2E',
  muted: '#8E8E93',
  white: '#FFFFFF',
  cream: '#FAF8F5',
  coral: '#E8734A',
  sage: '#7BAE7F',
  gold: '#D4A853',
  warmGray: '#F2EFEB',
  softBorder: '#E8E4DF',
};

const PRO_ENTITLEMENT_ID = 'undelivery Pro';
const ONBOARDING_DRAFT_KEY = '@onboarding_draft_v1';
const { ScreenTimeManager, NotificationPermissionManager } = NativeModules;
const IOS_BUNDLE_ID = 'com.quitbite.quitbite';
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
    question: "What\u2019s the main reason you order delivery?",
    options: ['Convenience', 'Cravings', 'No time to cook', 'Stress/comfort', 'Habit'],
  },
  {
    key: 'q4',
    type: 'choice',
    label: 'Question 4',
    question: 'How old are you?',
    options: ['Under 18', '18\u201324', '25\u201334', '35\u201344', '45+'],
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
    body: 'Get quick, realistic steps that move you from delivery dependence to easy home meals.',
  },
  {
    key: 'help-3',
    type: 'help',
    title: 'See the opportunity cost',
    body: "Every order shows what you\u2019re trading away, so it\u2019s easier to choose your goals.",
  },
  {
    key: 'showcase-1',
    type: 'showcase',
    title: 'Block apps when you overspend',
    body: 'QuitBite automatically shields delivery apps once you hit your weekly budget \u2014 no willpower needed.',
    showcaseImage: 'block',
  },
  {
    key: 'showcase-2',
    type: 'showcase',
    title: 'Track every dollar in real time',
    body: 'See exactly where your money goes with weekly breakdowns, streaks, and opportunity cost insights.',
    showcaseImage: 'track',
  },
  {
    key: 'placeholder-1',
    type: 'placeholder',
    title: '',
    body: '',
  },
  {
    key: 'placeholder-2',
    type: 'placeholder',
    title: '',
    body: '',
  },
  {
    key: 'permission',
    type: 'permission',
    title: 'Allow app blocking',
    body:
      'QuitBite needs Screen Time permission to block delivery apps when you hit your budget.',
  },
  {
    key: 'notifications',
    type: 'notifications',
    title: 'Enable helpful reminders',
    body: 'Get nudges that keep you on track and cooking instead of ordering.',
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
    body:
      'This app was designed for people like you. The higher the rating, the more we can help others.',
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
    key: 'auth-signup',
    type: 'auth-sign-up',
    title: 'Sign up to continue',
    body: 'Please use one of the following ways to create your account.',
  },
  {
    key: 'auth-signin',
    type: 'auth-sign-in',
    title: 'Sign in to continue',
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

export default function Onboarding({ onSkipToDashboard, onOnboardingComplete }: { onSkipToDashboard?: () => void; onOnboardingComplete?: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [weeklyBudget, setWeeklyBudget] = useState('100');
  const [budgetReminders, setBudgetReminders] = useState(true);
  const [cookingIdeas, setCookingIdeas] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'annual' | null>('monthly');
  const [didSignIn, setDidSignIn] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [onboardingSaved, setOnboardingSaved] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPlanOverlay, setShowPlanOverlay] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [selectedAppCount, setSelectedAppCount] = useState(0);
  const [affirmation, setAffirmation] = useState('');
  const ratingPromptShownRef = useRef(false);
  const totalSteps = SCREENS.length;
  const current = SCREENS[step];
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
    const restoreDraft = async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (typeof draft.step === 'number') setStep(draft.step);
        if (typeof draft.name === 'string') setName(draft.name);
        if (typeof draft.weeklyBudget === 'string') setWeeklyBudget(draft.weeklyBudget);
        if (typeof draft.affirmation === 'string') setAffirmation(draft.affirmation);
        if (typeof draft.selectedAppCount === 'number') setSelectedAppCount(draft.selectedAppCount);
        if (typeof draft.budgetReminders === 'boolean') setBudgetReminders(draft.budgetReminders);
        if (typeof draft.cookingIdeas === 'boolean') setCookingIdeas(draft.cookingIdeas);
        if (draft.answers && typeof draft.answers === 'object') setAnswers(draft.answers);
      } catch (error) {
        console.warn('Failed to restore onboarding draft', error);
      }
    };
    void restoreDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(
          ONBOARDING_DRAFT_KEY,
          JSON.stringify({
            step,
            name,
            weeklyBudget,
            affirmation,
            selectedAppCount,
            budgetReminders,
            cookingIdeas,
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
    budgetReminders,
    cookingIdeas,
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

  const requestNotificationPermission = async () => {
    if (!NotificationPermissionManager?.requestAuthorization) {
      Alert.alert('Unavailable', 'Notification permission is not available on this device.');
      return false;
    }
    try {
      const granted = await NotificationPermissionManager.requestAuthorization();
      if (!granted) {
        Alert.alert('Permission denied', 'Please allow notifications to enable reminders.');
      }
      return granted;
    } catch (error: any) {
      Alert.alert('Permission failed', error?.message ?? 'Unable to enable notifications.');
      return false;
    }
  };

  const handleNotificationToggle = async (type: 'budget' | 'cooking', value: boolean) => {
    if (!value) {
      if (type === 'budget') {
        setBudgetReminders(false);
      } else {
        setCookingIdeas(false);
      }
      return;
    }

    const granted = await requestNotificationPermission();
    if (type === 'budget') {
      setBudgetReminders(granted);
    } else {
      setCookingIdeas(granted);
    }
  };

  const handleNotificationPreference = async (type: 'budget' | 'cooking') => {
    const granted = await requestNotificationPermission();
    if (type === 'budget') {
      setBudgetReminders(granted);
    } else {
      setCookingIdeas(granted);
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
    };
    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setAuthComplete(Boolean(newSession?.user));
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const buildQuizAnswers = () => {
    return Object.entries(answers).reduce<Record<string, string | number>>((acc, [key, index]) => {
      const screen = SCREENS.find((item) => item.key === key);
      const options = (screen as any)?.options ?? [];
      if ((screen as any)?.type === 'wheel') {
        const option = options?.[index] ?? index;
        const suffix = (screen as any)?.suffix ?? '';
        acc[key] = `${option} ${suffix}`.trim();
        return acc;
      }
      if ((screen as any)?.type === 'choice') {
        acc[key] = options?.[index] ?? index;
      }
      return acc;
    }, {});
  };

  const saveOnboarding = async (): Promise<boolean> => {
    if (onboardingSaving || onboardingSaved) return false;
    setOnboardingSaving(true);
    const weeklyBudgetValue = Number(weeklyBudget);
    const success = await saveOnboardingData({
      quiz_answers: buildQuizAnswers(),
      name: name.trim(),
      weekly_budget: Number.isFinite(weeklyBudgetValue) ? weeklyBudgetValue : 120,
      affirmation: affirmation.trim(),
      notification_prefs: {
        budget_reminders: budgetReminders,
        cooking_ideas: cookingIdeas,
      },
      selected_app_count: selectedAppCount,
      blocking_mode: 'moderate',
    });
    if (success) {
      setOnboardingSaved(true);
      await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } else {
      console.warn('Failed to save onboarding data');
    }
    setOnboardingSaving(false);
    return success;
  };

  useEffect(() => {
    if (current.type !== 'auth-sign-up' && current.type !== 'auth-sign-in') return;
    if (!authComplete || !didSignIn) return;
    if (onboardingSaved) {
      onOnboardingComplete?.();
      return;
    }
    if (onboardingSaving) return;
    const completeOAuthOnboarding = async () => {
      const saved = await saveOnboarding();
      if (saved) {
        onOnboardingComplete?.();
      }
    };
    void completeOAuthOnboarding();
  }, [authComplete, didSignIn, current.type, onboardingSaved, onboardingSaving]);


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

    if (
      current.type === 'auth-sign-up' ||
      current.type === 'auth-sign-in' ||
      current.type === 'auth-email-sign-up' ||
      current.type === 'auth-email-sign-in'
    ) {
      const isProviderAuthScreen = current.type === 'auth-sign-up' || current.type === 'auth-sign-in';
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
        <View style={styles.authWrap}>
          <Image source={require('./other_imgs/mascot_transp.png')} style={styles.authMascotImage} />
          <Text style={styles.authTitle}>{current.title}</Text>
          <Text style={styles.authBody}>{current.body}</Text>

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <View style={styles.authActions}>
            {isProviderAuthScreen ? (
              <>
                <Pressable
                  onPress={handleGoogleAuth}
                  disabled={authLoading}
                  style={[styles.authProviderButton, styles.authProviderButtonDark, authLoading && styles.authButtonDisabled]}
                >
                  <Text style={[styles.authProviderIcon, styles.authGoogleIcon]}>G</Text>
                  <Text style={[styles.authProviderText, styles.authProviderTextLight]}>Continue with Google</Text>
                </Pressable>

                {Platform.OS === 'ios' ? (
                  <Pressable
                    onPress={handleAppleAuth}
                    disabled={authLoading}
                    style={[styles.authProviderButton, styles.authProviderButtonDark, authLoading && styles.authButtonDisabled]}
                  >
                    <Text style={[styles.authProviderIcon, styles.authProviderIconLight]}></Text>
                    <Text style={[styles.authProviderText, styles.authProviderTextLight]}>Continue with Apple</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => {
                    setAuthError(null);
                    const targetType = isSignInScreen ? 'auth-email-sign-in' : 'auth-email-sign-up';
                    const targetIndex = SCREENS.findIndex((screen) => screen.type === targetType);
                    if (targetIndex !== -1) {
                      setStep(targetIndex);
                    }
                  }}
                  disabled={authLoading}
                  style={[styles.authProviderButton, styles.authProviderButtonDark, authLoading && styles.authButtonDisabled]}
                >
                  <Text style={[styles.authProviderIcon, styles.authProviderIconLight]}>@</Text>
                  <Text style={[styles.authProviderText, styles.authProviderTextLight]}>Continue with Email</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.authEmailCard}>
                  <View style={styles.authFieldGroup}>
                    <Text style={styles.authLabel}>Email</Text>
                    <TextInput
                      value={authEmail}
                      onChangeText={setAuthEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="you@example.com"
                      placeholderTextColor={COLORS.muted}
                      style={styles.authInput}
                    />
                  </View>
                  <View style={styles.authFieldGroup}>
                    <Text style={styles.authLabel}>Password</Text>
                    <TextInput
                      value={authPassword}
                      onChangeText={setAuthPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.muted}
                      style={styles.authInput}
                    />
                  </View>
                  <Pressable
                    onPress={handleEmailAuth}
                    disabled={authLoading}
                    style={[styles.authPrimaryButton, authLoading && styles.authButtonDisabled]}
                  >
                    {authLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.authPrimaryButtonText}>
                        {isSignInScreen ? 'Sign in' : 'Create account'}
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    setAuthError(null);
                    const targetType = isSignInScreen ? 'auth-sign-in' : 'auth-sign-up';
                    const targetIndex = SCREENS.findIndex((screen) => screen.type === targetType);
                    if (targetIndex !== -1) {
                      setStep(targetIndex);
                    }
                  }}
                  style={styles.authLinkButton}
                >
                  <Text style={styles.authLinkText}>Use Google or Apple instead</Text>
                </Pressable>
              </>
            )}

            {isProviderAuthScreen ? (
              <Pressable
                onPress={() => {
                  const targetType = isSignInScreen ? 'auth-sign-up' : 'auth-sign-in';
                  const targetIndex = SCREENS.findIndex((screen) => screen.type === targetType);
                  if (targetIndex !== -1) {
                    setStep(targetIndex);
                  }
                }}
                style={styles.authLinkButton}
              >
                <Text style={styles.authLinkText}>
                  {isSignInScreen
                    ? 'Need an account? Sign up'
                    : 'Already have an account? Sign in'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                const welcomeIndex = SCREENS.findIndex((screen) => screen.type === 'welcome');
                if (welcomeIndex !== -1) {
                  setStep(welcomeIndex);
                }
              }}
              style={styles.authBackToWelcomeButton}
            >
              <Text style={styles.authBackToWelcomeText}>Back to welcome screen</Text>
            </Pressable>
          </View>

          {!isSignInScreen ? (
            <View style={styles.authTermsFooter}>
              <Text style={styles.authTermsText}>
                By continuing you confirm that you have read and agreed to our{' '}
                <Text style={styles.authTermsLink}>Terms of Service</Text> and consent to our{' '}
                <Text style={styles.authTermsLink}>Privacy Policy</Text>.
              </Text>
            </View>
          ) : null}
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
      return (
        <View style={styles.ratingWrap}>
          <Text style={styles.ratingStars}>★★★★★</Text>
          <Text style={styles.ratingTitle}>{current.title}</Text>
          <Text style={styles.ratingBody}>{current.body}</Text>
          <View style={styles.ratingBadgeRow}>
            <View style={styles.ratingAvatarGroup}>
              <View style={styles.ratingAvatar} />
              <View style={[styles.ratingAvatar, styles.ratingAvatarOverlap]} />
              <View style={[styles.ratingAvatar, styles.ratingAvatarOverlap]} />
            </View>
            <Text style={styles.ratingSocial}>100,000+ people</Text>
          </View>
          <View style={styles.ratingCard}>
            <View style={styles.ratingCardHeader}>
              <Text style={styles.ratingCardStars}>★★★★★</Text>
              <Text style={styles.ratingCardName}>Sarah Jen.</Text>
            </View>
            <Text style={styles.ratingCardText}>
              "This app felt like a reset button. I finally understand where my money was going."
            </Text>
          </View>
          <View style={styles.ratingCard}>
            <View style={styles.ratingCardHeader}>
              <Text style={styles.ratingCardStars}>★★★★★</Text>
              <Text style={styles.ratingCardName}>Jessica Lee</Text>
            </View>
            <Text style={styles.ratingCardText}>
              "The budget nudges make me pause before ordering. I save weekly now."
            </Text>
          </View>
        </View>
      );
    }

    if (current.type === 'commitment') {
      const items = [
        'Be willing and open to learn',
        'Try to become the best version of myself',
        'Be open to change',
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
            <Text style={styles.affirmationLabel}>Type your affirmation</Text>
            <TextInput
              value={affirmation}
              onChangeText={setAffirmation}
              placeholder="I commit to taking control of my habits"
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
              onChangeText={setWeeklyBudget}
              keyboardType="number-pad"
              style={styles.budgetInput}
            />
          </View>
          <Text style={styles.formHint}>Most people start between $75–$150.</Text>
        </View>
      );
    }

    if (current.type === 'help') {
      const helpEmoji = current.key === 'help-1' ? '💸' : current.key === 'help-2' ? '🧑‍🍳' : '🎯';
      return (
        <View style={styles.helpWrap}>
          <View style={styles.illustrationLight}>
            <Text style={styles.illustrationEmoji}>{helpEmoji}</Text>
          </View>
          <Text style={styles.helpTitle}>{current.title}</Text>
          <Text style={styles.helpBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'permission') {
      return (
        <View style={styles.permissionWrap}>
          <Text style={styles.formTitle}>{current.title}</Text>
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

    if (current.type === 'notifications') {
      return (
        <View style={styles.permissionWrap}>
          <Text style={styles.formTitle}>{current.title}</Text>
          <Text style={styles.formHint}>{current.body}</Text>
          <View style={styles.notificationCard}>
            <View style={styles.notificationRow}>
              <Text style={styles.notificationText}>Daily budget reminders</Text>
              <Switch
                value={budgetReminders}
                onValueChange={(value) => handleNotificationToggle('budget', value)}
              />
            </View>
            <View style={styles.notificationRow}>
              <Text style={styles.notificationText}>Cooking ideas before meals</Text>
              <Switch
                value={cookingIdeas}
                onValueChange={(value) => handleNotificationToggle('cooking', value)}
              />
            </View>
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
          <Text style={styles.formTitle}>{current.title}</Text>
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
          <Text style={styles.preparingResultsText}>Preparing your results...</Text>
        </View>
      );
    }

    if (current.type === 'showcase') {
      const showcaseImg = current.showcaseImage === 'block'
        ? require('./mascots/fatty.png')
        : require('./mascots/scale.png');
      return (
        <View style={styles.showcaseWrap}>
          <View style={styles.showcaseImageWrap}>
            <Image source={showcaseImg} style={styles.showcaseImage} />
          </View>
          <Text style={styles.showcaseTitle}>{current.title}</Text>
          <Text style={styles.showcaseBody}>{current.body}</Text>
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
      const options = current.options ?? [];
      return (
        <View style={styles.questionWrap}>
          <Text style={styles.questionLabel}>{current.label}</Text>
          <Text style={styles.questionTitle}>{current.question}</Text>
          <View style={styles.optionList}>
            {options.map((option, index) => (
              <Pressable
                key={option}
                onPress={() => setAnswers((prev) => ({ ...prev, [current.key]: index }))}
                style={[styles.optionRow, selected === index && styles.optionRowActive]}
              >
                <View style={[styles.optionIndex, selected === index && styles.optionIndexActive]}>
                  <Text style={[styles.optionIndexText, selected === index && styles.optionIndexTextActive]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.optionText, selected === index && styles.optionTextActive]}>
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
      const selected = answers[current.key] ?? 0;
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
    if (current.type === 'fact' || current.type === 'fact-progress') return '#FFFFFF';
    if (current.type === 'ack' || current.type === 'consequence' || current.type === 'consequences-combined') return '#FFFFFF';
    if (current.type === 'choice' || current.type === 'wheel') return '#FFFFFF';
    if (current.type === 'showcase') return '#FFFFFF';
    return COLORS.cream;
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
                        : current.type === 'notifications'
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
    current.type === 'auth-sign-up' ||
    current.type === 'auth-sign-in' ||
    current.type === 'auth-email-sign-up' ||
    current.type === 'auth-email-sign-in';
  const progressDotIndex = Math.min(2, Math.floor((step / Math.max(1, totalSteps - 1)) * 3));
  const isNextDisabled =
    current.type === 'choice'
      ? answers[current.key] === undefined
      : current.type === 'wheel'
        ? answers[current.key] === undefined
        : current.type === 'name'
          ? name.trim().length === 0
          : current.type === 'budget'
            ? weeklyBudget.trim().length === 0
            : current.type === 'commitment'
              ? affirmation.trim().length < 10
              : isAuthScreen
                ? !authComplete
                : current.type === 'paywall'
                  ? selectedPlan === null || isPurchasing || isLoadingOfferings
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
              const authIndex = SCREENS.findIndex((s) => s.type === 'auth-sign-in');
              if (authIndex !== -1) setStep(authIndex);
            }}>
              <Text style={styles.welcomeSignInHint}>Existing user? Sign in</Text>
            </Pressable>
            <View style={styles.progressDotsRow}>
              {[0, 1, 2].map((dot) => (
                <View key={`welcome-dot-${dot}`} style={[styles.progressDot, dot === progressDotIndex && styles.progressDotActive]} />
              ))}
            </View>
            <Pressable
              onPress={handleNext}
              style={[styles.primaryButton, { width: '100%' }]}
            >
              <Text style={styles.primaryButtonText}>
                {primaryLabel}
              </Text>
            </Pressable>
            <Pressable onPress={() => onSkipToDashboard?.()} style={styles.welcomeSkipButton}>
              <Text style={styles.welcomeSkipText}>Skip onboarding</Text>
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
    const overlayNextDisabled = selectedPlan === null || isPurchasing || isLoadingOfferings;
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
              <Text style={styles.overlayFootnote}>No payment now. Cancel anytime.</Text>
            </View>
          </ImageBackground>
        </Modal>
      </View>
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
    paddingHorizontal: 12,
    paddingTop: 4,
    minHeight: 30,
  },
  welcomeTopNav: {
    paddingHorizontal: 12,
    paddingTop: 60,
    minHeight: 30,
  },
  welcomeBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 44,
    paddingTop: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  welcomeSignInHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  welcomeSkipButton: {
    marginTop: 12,
  },
  welcomeSkipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  welcomeContent: {
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 160,
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
    backgroundColor: '#4A6CF7',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 32,
    height: 32,
  },
  backIcon: {
    fontSize: 26,
    color: COLORS.ink,
  },
  backIconLight: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    flexGrow: 1,
  },
  splashWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 16,
    marginBottom: 28,
  },
  welcomeMascotImage: {
    width: 260,
    height: 300,
    resizeMode: 'contain',
  },
  illustrationWarm: {
    height: 220,
    borderRadius: 32,
    backgroundColor: COLORS.warmGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  illustrationLight: {
    height: 150,
    borderRadius: 28,
    backgroundColor: COLORS.warmGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  illustrationEmoji: {
    fontSize: 52,
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
    color: 'rgba(255,255,255,0.65)',
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
    color: 'rgba(255,255,255,0.55)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  nonQuizProgressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#4A6CF7',
  },
  nonQuizProgressFillDark: {
    backgroundColor: '#7B9BFF',
  },
  factWrap: {
    marginTop: 8,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  factOneWrap: {
    paddingTop: 0,
  },
  factMascotImage: {
    width: 390,
    height: 470,
    resizeMode: 'contain',
    marginBottom: 0,
  },
  factOneMascotImage: {
    marginBottom: -8,
    marginTop: -24,
  },
  opportunityMascotImage: {
    width: 330,
    height: 390,
    marginBottom: 0,
  },
  factLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5B6ABF',
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  factOneLabel: {
    marginBottom: 12,
  },
  factBody: {
    fontSize: 21,
    lineHeight: 32,
    color: COLORS.ink,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
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
    backgroundColor: '#4A6CF7',
  },
  resultsLabel: {
    fontSize: 12,
    marginTop: 10,
    color: COLORS.muted,
  },
  resultsWrap: {
    marginTop: 6,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 16,
    letterSpacing: -0.6,
  },
  resultsMascotArea: {
    alignItems: 'center',
    marginBottom: 4,
  },
  resultsMascotImage: {
    width: 180,
    height: 160,
    resizeMode: 'contain',
  },
  resultsSubtitle: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  resultsBody: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultsSection: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6CF7',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  resultsCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  resultsBadge: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: '#4A6CF7',
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
    color: COLORS.ink,
    lineHeight: 21,
  },
  ackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 120,
  },
  ackIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.warmGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ackIcon: {
    fontSize: 38,
  },
  ackMascotImage: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
    marginBottom: 28,
  },
  ackTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4A6CF7',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ackBody: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  ratingWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  ratingStars: {
    fontSize: 20,
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
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 330,
    marginBottom: 20,
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
    backgroundColor: 'rgba(232,115,74,0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  ratingAvatarOverlap: {
    marginLeft: -10,
  },
  ratingSocial: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  ratingCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  ratingCardText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
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
    color: 'rgba(255,255,255,0.6)',
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
    borderColor: '#4A6CF7',
    backgroundColor: 'rgba(74,108,247,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentCheckText: {
    color: '#4A6CF7',
    fontSize: 12,
    fontWeight: '700',
  },
  commitmentText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
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
    color: 'rgba(255,255,255,0.35)',
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  accessTileIcon: {
    fontSize: 14,
    color: '#4A6CF7',
    marginBottom: 10,
  },
  accessTileText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
    fontWeight: '500',
  },
  accessTestimonial: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.65)',
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
    color: '#4A6CF7',
    fontWeight: '700',
  },
  transformationDate: {
    marginTop: 8,
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
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
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: '#4caef9',
    borderRadius: 14,
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
    backgroundColor: '#1A1A2E',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    paddingBottom: 26,
  },
  overlayTrialButton: {
    backgroundColor: '#4caef9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  overlayTrialButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  overlayFootnote: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  planBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#4caef9',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
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
    backgroundColor: '#FFD76A',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    shadowColor: '#FFD76A',
    shadowOpacity: 0.35,
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
    color: '#4A6CF7',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  paywallBenefits: {
    borderRadius: 20,
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
    color: 'rgba(255,255,255,0.6)',
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
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
  },
  paywallPlanCardActive: {
    borderColor: '#4caef9',
    backgroundColor: 'rgba(76,174,249,0.12)',
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
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallPlanRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4caef9',
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
    color: 'rgba(255,255,255,0.5)',
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
    color: '#4A6CF7',
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
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  skipQuizText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
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
  textField: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
  },
  budgetField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  budgetCurrency: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4A6CF7',
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
  authWrap: {
    marginTop: 4,
    alignItems: 'center',
    width: '100%',
    minHeight: 620,
  },
  authMascotImage: {
    width: 220,
    height: 210,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  authBody: {
    fontSize: 15,
    color: COLORS.muted,
    marginBottom: 18,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  authFieldGroup: {
    marginBottom: 14,
  },
  authLabel: {
    fontSize: 12,
    color: COLORS.ink,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  authInput: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
  },
  authError: {
    fontSize: 13,
    color: '#E53E3E',
    marginBottom: 12,
  },
  authActions: {
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  authProviderButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  authProviderButtonDark: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  authProviderIcon: {
    fontSize: 16,
    color: COLORS.ink,
    fontWeight: '700',
    width: 16,
    textAlign: 'center',
  },
  authProviderIconLight: {
    color: '#FFFFFF',
  },
  authGoogleIcon: {
    color: '#4285F4',
  },
  authProviderText: {
    color: COLORS.ink,
    fontWeight: '600',
    fontSize: 15,
  },
  authProviderTextLight: {
    color: '#FFFFFF',
  },
  authEmailCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: '#F7F9FF',
    padding: 14,
    gap: 10,
  },
  authSecondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.white,
  },
  authSecondaryButtonText: {
    color: COLORS.ink,
    fontWeight: '600',
    fontSize: 15,
  },
  authPrimaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.ink,
  },
  authPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  authLinkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  authLinkText: {
    fontSize: 13,
    color: '#4A6CF7',
    fontWeight: '600',
  },
  authTermsText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  authTermsLink: {
    color: '#4A6CF7',
    fontWeight: '600',
  },
  authTermsFooter: {
    marginTop: 88,
    paddingBottom: 4,
    width: '100%',
  },
  authBackToWelcomeButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  authBackToWelcomeText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
  authButtonDisabled: {
    opacity: 0.5,
  },
  helpWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  helpBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  permissionWrap: {
    marginTop: 20,
  },
  permissionCard: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 20,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
    backgroundColor: COLORS.ink,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  notificationCard: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 20,
    backgroundColor: COLORS.white,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: {
    fontSize: 15,
    color: COLORS.ink,
    fontWeight: '500',
  },
  consequenceWrap: {
    marginTop: 0,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 120,
    paddingHorizontal: 28,
  },
  consequenceMascotImage: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
    marginBottom: 28,
  },
  consequenceTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4A6CF7',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  consequenceBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
  questionWrap: {
    marginTop: 28,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A6CF7',
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
  optionList: {
    gap: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.white,
  },
  optionRowActive: {
    borderColor: '#4A6CF7',
    backgroundColor: 'rgba(74,108,247,0.06)',
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
    backgroundColor: '#4A6CF7',
  },
  optionIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.white,
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
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#4A6CF7',
    backgroundColor: '#F0F3FE',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bottomProgressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#4A6CF7',
  },
  bottomProgressFillDark: {
    backgroundColor: '#7B9BFF',
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
    borderRadius: 28,
    backgroundColor: '#4A6CF7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A6CF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonLight: {
    backgroundColor: '#4A6CF7',
    shadowColor: '#4A6CF7',
    shadowOpacity: 0.25,
  },
  primaryButtonWarm: {
    backgroundColor: '#4A6CF7',
    shadowColor: '#4A6CF7',
    shadowOpacity: 0.22,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    backgroundColor: 'rgba(110,123,160,0.35)',
  },
  progressDotActive: {
    width: 18,
    backgroundColor: '#4A6CF7',
  },
  consequencesCombinedWrap: {
    paddingTop: 6,
  },
  consequencesCombinedTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink,
    lineHeight: 36,
    marginBottom: 10,
    letterSpacing: -0.7,
  },
  consequencesCombinedSubtext: {
    fontSize: 15,
    color: '#4D5877',
    lineHeight: 23,
    marginBottom: 16,
  },
  consequencesCombinedList: {
    gap: 10,
  },
  consequenceRowItem: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EAFB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consequenceRowImage: {
    width: 58,
    height: 58,
    resizeMode: 'contain',
  },
  consequenceRowCopy: {
    flex: 1,
  },
  consequenceRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2D5A',
    marginBottom: 4,
  },
  consequenceRowBody: {
    fontSize: 13,
    color: '#5B688A',
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
    backgroundColor: COLORS.cream,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  consequenceCardImage: {
    width: 56,
    height: 56,
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
    paddingTop: 16,
  },
  showcaseImageWrap: {
    width: 220,
    height: 220,
    borderRadius: 24,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  showcaseImage: {
    width: 160,
    height: 160,
    resizeMode: 'contain',
  },
  showcaseTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  showcaseBody: {
    fontSize: 16,
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
  placeholderText: {
    fontSize: 18,
    color: COLORS.muted,
    fontWeight: '600',
  },
});
