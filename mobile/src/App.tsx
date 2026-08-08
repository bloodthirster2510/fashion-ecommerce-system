import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigationAction,
} from '@react-navigation/native';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { type RootStackParamList } from './navigation/AppNavigator';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import {
  CustomerNotificationProvider,
  useCustomerNotifications,
} from './features/notifications/CustomerNotificationProvider';
import { PushNotificationProvider } from './features/notifications/PushNotificationProvider';
import { notificationApi } from './features/notifications/notificationApi';
import {
  pushNotificationCapability,
  subscribeToPushNotifications,
  type PushNavigationTarget,
} from './features/notifications/pushNotifications';
import { StorefrontSettingsProvider } from './features/storefrontSettings/StorefrontSettingsProvider';
import { getUrlParam, parsePasswordResetLink } from './features/auth/passwordResetLink';
import { hydrateScreenDataCache } from './config/screenDataCache';
import { colors } from './theme';

const shopNameImage = require('../assets/ShopName.png');

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const CacheBootstrap = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) setReady(true);
    }, 1_500);
    hydrateScreenDataCache().finally(() => {
      clearTimeout(timeout);
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.cacheBootstrap}>
        <Image
          accessibilityLabel="CDSHOP"
          resizeMode="contain"
          source={shopNameImage}
          style={styles.loadingLogo}
        />
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.loadingText}>Đang chuẩn bị cửa hàng...</Text>
      </View>
    );
  }

  return children;
};

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

type PendingPushOpen = {
  target: PushNavigationTarget;
  notificationId?: string;
};

const NavigationContent = () => {
  const { isRestoringSession, runWithAuth } = useAuth();
  const { refresh: refreshNotificationSummary } = useCustomerNotifications();
  const pendingUrlRef = React.useRef<string | null>(null);
  const pendingPushOpenRef = React.useRef<PendingPushOpen | null>(null);

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

  const openPushTarget = React.useCallback((target: PushNavigationTarget, notificationId?: string) => {
    if (isRestoringSession || !navigationRef.isReady()) {
      pendingPushOpenRef.current = { target, notificationId };
      return;
    }

    if (notificationId) {
      void runWithAuth((token) => notificationApi.markRead(token, notificationId))
        .then(() => refreshNotificationSummary())
        .catch(() => undefined);
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
  }, [isRestoringSession, refreshNotificationSummary, runWithAuth]);

  const flushPendingNavigation = React.useCallback(() => {
    if (isRestoringSession || !navigationRef.isReady()) return;

    const pendingUrl = pendingUrlRef.current;
    pendingUrlRef.current = null;
    if (pendingUrl) handleDeepLink(pendingUrl);

    const pendingPushOpen = pendingPushOpenRef.current;
    pendingPushOpenRef.current = null;
    if (pendingPushOpen) {
      openPushTarget(pendingPushOpen.target, pendingPushOpen.notificationId);
    }
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
      <AppNavigator />
    </NavigationContainer>
  );
};

const NavigationRoot = () => (
  <PushNotificationProvider>
    <CustomerNotificationProvider>
      <NavigationContent />
    </CustomerNotificationProvider>
  </PushNotificationProvider>
);

const App = () => (
  <SafeAreaProvider>
    <CacheBootstrap>
      <StorefrontSettingsProvider>
        <AuthProvider>
          <NavigationRoot />
        </AuthProvider>
      </StorefrontSettingsProvider>
    </CacheBootstrap>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  cacheBootstrap: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingLogo: {
    height: 210,
    marginBottom: 8,
    width: '88%',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 10,
  },
});

export default App;
