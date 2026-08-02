import { invalidateCache } from './apiCache';
import { invalidateScreenData } from './screenDataCache';

const USER_SCREEN_CACHE_PREFIXES = [
  'home:recommendations:',
  'catalog:list:',
  'cart:',
  'favorites:',
  'orders:',
  'notifications:',
];

export const invalidateCartCaches = () => {
  invalidateScreenData('cart:');
};

export const invalidateFavoriteCaches = () => {
  invalidateScreenData('favorites:');
};

export const invalidateNotificationCaches = () => {
  invalidateScreenData('notifications:');
};

export const invalidateOrderCaches = () => {
  invalidateScreenData('orders:');
  invalidateCache('orderSummary:');
};

export const invalidateCatalogCaches = (productId?: string) => {
  invalidateCache(productId ? `product:${productId}` : 'product:');
  invalidateScreenData(productId ? `catalog:detail:${productId}` : 'catalog:detail:');
  invalidateScreenData('catalog:list:');
  invalidateScreenData('home:best-sellers');
};

export const clearUserScopedCaches = () => {
  USER_SCREEN_CACHE_PREFIXES.forEach((prefix) => invalidateScreenData(prefix));
  invalidateCache('orderSummary:');
};

export const invalidateAfterMutation = async <T>(
  operation: Promise<T>,
  invalidate: () => void,
) => {
  const result = await operation;
  invalidate();
  return result;
};
