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
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { CustomerNotificationProvider } from './features/notifications/CustomerNotificationProvider';
import { PushNotificationProvider } from './features/notifications/PushNotificationProvider';
import {
  pushNotificationCapability,
  subscribeToPushNotifications,
  type PushNavigationTarget,
} from './features/notifications/pushNotifications';
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

const NavigationRoot = () => {
  const { isRestoringSession } = useAuth();
  const pendingUrlRef = React.useRef<string | null>(null);
  const pendingPushTargetRef = React.useRef<PushNavigationTarget | null>(null);

  const handleDeepLink = React.useCallback((url: string | null) => {
    if (!url) return;

    if (isRestoringSession || !navigationRef.isReady()) {
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
  }, [isRestoringSession]);

  const openPushTarget = React.useCallback((target: PushNavigationTarget) => {
    if (isRestoringSession || !navigationRef.isReady()) {
      pendingPushTargetRef.current = target;
      return;
    }

    if (target.screen === 'SupportTicketDetail') {
      navigationRef.navigate('SupportTicketDetail', target.params);
    } else if (target.screen === 'OrderDetail') {
      navigationRef.navigate('OrderDetail', target.params);
    } else if (target.screen === 'VirtualTryOnResult') {
      navigationRef.navigate('VirtualTryOnResult', target.params);
    } else if (target.screen === 'VirtualTryOnProcessing') {
      navigationRef.navigate('VirtualTryOnProcessing', target.params);
    } else {
      navigationRef.navigate('VirtualTryOnHome');
    }
  }, [isRestoringSession]);

  const flushPendingNavigation = React.useCallback(() => {
    if (isRestoringSession || !navigationRef.isReady()) return;

    const pendingUrl = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (pendingUrl) handleDeepLink(pendingUrl);

    const pendingPushTarget = pendingPushTargetRef.current;
    pendingPushTargetRef.current = null;
    if (pendingPushTarget) openPushTarget(pendingPushTarget);
  }, [handleDeepLink, isRestoringSession, openPushTarget]);

  const handleNavigationReady = React.useCallback(() => {
    resetRootToHome();
    flushPendingNavigation();
  }, [flushPendingNavigation]);

  React.useEffect(() => {
    flushPendingNavigation();
  }, [flushPendingNavigation]);

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
    if (!pushNotificationCapability.remoteEnabled) return;
    let unsubscribe: (() => void) | undefined;
    subscribeToPushNotifications(openPushTarget)
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch(() => undefined);
    return () => unsubscribe?.();
  }, [openPushTarget]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleNavigationReady}
      onUnhandledAction={handleUnhandledNavigationAction}
    >
      <PushNotificationProvider>
        <CustomerNotificationProvider>
          <AppNavigator />
        </CustomerNotificationProvider>
      </PushNotificationProvider>
    </NavigationContainer>
  );
};

const App = () => (
  <SafeAreaProvider>
    <StorefrontSettingsProvider>
      <AuthProvider>
        <NavigationRoot />
      </AuthProvider>
    </StorefrontSettingsProvider>
  </SafeAreaProvider>
);

export default App;
