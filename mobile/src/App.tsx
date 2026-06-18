import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationAction,
} from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { type RootStackParamList } from './navigation/AppNavigator';
import { AuthProvider } from './features/auth/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const getUrlParam = (url: string, key: string) => {
  const match = url.match(new RegExp(`[?&]${key}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const resetRootToHome = () => {
  if (!navigationRef.isReady()) return;

  navigationRef.resetRoot({
    index: 0,
    routes: [{ name: 'Home' }],
  });
};

const handleUnhandledNavigationAction = (action: NavigationAction) => {
  if (action.type === 'GO_BACK') {
    const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
    if (currentRoute && currentRoute !== 'Home') resetRootToHome();
    return;
  }

  console.warn('Unhandled navigation action', action);
};

const App = () => {
  const handleDeepLink = React.useCallback((url: string | null) => {
    if (!url || !url.includes('payment-return')) {
      return;
    }

    const orderId = getUrlParam(url, 'orderId');
    if (!orderId || !navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate('OrderDetail', { orderId });
  }, []);

  React.useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          setTimeout(() => handleDeepLink(url), 0);
        }
      })
      .catch(() => undefined);

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={resetRootToHome}
        onUnhandledAction={handleUnhandledNavigationAction}
      >
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
