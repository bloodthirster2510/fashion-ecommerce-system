type SecureStoreModule = typeof import('expo-secure-store');

const fallbackStore = new Map<string, string>();
let secureStorePromise: Promise<SecureStoreModule | null> | null = null;
const canUseInMemoryFallback = () => typeof __DEV__ !== 'undefined' && __DEV__;

const loadSecureStore = async () => {
  if (!secureStorePromise) {
    secureStorePromise = import('expo-secure-store')
      .then((module) => module)
      .catch((error) => {
        if (canUseInMemoryFallback()) {
          console.warn('SecureStore is unavailable. Falling back to in-memory auth storage.', error);
          return null;
        }

        throw new Error('SecureStore is unavailable. Cannot store auth session securely.');
      });
  }

  return secureStorePromise;
};

export const sessionStorage = {
  async getItemAsync(key: string) {
    const secureStore = await loadSecureStore();
    if (!secureStore) return fallbackStore.get(key) ?? null;

    return secureStore.getItemAsync(key);
  },

  async setItemAsync(key: string, value: string) {
    const secureStore = await loadSecureStore();
    if (!secureStore) {
      fallbackStore.set(key, value);
      return;
    }

    await secureStore.setItemAsync(key, value);
  },

  async deleteItemAsync(key: string) {
    const secureStore = await loadSecureStore();
    fallbackStore.delete(key);

    if (!secureStore) return;
    await secureStore.deleteItemAsync(key);
  },
};
