import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../features/home/HomeScreen';
import ProfileScreen from '../features/account/ProfileScreen';
import EditProfileScreen from '../features/account/EditProfileScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';
import MembershipScreen from '../features/account/MembershipScreen';
import ProductListScreen from '../features/catalog/ProductListScreen';
import ProductDetailScreen from '../features/catalog/ProductDetailScreen';
import CartScreen from '../features/cart/CartScreen';
import CouponsScreen from '../features/coupons/CouponsScreen';
import FavoritesScreen from '../features/favorites/FavoritesScreen';

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
  } | undefined;
  ProductDetail: {
    productId: string;
  };
  Cart: {
    couponCode?: string;
  } | undefined;
  Coupons: {
    cartItemIds?: string[];
    selectedCouponCode?: string | null;
  } | undefined;
  Favorites: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Membership: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ProductList" component={ProductListScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Coupons" component={CouponsScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
