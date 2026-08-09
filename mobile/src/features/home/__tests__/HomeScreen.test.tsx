import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { catalogApi, type CatalogProduct } from '../../catalog/catalogApi';
import { useAuth } from '../../auth/AuthContext';
import { recommendationApi } from '../../recommendation/recommendationApi';
import { useCustomerNotifications } from '../../notifications/CustomerNotificationProvider';
import HomeScreen from '../HomeScreen';
import { invalidateScreenData } from '../../../config/screenDataCache';

const mockFocusCallbacks = new Set<() => void | (() => void)>();
const mockCategoryDrawer = jest.fn((_props: Record<string, unknown>) => null);
const mockStorefrontHeader = jest.fn((_props: Record<string, unknown>) => null);
const mockProductSection = jest.fn((_props: Record<string, unknown>) => null);
const mockRecommendationRail = jest.fn((_props: Record<string, unknown>) => null);

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react') as typeof React;
  return {
    useNavigation: jest.fn(),
    useFocusEffect: (callback: () => void | (() => void)) => {
      mockFocusCallbacks.add(callback);
      ReactModule.useEffect(callback, [callback]);
    },
  };
});
jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../catalog/catalogApi', () => ({
  catalogApi: {
    getCategories: jest.fn(),
    getBestSellers: jest.fn(),
  },
}));
jest.mock('../../recommendation/recommendationApi', () => ({
  recommendationApi: {
    getPersonalRecommendations: jest.fn(),
    recordEvent: jest.fn(),
  },
}));
jest.mock('../../recommendation/interactionApi', () => ({
  interactionApi: { recordInteraction: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../recommendation/useRecommendationImpressions', () => ({
  useRecommendationImpressions: () => ({
    recommendationSectionRef: { current: null },
    checkRecommendationVisibility: jest.fn(),
    handleRecommendationViewableItemsChanged: jest.fn(),
  }),
}));
jest.mock('../../notifications/CustomerNotificationProvider', () => ({
  useCustomerNotifications: jest.fn(),
}));
jest.mock('../../search/searchHistory', () => ({
  addSearchHistory: jest.fn(),
  createSearchEventId: jest.fn().mockReturnValue('search-event'),
}));
jest.mock('../../../components/layout/StorefrontFooter', () => () => null);
jest.mock('../../../components/layout/StorefrontHeader', () => (props: Record<string, unknown>) => mockStorefrontHeader(props));
jest.mock('../../../components/navigation/StorefrontBottomNav', () => () => null);
jest.mock('../components/CategoryDrawer', () => (props: Record<string, unknown>) => mockCategoryDrawer(props));
jest.mock('../components/CategoryRail', () => () => null);
jest.mock('../components/FeatureCard', () => () => null);
jest.mock('../components/ProductSection', () => (props: Record<string, unknown>) => mockProductSection(props));
jest.mock('../../recommendation/RecommendationRail', () => (props: Record<string, unknown>) => mockRecommendationRail(props));
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react') as typeof React;
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

const renderer = jest.requireActual('react-test-renderer') as {
  act: (action: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => { unmount: () => void };
};

const mockedUseNavigation = useNavigation as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedCatalogApi = catalogApi as jest.Mocked<typeof catalogApi>;
const mockedRecommendationApi = recommendationApi as jest.Mocked<typeof recommendationApi>;
const mockedNotifications = useCustomerNotifications as jest.Mock;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

describe('HomeScreen catalog lifecycle', () => {
  let tree: ReturnType<typeof renderer.create> | null = null;
  let now = 100_000;

  beforeEach(() => {
    invalidateScreenData();
    jest.clearAllMocks();
    mockFocusCallbacks.clear();
    now = 100_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockedUseNavigation.mockReturnValue({ navigate: jest.fn() });
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      runWithAuth: jest.fn(),
    });
    mockedNotifications.mockReturnValue({
      summary: null,
      refresh: jest.fn().mockResolvedValue(undefined),
    });
    mockedCatalogApi.getCategories.mockResolvedValue([]);
    mockedCatalogApi.getBestSellers.mockResolvedValue({ items: [], pagination: { page: 1, limit: 8, totalItems: 0, totalPages: 0 } } as never);
    mockedRecommendationApi.getPersonalRecommendations.mockResolvedValue({
      items: [],
      requestId: 'request-1',
      algorithmVersion: 'v1',
      fallbackUsed: false,
    });
  });

  afterEach(async () => {
    if (tree) {
      await renderer.act(async () => tree?.unmount());
      tree = null;
    }
    jest.restoreAllMocks();
  });

  it('refreshes categories and home products when the screen becomes stale and regains focus', async () => {
    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedCatalogApi.getCategories).toHaveBeenCalledTimes(1);
    expect(mockedCatalogApi.getBestSellers).toHaveBeenCalledTimes(1);
    expect(mockedRecommendationApi.getPersonalRecommendations).toHaveBeenCalledTimes(1);

    now += 61_000;
    const focusCallbacks = Array.from(mockFocusCallbacks);
    await renderer.act(async () => {
      focusCallbacks.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedCatalogApi.getCategories).toHaveBeenCalledTimes(2);
    expect(mockedCatalogApi.getCategories).toHaveBeenLastCalledWith(
      {},
      expect.any(AbortSignal),
      { forceRefresh: true },
    );
    expect(mockedCatalogApi.getBestSellers).toHaveBeenCalledTimes(2);
    expect(mockedRecommendationApi.getPersonalRecommendations).toHaveBeenCalledTimes(2);
  });

  it('normalizes searches and opens all products for an empty submission', async () => {
    const navigate = jest.fn();
    mockedUseNavigation.mockReturnValue({ navigate });

    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const headerProps = mockStorefrontHeader.mock.calls.at(-1)?.[0] as {
      onSearchSubmit: (keyword: string) => void;
    };

    headerProps.onSearchSubmit('  áo   sơ mi  ');
    expect(navigate).toHaveBeenLastCalledWith('ProductList', {
      title: 'Tìm kiếm: áo sơ mi',
      keyword: 'áo sơ mi',
      searchEventId: 'search-event',
      searchSource: 'mobile_manual',
    });

    navigate.mockClear();
    headerProps.onSearchSubmit('   ');
    expect(navigate).toHaveBeenCalledWith('ProductList', {
      title: 'Tất cả sản phẩm',
      sort: 'newest',
    });
  });

  it('keeps the last good Home content when a stale refresh is offline', async () => {
    const category = { _id: 'category-a', name: 'Áo', gender: 'unisex', level: 2 };
    const product = { _id: 'product-a', name: 'Áo bán chạy' };
    const recommendation = {
      product: { _id: 'product-b', name: 'Áo gợi ý' },
      score: 1,
      rank: 1,
      reason: 'popular',
      reasonCodes: ['popular'],
    };
    mockedCatalogApi.getCategories
      .mockResolvedValueOnce([category] as never)
      .mockRejectedValueOnce(new Error('offline'));
    mockedCatalogApi.getBestSellers
      .mockResolvedValueOnce({
        items: [product],
        pagination: { page: 1, limit: 8, totalItems: 1, totalPages: 1 },
      } as never)
      .mockRejectedValueOnce(new Error('offline'));
    mockedRecommendationApi.getPersonalRecommendations
      .mockResolvedValueOnce({
        items: [recommendation],
        requestId: 'request-1',
        algorithmVersion: 'v1',
        fallbackUsed: false,
      } as never)
      .mockRejectedValueOnce(new Error('offline'));

    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    now += 61_000;
    const focusCallbacks = Array.from(mockFocusCallbacks);
    await renderer.act(async () => {
      focusCallbacks.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    });

    const categoryProps = mockCategoryDrawer.mock.calls.at(-1)?.[0] as { categories: unknown[] };
    const productProps = mockProductSection.mock.calls.at(-1)?.[0] as { products: unknown[] };
    const recommendationProps = mockRecommendationRail.mock.calls.at(-1)?.[0] as { items: unknown[] };
    expect(categoryProps.categories).toEqual([category]);
    expect(productProps.products).toEqual([product]);
    expect(recommendationProps.items).toEqual([recommendation]);
  });

  it('keeps Home content out of the blocking loading state during a stale refresh', async () => {
    const product = { _id: 'product-a', name: 'Áo bán chạy' } as CatalogProduct;
    mockedCatalogApi.getBestSellers.mockResolvedValueOnce({
      items: [product],
      pagination: { page: 1, limit: 8, totalItems: 1, totalPages: 1 },
    } as never);

    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const refresh = deferred<Awaited<ReturnType<typeof catalogApi.getBestSellers>>>();
    mockedCatalogApi.getBestSellers.mockReturnValueOnce(refresh.promise);
    now += 61_000;
    await renderer.act(async () => {
      Array.from(mockFocusCallbacks).forEach((callback) => callback());
      await Promise.resolve();
    });

    const productProps = mockProductSection.mock.calls.at(-1)?.[0] as {
      products: unknown[];
      isLoading: boolean;
    };
    expect(productProps.products).toEqual([product]);
    expect(productProps.isLoading).toBe(false);

    await renderer.act(async () => {
      refresh.resolve({
        items: [product],
        pagination: { page: 1, limit: 8, totalItems: 1, totalPages: 1 },
        filters: { brands: [], colors: [], fitTypes: [], sizes: [], categories: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('hydrates a remounted Home screen from cache before background requests finish', async () => {
    const product = { _id: 'product-cache', name: 'Áo lấy từ cache' } as CatalogProduct;
    const recommendation = {
      product,
      score: 1,
      rank: 1,
      reason: 'Phù hợp',
      reasonCodes: ['popular'],
    };
    mockedCatalogApi.getBestSellers.mockResolvedValueOnce({
      items: [product],
      pagination: { page: 1, limit: 8, totalItems: 1, totalPages: 1 },
    } as never);
    mockedRecommendationApi.getPersonalRecommendations.mockResolvedValueOnce({
      items: [recommendation],
      requestId: 'cached-request',
      algorithmVersion: 'v1',
      fallbackUsed: false,
    } as never);

    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await renderer.act(async () => tree?.unmount());
    tree = null;
    mockFocusCallbacks.clear();

    const bestSellerRefresh = deferred<Awaited<ReturnType<typeof catalogApi.getBestSellers>>>();
    const recommendationRefresh = deferred<Awaited<ReturnType<typeof recommendationApi.getPersonalRecommendations>>>();
    mockedCatalogApi.getBestSellers.mockReturnValueOnce(bestSellerRefresh.promise);
    mockedRecommendationApi.getPersonalRecommendations.mockReturnValueOnce(recommendationRefresh.promise);

    await renderer.act(async () => {
      tree = renderer.create(<HomeScreen />);
      await Promise.resolve();
    });

    const productProps = mockProductSection.mock.calls.at(-1)?.[0] as {
      products: unknown[];
      isLoading: boolean;
    };
    expect(productProps.products).toEqual([product]);
    expect(productProps.isLoading).toBe(false);

    await renderer.act(async () => {
      bestSellerRefresh.resolve({
        items: [product],
        pagination: { page: 1, limit: 8, totalItems: 1, totalPages: 1 },
        filters: { brands: [], colors: [], fitTypes: [], sizes: [], categories: [] },
      });
      recommendationRefresh.resolve({
        items: [recommendation],
        requestId: 'refreshed-request',
        algorithmVersion: 'v1',
        fallbackUsed: false,
      } as never);
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
