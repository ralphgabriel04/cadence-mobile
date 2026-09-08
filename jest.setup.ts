// Jest setup file for Cadence Mobile

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-constants
jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      supabaseUrl: "https://test.supabase.co",
      supabaseAnonKey: "test-anon-key",
    },
  },
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => "/",
  Link: "Link",
  Stack: {
    Screen: "Screen",
  },
  Tabs: {
    Screen: "Screen",
  },
}));

// Screens render inside SafeAreaView; the package ships a jest mock.
jest.mock("react-native-safe-area-context", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous
  require("react-native-safe-area-context/jest/mock").default,
);

// Deterministic colour scheme for palette-driven props (src/theme/tokens.ts).
jest.mock("nativewind", () => ({
  useColorScheme: () => ({
    colorScheme: "dark",
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
  colorScheme: { get: () => "dark", set: jest.fn() },
}));

// expo/src/winter installs lazy getters on globalThis whose first read does a
// `require`. When that first read happens during Jest's teardown the require is
// refused ("import a file outside of the scope of the test code") and the suite
// fails. Reading them here, while requires are still allowed, resolves them.
const expoGlobals = globalThis as Record<string, unknown>;
void expoGlobals.__ExpoImportMetaRegistry;
void expoGlobals.structuredClone;
void expoGlobals.TextDecoder;
void expoGlobals.URL;
