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
import { subscribeToSupportNotifications } from './features/support/supportNotifications';
import { CustomerNotificationProvider } from './features/notifications/CustomerNotificationProvider';
import { StorefrontSettingsProvider } from './features/storefrontSettings/StorefrontSettingsProvider';
import { getUrlParam, parsePasswordResetLink } from './features/auth/passwordResetLink';

WebBrowser.maybeCompleteAuthSession();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const resetRootToHome = () => {
  if (!navigationRef.isReady()) return;
  if (!navigationRef.getRootState().routeNames.includes('Home')) return;

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
  const pendingUrlRef = React.useRef<string | null>(null);

  const handleDeepLink = React.useCallback((url: string | null) => {
    if (!url) return;

    if (!navigationRef.isReady()) {
      pendingUrlRef.current = url;
      return;
    }

    if (url.includes('reset-password')) {
      const resetPayload = parsePasswordResetLink(url);
      if (resetPayload) {
        navigationRef.navigate('ForgotPassword', resetPayload);
      }
      return;
    }

    if (url.includes('payment-return')) {
      const orderId = getUrlParam(url, 'orderId');
      if (orderId) navigationRef.navigate('OrderDetail', { orderId });
    }
  }, []);

  const handleNavigationReady = React.useCallback(() => {
    resetRootToHome();
    const pendingUrl = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (pendingUrl) handleDeepLink(pendingUrl);
  }, [handleDeepLink]);

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

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    subscribeToSupportNotifications((ticketId) => {
      if (navigationRef.isReady()) navigationRef.navigate('SupportTicketDetail', { ticketId });
    }, (orderId) => {
      if (navigationRef.isReady()) navigationRef.navigate('OrderDetail', { orderId });
    }, ({ jobId, destination }) => {
      if (!navigationRef.isReady()) return;
      if (destination === 'result' && jobId) {
        navigationRef.navigate('VirtualTryOnResult', { jobId });
      } else if (destination === 'processing' && jobId) {
        navigationRef.navigate('VirtualTryOnProcessing', { jobId });
      } else {
        navigationRef.navigate('VirtualTryOnHome');
      }
    }).then((cleanup) => { unsubscribe = cleanup; }).catch(() => undefined);
    return () => unsubscribe?.();
  }, []);

  return (
    <SafeAreaProvider>
      <StorefrontSettingsProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={handleNavigationReady}
          onUnhandledAction={handleUnhandledNavigationAction}
        >
          <AuthProvider>
            <CustomerNotificationProvider>
              <AppNavigator />
            </CustomerNotificationProvider>
          </AuthProvider>
        </NavigationContainer>
      </StorefrontSettingsProvider>
    </SafeAreaProvider>
  );
};

export default App;
