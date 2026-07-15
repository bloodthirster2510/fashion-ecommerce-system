import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../features/home/HomeScreen';
import ProfileScreen from '../features/account/ProfileScreen';
import EditProfileScreen from '../features/account/EditProfileScreen';
import PaymentMethodsScreen from '../features/account/PaymentMethodsScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';
import MembershipScreen from '../features/account/MembershipScreen';
import ProductListScreen from '../features/catalog/ProductListScreen';
import ProductDetailScreen from '../features/catalog/ProductDetailScreen';
import CartScreen from '../features/cart/CartScreen';
import SearchScreen from '../features/search/SearchScreen';
import CheckoutScreen from '../features/checkout/CheckoutScreen';
import CouponsScreen from '../features/coupons/CouponsScreen';
import FavoritesScreen from '../features/favorites/FavoritesScreen';
import NotificationsScreen from '../features/notifications/NotificationsScreen';
import OrderSuccessScreen from '../features/cart/OrderSuccessScreen';
import OrderListScreen from '../features/orders/OrderListScreen';
import OrderDetailScreen from '../features/orders/OrderDetailScreen';
import type { OrderTabKey } from '../features/orders/orderPresentation';
import SupportHomeScreen from '../features/support/SupportHomeScreen';
import FaqListScreen from '../features/support/FaqListScreen';
import SupportTicketCreateScreen from '../features/support/SupportTicketCreateScreen';
import SupportTicketListScreen from '../features/support/SupportTicketListScreen';
import SupportTicketDetailScreen from '../features/support/SupportTicketDetailScreen';
import ReviewComposerScreen from '../features/reviews/ReviewComposerScreen';
import MyReviewsScreen from '../features/reviews/MyReviewsScreen';
import VirtualTryOnHomeScreen from '../features/virtualTryOn/VirtualTryOnHomeScreen';
import VirtualTryOnBuilderScreen from '../features/virtualTryOn/VirtualTryOnBuilderScreen';
import VirtualTryOnProcessingScreen from '../features/virtualTryOn/VirtualTryOnProcessingScreen';
import VirtualTryOnResultScreen from '../features/virtualTryOn/VirtualTryOnResultScreen';
import VirtualTryOnHistoryScreen from '../features/virtualTryOn/VirtualTryOnHistoryScreen';
import type { TryOnSeedItem } from '../features/virtualTryOn/virtualTryOn.types';
import type { SupportCategory, SupportTicketType } from '../features/support/support.types';

export type RootStackParamList = {
  Home: undefined;
  ProductList: {
    title?: string;
    keyword?: string;
    gender?: 'male' | 'female' | 'unisex';
    categoryId?: string | string[];
    brandId?: string | string[];
    color?: string[];
    fitTypeId?: string[];
    size?: string[];
    minPrice?: number;
    maxPrice?: number;
    isSale?: boolean;
    isNew?: boolean;
    sort?: 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'newest' | 'best_seller' | 'rating_desc';
    discoveryEntry?: 'products';
  } | undefined;
  Search: undefined;
  ProductDetail: {
    productId: string;
    recommendationRequestId?: string;
  };
  Cart: {
    couponCode?: string;
    selectionSource?: 'normal' | 'virtualTryOn';
  } | undefined;
  Checkout: {
    couponCode?: string;
    cartItemIds?: string[];
  } | undefined;
  Coupons: {
    cartItemIds?: string[];
    selectedCouponCode?: string | null;
    paymentMethod?: 'COD' | 'VNPAY' | 'MOMO';
  } | undefined;
  Favorites: undefined;
  Notifications: undefined;
  Profile: undefined;
  EditProfile: undefined;
  PaymentMethods: undefined;
  Membership: undefined;
  Orders: {
    status?: OrderTabKey;
  } | undefined;
  OrderDetail: {
    orderId: string;
  };
  ReviewComposer: {
    orderId: string;
    orderItemId: string;
    orderCode: string;
    productName: string;
    productImage: string;
    variantLabel: string;
    editReviewId?: string;
    editRating?: number;
    editComment?: string;
    editCriteria?: {
      productQuality?: number;
      descriptionMatch?: number;
      sizeFit?: 'small' | 'true_to_size' | 'large';
    } | null;
    editImages?: Array<{ _id: string | null; url: string; thumbnailUrl: string }>;
  };
  MyReviews: undefined;
  VirtualTryOnHome: {
    seedItems?: TryOnSeedItem[];
    alternativeSeedItems?: TryOnSeedItem[];
    entryPoint?: 'cart' | 'builder';
  } | undefined;
  VirtualTryOnBuilder: {
    assetId?: string;
    imageUrl?: string;
    seedItems?: TryOnSeedItem[];
    alternativeSeedItems?: TryOnSeedItem[];
    entryPoint?: 'cart' | 'builder';
  } | undefined;
  VirtualTryOnProcessing: {
    jobId: string;
    seedItems?: TryOnSeedItem[];
    alternativeSeedItems?: TryOnSeedItem[];
  };
  VirtualTryOnResult: {
    jobId: string;
    seedItems?: TryOnSeedItem[];
    alternativeSeedItems?: TryOnSeedItem[];
  };
  VirtualTryOnHistory: undefined;
  SupportHome: undefined;
  FaqList: { category?: string } | undefined;
  SupportTicketCreate: {
    type?: SupportTicketType;
    category?: SupportCategory;
    orderId?: string;
    couponCode?: string;
    contextSource?: 'support_home' | 'order_detail' | 'payment_result' | 'coupon' | 'loyalty' | 'error_screen' | 'footer';
    errorCode?: string;
  } | undefined;
  SupportTicketList: undefined;
  SupportTicketDetail: { ticketId: string };
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  OrderSuccess: {
    orderId: string;
    orderCode: string;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: 'pending' | 'awaiting' | 'paid' | 'failed';
    isProcessingPayment?: boolean;
    paymentMessage?: string;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false, freezeOnBlur: true }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ProductList" component={ProductListScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Coupons" component={CouponsScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
      <Stack.Screen name="Orders" component={OrderListScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="ReviewComposer" component={ReviewComposerScreen} />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
      <Stack.Screen name="VirtualTryOnHome" component={VirtualTryOnHomeScreen} />
      <Stack.Screen name="VirtualTryOnBuilder" component={VirtualTryOnBuilderScreen} />
      <Stack.Screen name="VirtualTryOnProcessing" component={VirtualTryOnProcessingScreen} />
      <Stack.Screen name="VirtualTryOnResult" component={VirtualTryOnResultScreen} />
      <Stack.Screen name="VirtualTryOnHistory" component={VirtualTryOnHistoryScreen} />
      <Stack.Screen name="SupportHome" component={SupportHomeScreen} />
      <Stack.Screen name="FaqList" component={FaqListScreen} />
      <Stack.Screen name="SupportTicketCreate" component={SupportTicketCreateScreen} />
      <Stack.Screen name="SupportTicketList" component={SupportTicketListScreen} />
      <Stack.Screen name="SupportTicketDetail" component={SupportTicketDetailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
