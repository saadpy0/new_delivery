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
import { supabase } from './supabaseClient';

const REVENUECAT_IOS_API_KEY_PLACEHOLDER: string = 'REVENUECAT_IOS_PUBLIC_SDK_KEY';
const REVENUECAT_IOS_API_KEY: string = RC_IOS_API_KEY;
const PRO_ENTITLEMENT_ID: string = 'undelivery Pro';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
      setSession(data.session ?? null);
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
      console.warn('OAuth callback url', url);
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) {
        console.warn('Supabase OAuth error', error.message);
      } else {
        console.warn('Supabase OAuth session', data?.session?.user?.email ?? 'no session');
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
      <Onboarding />
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

  const syncProfileSubscription = async (info: any) => {
    if (!userId) return;
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
      .from('profiles')
      .update({
        rc_customer_id: (info as any)?.originalAppUserId ?? null,
        rc_app_user_id: (info as any)?.appUserId ?? null,
        rc_entitlement_active: Boolean(entitlement),
        rc_entitlement_id: entitlement ? PRO_ENTITLEMENT_ID : null,
        rc_subscription_name: subscriptionName,
        rc_subscription_price: subscriptionPrice,
        rc_last_event_at: new Date().toISOString(),
      })
      .eq('id', userId);
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
      await syncProfileSubscription(info);
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
