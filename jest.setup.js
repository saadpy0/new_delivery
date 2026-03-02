jest.mock('@env', () => ({
  RC_IOS_API_KEY: '',
  OPENAI_API_KEY: '',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}), { virtual: true });

jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('react-native-purchases', () => ({
  configure: jest.fn(),
  getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  getProducts: jest.fn().mockResolvedValue([]),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  logIn: jest.fn().mockResolvedValue({}),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  __esModule: true,
  default: {
    performRequest: jest.fn(),
    Operation: { LOGIN: 'LOGIN' },
    Scope: { EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME' },
    Error: { CANCELED: 'CANCELED' },
  },
}));

jest.spyOn(console, 'warn').mockImplementation(() => {});
