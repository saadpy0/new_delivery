/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Purchases from 'react-native-purchases';
import type { Session } from '@supabase/supabase-js';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { RC_IOS_API_KEY } from '@env';
import AuthScreen from './AuthScreen';
import AccountScreen from './AccountScreen';
import Onboarding from './Onboarding';
import MainDashboard from './MainDashboard';
import { supabase } from './supabaseClient';

const REVENUECAT_IOS_API_KEY_PLACEHOLDER: string = 'REVENUECAT_IOS_PUBLIC_SDK_KEY';
const REVENUECAT_IOS_API_KEY: string = RC_IOS_API_KEY;
const PRO_ENTITLEMENT_ID: string = 'undelivery Pro';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showDashboardOverride, setShowDashboardOverride] = useState(false);
  const [hadSessionOnLaunch, setHadSessionOnLaunch] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [pendingOverride, setPendingOverride] = useState(false);

  useEffect(() => {
    const configurePurchases = async () => {
      if (Platform.OS !== 'ios') return;

      if (!REVENUECAT_IOS_API_KEY || REVENUECAT_IOS_API_KEY === REVENUECAT_IOS_API_KEY_PLACEHOLDER) {
        return;
      }

      try {
        Purchases.configure({
          apiKey: REVENUECAT_IOS_API_KEY,
        });

        await Purchases.getCustomerInfo();
      } catch {
        // Ignore during setup; we'll validate once a real key is configured.
      }
    };

    void configurePurchases();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const existingSession = data.session ?? null;
      setSession(existingSession);
      if (existingSession) {
        setHadSessionOnLaunch(true);
        setOnboardingComplete(true);
      }
      setIsAuthLoading(false);
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const syncRevenueCatUser = async () => {
      if (Platform.OS !== 'ios') return;
      if (!REVENUECAT_IOS_API_KEY || REVENUECAT_IOS_API_KEY === REVENUECAT_IOS_API_KEY_PLACEHOLDER) {
        return;
      }

      if (session?.user?.id) {
        try {
          await Purchases.logIn(session.user.id);
        } catch {
          // Ignore login failures during setup.
        }
      } else {
        try {
          await Purchases.logOut();
        } catch {
          // Ignore logout failures during setup.
        }
      }
    };

    void syncRevenueCatUser();
  }, [session?.user?.id]);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      // Handle quitbite://override deep link from shield extension
      if (url.startsWith('quitbite://override')) {
        setPendingOverride(true);
        return;
      }

      try {
        const queryPart = url.split('?')[1]?.split('#')[0] ?? '';
        const queryParams = new Map(
          queryPart
            .split('&')
            .filter(Boolean)
            .map((pair) => {
              const [k, v = ''] = pair.split('=');
              return [decodeURIComponent(k), decodeURIComponent(v)] as const;
            }),
        );
        const code = queryParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn('Supabase OAuth code exchange error', error.message);
          }
          return;
        }

        const hash = url.includes('#') ? url.split('#')[1] : '';
        if (!hash) return;

        const hashParams = new Map(
          hash
            .split('&')
            .filter(Boolean)
            .map((pair) => {
              const [k, v = ''] = pair.split('=');
              return [decodeURIComponent(k), decodeURIComponent(v)] as const;
            }),
        );
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.warn('Supabase OAuth token session error', error.message);
          }
        }
      } catch (error) {
        console.warn('Failed to handle deep link URL', error);
      }
    };

    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleUrl(initialUrl);
      }
    };

    void handleInitialUrl();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {isAuthLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      ) : (onboardingComplete || showDashboardOverride) && session ? (
        <MainDashboard
          email={session?.user?.email ?? null}
          pendingOverride={pendingOverride}
          onOverrideHandled={() => setPendingOverride(false)}
          onReturnToWelcome={() => {
            setOnboardingComplete(false);
            setShowDashboardOverride(false);
          }}
          onSignOut={() => {
            setOnboardingComplete(false);
            setHadSessionOnLaunch(false);
            setShowDashboardOverride(false);
            supabase.auth.signOut();
          }}
        />
      ) : (
        <Onboarding
          onSkipToDashboard={() => setShowDashboardOverride(true)}
          onOnboardingComplete={() => setOnboardingComplete(true)}
        />
      )}
    </SafeAreaProvider>
  );
}

function AppContent({
  onSignOut,
  email,
  userId,
}: {
  onSignOut: () => void;
  email: string | null;
  userId: string | null;
}) {
  const safeAreaInsets = useSafeAreaInsets();
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const isPurchaseDisabled = isPurchasing || isPro;

  const syncProfileSubscription = async (info: any, purchasedPkg?: any) => {
    if (!userId) return;
    const entitlement = (info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID];

    let productId: string | null = null;
    let subscriptionName: string | null = null;
    let subscriptionPrice: string | null = null;

    if (purchasedPkg?.product) {
      // Use the actual package the user tapped — this is always correct
      productId = purchasedPkg.product.identifier ?? null;
      subscriptionName = purchasedPkg.product.title ?? null;
      subscriptionPrice = purchasedPkg.product.priceString ?? null;
    } else {
      // Restore / initial load — no package available, fall back to entitlement
      productId = entitlement?.productIdentifier ?? null;
      if (productId) {
        try {
          const products = await Purchases.getProducts([productId]);
          const product = products?.[0];
          subscriptionName = product?.title ?? null;
          subscriptionPrice = product?.priceString ?? null;
        } catch {
          const matchedPackage = packages.find((p) => p?.product?.identifier === productId);
          subscriptionName = matchedPackage?.product?.title ?? null;
          subscriptionPrice = matchedPackage?.product?.priceString ?? null;
        }
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
          rc_product_id: productId,
          rc_subscription_name: subscriptionName,
          rc_subscription_price: subscriptionPrice,
          rc_last_event_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
  };

  const loadOfferings = async () => {
    setIsLoadingOfferings(true);
    setOfferingsError(null);

    try {
      const offerings = await Purchases.getOfferings();
      const current = (offerings as any)?.current;
      const availablePackages = (current as any)?.availablePackages ?? [];
      setPackages(availablePackages);

      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      setIsPro(Boolean((info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID]));
      await syncProfileSubscription(info);
    } catch (e: any) {
      setOfferingsError(e?.message ?? String(e));
      setPackages([]);
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  const purchase = async (pkg: any) => {
    if (isPro) {
      return;
    }
    setIsPurchasing(true);
    setOfferingsError(null);

    try {
      const result = await Purchases.purchasePackage(pkg);
      const info = (result as any)?.customerInfo ?? (await Purchases.getCustomerInfo());
      setCustomerInfo(info);
      setIsPro(Boolean((info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID]));
      await syncProfileSubscription(info, pkg);
    } catch (e: any) {
      if (e?.userCancelled) {
        return;
      }
      setOfferingsError(e?.message ?? String(e));
    } finally {
      setIsPurchasing(false);
    }
  };

  const restore = async () => {
    setIsPurchasing(true);
    setOfferingsError(null);

    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      setIsPro(Boolean((info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID]));
      await syncProfileSubscription(info);
    } catch (e: any) {
      setOfferingsError(e?.message ?? String(e));
    } finally {
      setIsPurchasing(false);
    }
  };

  useEffect(() => {
    void loadOfferings();
  }, []);

  if (showAccount) {
    return (
      <AccountScreen email={email} onSignOut={onSignOut} onBack={() => setShowAccount(false)} />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.paywallHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.paywallTitle}>undelivery Pro</Text>
          <Text style={styles.proStatusText}>{isPro ? 'Status: Pro Active' : 'Status: Free'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setShowAccount(true)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Account</Text>
          </Pressable>
          <Pressable onPress={() => void restore()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Restore</Text>
          </Pressable>
          <Pressable onPress={() => void loadOfferings()} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.debugRow}>
        <Text style={styles.debugText}>packages: {packages.length}</Text>
        <Text style={styles.debugText}>loading: {String(isLoadingOfferings)} purchasing: {String(isPurchasing)}</Text>
      </View>

      {isLoadingOfferings ? (
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Loading offerings…</Text>
        </View>
      ) : offeringsError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load offerings</Text>
          <Text style={styles.mutedText}>{offeringsError}</Text>
        </View>
      ) : packages.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.mutedText}>
            No packages found. In RevenueCat, make sure your Offering has packages attached.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.packagesList}>
          {packages.map((pkg: any) => (
            <View key={pkg?.identifier ?? pkg?.product?.identifier} style={styles.packageCard}>
              <Text style={styles.packageTitle}>{pkg?.product?.title ?? pkg?.identifier ?? 'Package'}</Text>
              <Text style={styles.mutedText}>{pkg?.product?.description ?? ''}</Text>
              <Text style={styles.priceText}>{pkg?.product?.priceString ?? ''}</Text>
              <Pressable
                disabled={isPurchaseDisabled}
                onPress={() => void purchase(pkg)}
                style={[styles.ctaButton, isPurchaseDisabled ? styles.ctaButtonDisabled : styles.ctaButtonEnabled]}
              >
                <Text style={styles.ctaButtonText}>
                  {isPurchasing ? 'Processing…' : isPro ? 'Already Pro' : 'Purchase'}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paywallHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexShrink: 1,
    gap: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  proStatusText: {
    color: '#6B7280',
    fontSize: 12,
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  debugRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debugText: {
    color: '#6B7280',
    fontSize: 12,
  },
  centered: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  mutedText: {
    color: '#6B7280',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  packagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  packageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 6,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  ctaButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  ctaButtonEnabled: {
    backgroundColor: '#111827',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default App;
