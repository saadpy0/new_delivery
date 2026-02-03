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
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { RC_IOS_API_KEY } from '@env';

const REVENUECAT_IOS_API_KEY_PLACEHOLDER: string = 'REVENUECAT_IOS_PUBLIC_SDK_KEY';
const REVENUECAT_IOS_API_KEY: string = RC_IOS_API_KEY;
const PRO_ENTITLEMENT_ID: string = 'undelivery Pro';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [isPro, setIsPro] = useState(false);

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
    } catch (e: any) {
      setOfferingsError(e?.message ?? String(e));
      setPackages([]);
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  const purchase = async (pkg: any) => {
    setIsPurchasing(true);
    setOfferingsError(null);

    try {
      const result = await Purchases.purchasePackage(pkg);
      const info = (result as any)?.customerInfo ?? (await Purchases.getCustomerInfo());
      setCustomerInfo(info);
      setIsPro(Boolean((info as any)?.entitlements?.active?.[PRO_ENTITLEMENT_ID]));
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
    } catch (e: any) {
      setOfferingsError(e?.message ?? String(e));
    } finally {
      setIsPurchasing(false);
    }
  };

  useEffect(() => {
    void loadOfferings();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.paywallHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.paywallTitle}>undelivery Pro</Text>
          <Text style={styles.proStatusText}>{isPro ? 'Status: Pro Active' : 'Status: Free'}</Text>
        </View>
        <View style={styles.headerRight}>
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
                disabled={isPurchasing}
                onPress={() => void purchase(pkg)}
                style={[styles.ctaButton, isPurchasing ? styles.ctaButtonDisabled : styles.ctaButtonEnabled]}
              >
                <Text style={styles.ctaButtonText}>{isPurchasing ? 'Processing…' : 'Purchase'}</Text>
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
