import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';
import { supabase } from './supabaseClient';

const COLORS = {
  navy: '#0E1730',
  navySoft: '#18264A',
  sky: '#A9D4FF',
  skySoft: '#D7ECFF',
  ink: '#0F172A',
  muted: '#6B7280',
  white: '#FFFFFF',
};

const PRO_ENTITLEMENT_ID = 'undelivery Pro';

const SCREENS = [
  { key: 'splash', type: 'splash' },
  { key: 'welcome', type: 'welcome' },
  {
    key: 'fact-1',
    type: 'fact',
    title: 'Did you know?',
    body:
      'Most people underestimate delivery spend by 2x once fees, tips, and surge pricing are included.',
  },
  {
    key: 'fact-2',
    type: 'fact',
    title: 'Did you know?',
    body:
      'QuitBite shows the real cost of each order and what it steals from your future goals.',
  },
  {
    key: 'q1',
    type: 'choice',
    label: 'Question 1',
    question: 'How much do you spend on delivery per week?',
    options: ['$0–$25', '$26–$50', '$51–$100', '$101–$200', '$200+'],
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
    question: 'What’s the main reason you order delivery?',
    options: ['Convenience', 'Cravings', 'No time to cook', 'Stress/comfort', 'Habit'],
  },
  {
    key: 'q4',
    type: 'choice',
    label: 'Question 4',
    question: 'How old are you?',
    options: ['Under 18', '18–24', '25–34', '35–44', '45+'],
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
    key: 'q9',
    type: 'choice',
    label: 'Question 9',
    question: 'Would a small friction fee (like a $5 penalty) help you pause before ordering?',
    options: ['Yes, I need that', 'Maybe', 'No'],
  },
  {
    key: 'results-prep',
    type: 'fact-progress',
    title: 'Did you know?',
    body:
      'Seeing the opportunity cost of an order makes it 2x easier to skip it and cook instead.',
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
    key: 'consequence-1',
    type: 'consequence',
    title: 'I need more',
    body: 'The more you order, the more normal it feels. That makes it harder to slow down.',
  },
  {
    key: 'consequence-2',
    type: 'consequence',
    title: 'Nothing compares',
    body: 'Convenience can dull the satisfaction of home-cooked meals and simple routines.',
  },
  {
    key: 'consequence-3',
    type: 'consequence',
    title: 'Feeling stuck?',
    body: 'Frequent orders can pile on guilt, stress, and lost momentum toward your goals.',
  },
  {
    key: 'consequence-4',
    type: 'consequence',
    title: 'It adds up',
    body: 'Over time, small orders become major spending leaks and missed savings wins.',
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
    key: 'auth',
    type: 'auth',
    title: 'Create your account',
    body: 'Save your budget and results across devices.',
  },
  {
    key: 'help-1',
    type: 'help',
    title: 'Automated financial friction',
    body: 'Make ordering feel costly with a custom “pause fee” that helps you slow down.',
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
    body: 'Every order shows what you’re trading away, so it’s easier to choose your goals.',
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
    key: 'motivation-2',
    type: 'motivation',
    title: "Don't waste this opportunity.",
  },
  {
    key: 'last-thing',
    type: 'last-thing',
    title: "There's one last thing we need from you.",
  },
  {
    key: 'access',
    type: 'access',
    title: 'Get full access to',
  },
  {
    key: 'transformation',
    type: 'transformation',
    title: 'The magic you’re looking for is in the work you’re avoiding.',
  },
  {
    key: 'paywall',
    type: 'paywall',
    title: 'Choose your plan',
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [weeklyBudget, setWeeklyBudget] = useState('100');
  const [budgetReminders, setBudgetReminders] = useState(true);
  const [cookingIdeas, setCookingIdeas] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly' | null>('annual');
  const [authMode, setAuthMode] = useState<'sign_up' | 'sign_in'>('sign_up');
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
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const totalSteps = SCREENS.length;
  const progress = useMemo(() => (step + 1) / totalSteps, [step, totalSteps]);
  const current = SCREENS[step];
  const oauthRedirectUrl = 'com.quitbite.quitbite://login-callback';

  const handleNext = () => {
    setStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const syncSubscription = async (info: any) => {
    const { data, error } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (error || !userId) return;
    const entitlement = (info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
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
    const index = SCREENS.findIndex((screen) => screen.key === 'q9');
    if (index !== -1) {
      setStep(index);
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

  const saveOnboarding = async () => {
    if (onboardingSaving || onboardingSaved) return;
    setOnboardingSaving(true);
    const { data, error } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (error || !userId) {
      console.warn('Failed to load user for onboarding save', error?.message ?? 'no user');
      setOnboardingSaving(false);
      return;
    }
    const weeklyBudgetValue = Number(weeklyBudget);
    const payload = {
      user_id: userId,
      name: name.trim() || null,
      weekly_budget: Number.isFinite(weeklyBudgetValue) ? weeklyBudgetValue : null,
      quiz_answers: buildQuizAnswers(),
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await supabase.from('onboarding').upsert(payload, {
      onConflict: 'user_id',
    });
    if (saveError) {
      console.warn('Failed to save onboarding', saveError.message);
    } else {
      setOnboardingSaved(true);
    }
    setOnboardingSaving(false);
  };

  useEffect(() => {
    if (current.type !== 'auth') return;
    if (authComplete) {
      handleNext();
    }
  }, [authComplete, current.type]);

  useEffect(() => {
    if (!authComplete) return;
    void logInRevenueCat();
  }, [authComplete]);

  useEffect(() => {
    if (current.type !== 'paywall') return;
    void loadOfferings();
  }, [current.type]);

  useEffect(() => {
    if (current.key !== 'help-1') return;
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

    if (current.type === 'auth') {
      const handleEmailAuth = async () => {
        setAuthLoading(true);
        setAuthError(null);
        const payload = {
          email: authEmail.trim(),
          password: authPassword,
        };
        const { error } =
          authMode === 'sign_in'
            ? await supabase.auth.signInWithPassword(payload)
            : await supabase.auth.signUp(payload);
        if (error) {
          setAuthError(error.message);
        } else {
          handleNext();
        }
        setAuthLoading(false);
      };

      const handleGoogleAuth = async () => {
        setAuthLoading(true);
        setAuthError(null);
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
          <Text style={styles.authTitle}>{current.title}</Text>
          <Text style={styles.authBody}>{current.body}</Text>
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
          {authError ? <Text style={styles.authError}>{authError}</Text> : null}
          <View style={styles.authActions}>
            <Pressable
              onPress={handleGoogleAuth}
              disabled={authLoading}
              style={[styles.authSecondaryButton, authLoading && styles.authButtonDisabled]}
            >
              {authLoading ? (
                <ActivityIndicator color={COLORS.navy} />
              ) : (
                <Text style={styles.authSecondaryButtonText}>Continue with Google</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleEmailAuth}
              disabled={authLoading}
              style={[styles.authPrimaryButton, authLoading && styles.authButtonDisabled]}
            >
              {authLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.authPrimaryButtonText}>
                  {authMode === 'sign_in' ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setAuthMode(authMode === 'sign_in' ? 'sign_up' : 'sign_in')}
              style={styles.authLinkButton}
            >
              <Text style={styles.authLinkText}>
                {authMode === 'sign_in'
                  ? 'New here? Create an account'
                  : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (current.type === 'paywall') {
      const annualPackage = packages.find((pkg) => pkg?.packageType === 'ANNUAL') ?? null;
      const monthlyPackage = packages.find((pkg) => pkg?.packageType === 'MONTHLY') ?? null;
      const plans = [
        {
          key: 'annual',
          title: 'Annual',
          price: annualPackage?.product?.priceString ?? '$2.50',
          sub: annualPackage ? `${annualPackage.product?.priceString ?? ''} / year` : '$29.99 / year',
          note: 'Best value',
        },
        {
          key: 'monthly',
          title: 'Monthly',
          price: monthlyPackage?.product?.priceString ?? '$14.99',
          sub: monthlyPackage ? `${monthlyPackage.product?.priceString ?? ''} / month` : '$14.99 / month',
          note: 'Flexible',
        },
      ] as const;
      return (
        <View style={styles.paywallWrap}>
          <View style={styles.paywallHeader}>
            <Text style={styles.paywallTitle}>{current.title}</Text>
            <Text style={styles.paywallSubtitle}>90% OFF sale · 5 spots remaining</Text>
          </View>
          {offeringsError ? <Text style={styles.paywallError}>{offeringsError}</Text> : null}
          <View style={styles.paywallBenefits}>
            <Text style={styles.paywallBenefitTitle}>You&apos;re almost there.</Text>
            <Text style={styles.paywallBenefitBody}>
              Unlock full delivery limits, habit breakers, and your weekly transformation plan.
            </Text>
          </View>
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
          <View style={styles.paywallFootnoteRow}>
            <View style={styles.paywallFootnoteDot} />
            <Text style={styles.paywallFootnoteText}>No commitment, cancel anytime</Text>
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
          <View style={styles.signatureCard}>
            <View style={styles.signatureLine} />
            <View style={[styles.signatureLine, styles.signatureLineShort]} />
            <Text style={styles.signatureHint}>Sign here</Text>
          </View>
        </View>
      );
    }

    if (current.type === 'motivation') {
      return (
        <View style={styles.motivationWrap}>
          <Text style={styles.motivationTitle}>{current.title}</Text>
          <Text style={styles.motivationHint}>Tap to continue</Text>
        </View>
      );
    }

    if (current.type === 'last-thing') {
      return (
        <View style={styles.motivationWrap}>
          <Text style={styles.motivationTitle}>{current.title}</Text>
          <Text style={styles.motivationHint}>Tap to continue</Text>
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

    if (current.type === 'transformation') {
      return (
        <View style={styles.transformationWrap}>
          <Text style={styles.transformationTitle}>{current.title}</Text>
          <View style={styles.signatureCard}>
            <Text style={styles.signatureHint}>Signature of commitment</Text>
            <View style={styles.signatureLine} />
          </View>
          <Text style={styles.transformationTag}>IT’S TIME FOR CHANGE</Text>
          <Text style={styles.transformationDate}>Sunday 1 March 2026</Text>
          <View style={styles.transformationFootnote}>
            <Text style={styles.transformationFootnoteText}>Start my transformation</Text>
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
      return (
        <View style={styles.helpWrap}>
          <View style={styles.illustrationLight}>
            <Text style={styles.illustrationEmoji}>🚀</Text>
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
            <Pressable style={styles.permissionButton}>
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
              <Switch value={budgetReminders} onValueChange={setBudgetReminders} />
            </View>
            <View style={styles.notificationRow}>
              <Text style={styles.notificationText}>Cooking ideas before meals</Text>
              <Switch value={cookingIdeas} onValueChange={setCookingIdeas} />
            </View>
          </View>
        </View>
      );
    }


    if (current.type === 'consequence') {
      return (
        <View style={styles.consequenceWrap}>
          <View style={styles.illustrationLight}>
            <Text style={styles.illustrationEmoji}>⚠️</Text>
          </View>
          <Text style={styles.consequenceTitle}>{current.title}</Text>
          <Text style={styles.consequenceBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'results') {
      return (
        <View style={styles.resultsWrap}>
          <Text style={styles.resultsTitle}>Your results</Text>
          <View style={styles.resultsBarTrack}>
            <View style={[styles.resultsBarFill, { width: '72%' }]} />
          </View>
          <Text style={styles.resultsSubtitle}>You&apos;re spending more than you think.</Text>
          <Text style={styles.resultsBody}>
            Based on your answers, delivery is taking a bigger bite out of your weekly budget.
          </Text>
          <Text style={styles.resultsSection}>Insights</Text>
          <View style={styles.resultsCard}>
            <View style={styles.resultsBadge} />
            <Text style={styles.resultsCardText}>Your weekly spend is higher than most users.</Text>
          </View>
          <View style={styles.resultsCard}>
            <View style={[styles.resultsBadge, styles.resultsBadgeWarm]} />
            <Text style={styles.resultsCardText}>Cravings and convenience are the top triggers.</Text>
          </View>
          <View style={styles.resultsCard}>
            <View style={[styles.resultsBadge, styles.resultsBadgeCool]} />
            <Text style={styles.resultsCardText}>You&apos;re ready for a plan that makes skipping easier.</Text>
          </View>
        </View>
      );
    }

    if (current.type === 'ack') {
      return (
        <View style={styles.ackWrap}>
          <View style={styles.ackIconWrap}>
            <Text style={styles.ackIcon}>✨</Text>
          </View>
          <Text style={styles.ackTitle}>{current.title}</Text>
          <Text style={styles.ackBody}>{current.body}</Text>
        </View>
      );
    }

    if (current.type === 'welcome') {
      return (
        <View style={styles.welcomeWrap}>
          <Text style={styles.welcomeHintTop}>Existing user? Sign in</Text>
          <View style={styles.illustrationWarm}>
            <Text style={styles.illustrationEmoji}>🍳</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome!</Text>
          <Text style={styles.welcomeBody}>
            Let&apos;s curb delivery spending and build smarter food habits that actually stick.
          </Text>
        </View>
      );
    }

    if (current.type === 'fact') {
      return (
        <View style={styles.factWrap}>
          <View style={styles.illustrationLight}>
            <Text style={styles.illustrationEmoji}>💡</Text>
          </View>
          <Text style={styles.factTitle}>{current.title}</Text>
          <Text style={styles.factBody}>{current.body}</Text>
          <View style={styles.factProgress} />
        </View>
      );
    }

    if (current.type === 'fact-progress') {
      return (
        <View style={styles.factWrap}>
          <View style={styles.illustrationLight}>
            <Text style={styles.illustrationEmoji}>🌿</Text>
          </View>
          <Text style={styles.factTitle}>{current.title}</Text>
          <Text style={styles.factBody}>{current.body}</Text>
          <View style={styles.resultsProgress}>
            <View style={styles.resultsBarTrack}>
              <View style={[styles.resultsBarFill, { width: `${(current.progressValue ?? 0) * 100}%` }]} />
            </View>
            <Text style={styles.resultsLabel}>{current.progressLabel}</Text>
          </View>
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
    current.type === 'rating' ||
    current.type === 'commitment' ||
    current.type === 'motivation' ||
    current.type === 'last-thing' ||
    current.type === 'access' ||
    current.type === 'transformation' ||
    current.type === 'paywall';
  const backgroundColor = useMemo(() => {
    if (current.type === 'welcome') return COLORS.sky;
    if (isDarkScreen) return COLORS.navy;
    return COLORS.white;
  }, [current.type, isDarkScreen]);

  const primaryLabel =
    current.type === 'welcome'
      ? 'Start quiz'
      : current.key === 'q9'
        ? 'See your results'
        : current.type === 'results'
          ? 'Continue'
          : current.type === 'ack'
            ? 'Continue'
            : current.type === 'symptoms-intro'
              ? current.cta
              : current.type === 'symptoms-select'
                ? current.cta
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
                          : current.type === 'access' || current.type === 'transformation'
                            ? 'Start my transformation'
                            : current.type === 'last-thing'
                              ? 'Continue'
                              : current.type === 'paywall'
                                ? 'Start my journey today'
                              : current.type === 'wheel'
                                ? current.cta
                                : 'Next';
  const isQuiz = current.type === 'choice' || current.type === 'wheel';
  const isPaywall = current.type === 'paywall';
  const isNextDisabled =
    current.type === 'choice'
      ? answers[current.key] === undefined
      : current.type === 'wheel'
        ? answers[current.key] === undefined
        : current.type === 'name'
          ? name.trim().length === 0
          : current.type === 'budget'
            ? weeklyBudget.trim().length === 0
            : current.type === 'auth'
              ? !authComplete
              : current.type === 'paywall'
                ? selectedPlan === null || isPurchasing || isLoadingOfferings
            : false;

  const handlePurchase = async () => {
    if (!isPaywall) {
      handleNext();
      return;
    }
    const annualPackage = packages.find((pkg) => pkg?.packageType === 'ANNUAL') ?? null;
    const monthlyPackage = packages.find((pkg) => pkg?.packageType === 'MONTHLY') ?? null;
    const selectedPackage = selectedPlan === 'annual' ? annualPackage : monthlyPackage;
    if (!selectedPackage) return;
    setIsPurchasing(true);
    setOfferingsError(null);
    try {
      const result = await Purchases.purchasePackage(selectedPackage);
      const info = (result as any)?.customerInfo ?? (await Purchases.getCustomerInfo());
      setCustomerInfo(info);
      await syncSubscription(info);
      handleNext();
    } catch (e: any) {
      if (e?.userCancelled) {
        return;
      }
      setOfferingsError(e?.message ?? String(e));
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor }]}
      >
        <View style={styles.topNav}>
          {isQuiz ? (
            <View style={styles.quizProgressTrack}>
              <View style={[styles.quizProgressFill, { width: `${progress * 100}%` }]} />
            </View>
          ) : null}
          {!isQuiz ? (
            <View style={[styles.nonQuizProgressTrack, isDarkScreen && styles.nonQuizProgressTrackDark]}>
              <View
                style={[
                  styles.nonQuizProgressFill,
                  isDarkScreen && styles.nonQuizProgressFillDark,
                  { width: `${progress * 100}%` },
                ]}
              />
            </View>
          ) : null}
          {step > 0 && current.key !== 'help-1' ? (
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

        {current.type === 'splash' || current.type === 'auth' ? null : (
          <View style={styles.bottomBar}>
            <Pressable
              onPress={isPaywall ? handlePurchase : handleNext}
              disabled={isNextDisabled}
              style={[
                styles.primaryButton,
                current.type === 'welcome' && styles.primaryButtonWarm,
                isDarkScreen && styles.primaryButtonLight,
                isNextDisabled && styles.primaryButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  current.type === 'welcome' && styles.primaryButtonTextWarm,
                  isDarkScreen && styles.primaryButtonTextDark,
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
  quizProgressTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 8,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#E5ECF6',
    overflow: 'hidden',
  },
  quizProgressFill: {
    height: 3,
    backgroundColor: COLORS.navy,
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
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 84,
    height: 84,
    resizeMode: 'contain',
  },
  welcomeWrap: {
    marginTop: 20,
  },
  illustrationWarm: {
    height: 200,
    borderRadius: 28,
    backgroundColor: COLORS.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  illustrationLight: {
    height: 140,
    borderRadius: 24,
    backgroundColor: COLORS.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  illustrationEmoji: {
    fontSize: 48,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
  },
  welcomeBody: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.ink,
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
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
  },
  nonQuizProgressTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 8,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#E5ECF6',
    overflow: 'hidden',
  },
  nonQuizProgressTrackDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  nonQuizProgressFill: {
    height: 3,
    backgroundColor: COLORS.navy,
  },
  nonQuizProgressFillDark: {
    backgroundColor: '#FFFFFF',
  },
  factWrap: {
    marginTop: 24,
    alignItems: 'center',
    textAlign: 'center',
  },
  factTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 12,
  },
  factBody: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.ink,
    textAlign: 'center',
  },
  factProgress: {
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
  },
  resultsProgress: {
    width: '100%',
    marginTop: 24,
    alignItems: 'center',
  },
  resultsBarTrack: {
    height: 3,
    width: '100%',
    backgroundColor: '#E5ECF6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  resultsBarFill: {
    height: 3,
    backgroundColor: COLORS.navy,
  },
  resultsLabel: {
    fontSize: 12,
    marginTop: 8,
    color: COLORS.muted,
  },
  resultsWrap: {
    marginTop: 12,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
  },
  resultsSubtitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.navy,
    textAlign: 'center',
  },
  resultsBody: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsSection: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy,
  },
  resultsCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5ECF6',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultsBadge: {
    width: 10,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F87171',
  },
  resultsBadgeWarm: {
    backgroundColor: '#FBBF24',
  },
  resultsBadgeCool: {
    backgroundColor: '#34D399',
  },
  resultsCardText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    lineHeight: 20,
  },
  ackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ackIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ackIcon: {
    fontSize: 40,
  },
  ackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  ackBody: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  ratingWrap: {
    marginTop: 10,
    alignItems: 'center',
  },
  ratingStars: {
    fontSize: 18,
    color: '#FACC15',
    marginBottom: 12,
  },
  ratingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  ratingBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  ratingAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1E5FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  ratingAvatarOverlap: {
    marginLeft: -10,
  },
  ratingSocial: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  ratingCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    marginBottom: 12,
  },
  ratingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratingCardStars: {
    fontSize: 12,
    color: '#FACC15',
  },
  ratingCardName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  ratingCardText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  commitmentWrap: {
    marginTop: 10,
  },
  commitmentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  commitmentBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 16,
  },
  commitmentList: {
    gap: 12,
    marginBottom: 20,
  },
  commitmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commitmentCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentCheckText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  commitmentText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  signatureCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    alignItems: 'center',
  },
  signatureLine: {
    width: '80%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    marginBottom: 12,
  },
  signatureLineShort: {
    width: '55%',
    opacity: 0.6,
  },
  signatureHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  motivationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  motivationTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  motivationHint: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  accessWrap: {
    marginTop: 8,
  },
  accessTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  accessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  accessTile: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  accessTileIcon: {
    fontSize: 14,
    color: '#FACC15',
    marginBottom: 8,
  },
  accessTileText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
  },
  accessTestimonial: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 14,
  },
  accessTestimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  accessTestimonialName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  accessTestimonialStars: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#FACC15',
  },
  accessTestimonialBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  transformationWrap: {
    marginTop: 10,
    alignItems: 'center',
  },
  transformationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  transformationTag: {
    marginTop: 16,
    fontSize: 12,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  transformationDate: {
    marginTop: 8,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  transformationFootnote: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  transformationFootnoteText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  paywallWrap: {
    marginTop: 8,
  },
  paywallHeader: {
    marginBottom: 16,
  },
  paywallTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paywallSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  paywallBenefits: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    marginBottom: 16,
  },
  paywallBenefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  paywallBenefitBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },
  paywallError: {
    marginBottom: 10,
    color: '#FCA5A5',
    fontSize: 12,
  },
  paywallPlanList: {
    gap: 12,
    marginBottom: 14,
  },
  paywallPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
  },
  paywallPlanCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  paywallPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paywallPlanRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallPlanRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  paywallPlanCopy: {
    flex: 1,
  },
  paywallPlanTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paywallPlanSub: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  paywallPlanPriceBlock: {
    alignItems: 'flex-end',
  },
  paywallPlanPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paywallPlanNote: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  paywallFootnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paywallFootnoteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  paywallFootnoteText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  skipQuizButton: {
    alignSelf: 'center',
    marginTop: 24,
  },
  skipQuizText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  formWrap: {
    marginTop: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
  },
  textField: {
    borderWidth: 1,
    borderColor: '#E5ECF6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.ink,
  },
  budgetField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5ECF6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  budgetCurrency: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.navy,
    marginRight: 8,
  },
  budgetInput: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
    flex: 1,
  },
  formHint: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  authWrap: {
    marginTop: 12,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 6,
  },
  authBody: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
  },
  authFieldGroup: {
    marginBottom: 12,
  },
  authLabel: {
    fontSize: 12,
    color: COLORS.navy,
    fontWeight: '600',
    marginBottom: 6,
  },
  authInput: {
    borderWidth: 1,
    borderColor: '#E5ECF6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.ink,
  },
  authError: {
    fontSize: 12,
    color: '#B91C1C',
    marginBottom: 10,
  },
  authActions: {
    gap: 10,
    marginTop: 6,
  },
  authSecondaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5ECF6',
    backgroundColor: '#FFFFFF',
  },
  authSecondaryButtonText: {
    color: COLORS.ink,
    fontWeight: '600',
    fontSize: 14,
  },
  authPrimaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.navy,
  },
  authPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  authLinkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  authLinkText: {
    fontSize: 12,
    color: COLORS.navy,
    fontWeight: '600',
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  helpWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  helpBody: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionWrap: {
    marginTop: 12,
  },
  permissionCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5ECF6',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 8,
  },
  permissionBody: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notificationCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5ECF6',
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: {
    fontSize: 14,
    color: COLORS.ink,
  },
  consequenceWrap: {
    marginTop: 18,
    alignItems: 'center',
  },
  consequenceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  consequenceBody: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionWrap: {
    marginTop: 24,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navy,
    marginBottom: 8,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 20,
  },
  optionList: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5ECF6',
    backgroundColor: '#FFFFFF',
  },
  optionRowActive: {
    borderColor: COLORS.navy,
    backgroundColor: '#F1F6FF',
  },
  optionIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIndexActive: {
    backgroundColor: COLORS.navy,
  },
  optionIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  optionIndexTextActive: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 15,
    color: COLORS.ink,
  },
  optionTextActive: {
    color: COLORS.navy,
    fontWeight: '600',
  },
  wheelWrap: {
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5ECF6',
    backgroundColor: '#FFFFFF',
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
    borderWidth: 1,
    borderColor: COLORS.navy,
    backgroundColor: '#F1F6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHighlightText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.navy,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  bottomBarDark: {
    backgroundColor: 'transparent',
  },
  primaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLight: {
    backgroundColor: '#FFFFFF',
  },
  primaryButtonWarm: {
    backgroundColor: COLORS.navy,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextDark: {
    color: COLORS.navy,
  },
  primaryButtonTextWarm: {
    color: '#FFFFFF',
  },
});
