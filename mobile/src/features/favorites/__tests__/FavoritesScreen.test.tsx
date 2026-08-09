import React from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import FavoritesScreen from '../FavoritesScreen';
import { favoritesApi, type FavoriteListResponse, type FavoriteProduct } from '../favoritesApi';
import { invalidateScreenData } from '../../../config/screenDataCache';

const mockFocusCallbacks = new Set<() => void | (() => void)>();

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
jest.mock('../favoritesApi', () => ({
  favoritesApi: {
    getFavorites: jest.fn(),
    removeFavorite: jest.fn(),
  },
}));
jest.mock('../../../components/media/RemoteImage', () => {
  const ReactModule = require('react') as typeof React;
  return { RemoteImage: (props: Record<string, unknown>) => ReactModule.createElement('RemoteImage', props) };
});
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react') as typeof React;
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});
jest.mock('@expo/vector-icons', () => {
  const ReactModule = require('react') as typeof React;
  return {
    MaterialCommunityIcons: (props: Record<string, unknown>) => ReactModule.createElement('Icon', props),
  };
});

type TestNode = {
  type: unknown;
  props: Record<string, any>;
  parent: TestNode | null;
};

const renderer = jest.requireActual('react-test-renderer') as {
  act: (action: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: {
      findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
      findAllByType: (type: unknown) => TestNode[];
    };
    unmount: () => void;
  };
};

const mockedUseNavigation = useNavigation as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedFavoritesApi = favoritesApi as jest.Mocked<typeof favoritesApi>;

const favorite = (id: string, name: string): FavoriteProduct => ({
  _id: id,
  name,
  image: '',
  price: 200000,
  originalPrice: 200000,
  discount: 0,
  finalPrice: 200000,
  isSale: false,
  isNew: false,
  isAvailable: true,
  soldQuantity: 0,
  averageRating: 4,
  reviewCount: 1,
  brand: null,
  category: null,
  favoritedAt: '2026-08-01T00:00:00.000Z',
  isFavorited: true,
} as FavoriteProduct);

const response = (
  items: FavoriteProduct[],
  pagination: Partial<FavoriteListResponse['pagination']> = {},
): FavoriteListResponse => ({
  items,
  pagination: {
    page: 1,
    limit: 10,
    totalItems: items.length,
    totalPages: items.length ? 1 : 0,
    ...pagination,
  },
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

describe('FavoritesScreen lifecycle', () => {
  let tree: ReturnType<typeof renderer.create> | null = null;
  let now = 100_000;

  beforeEach(() => {
    invalidateScreenData();
    jest.clearAllMocks();
    mockFocusCallbacks.clear();
    now = 100_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockedFavoritesApi.getFavorites.mockReset();
    mockedFavoritesApi.removeFavorite.mockReset();
    mockedUseNavigation.mockReturnValue({
      canGoBack: jest.fn().mockReturnValue(false),
      goBack: jest.fn(),
      navigate: jest.fn(),
    });
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      session: { accessToken: 'access-token' },
      runWithAuth: (action: (token: string) => Promise<unknown>) => action('access-token'),
    });
    mockedFavoritesApi.getFavorites.mockResolvedValue(response([]));
    mockedFavoritesApi.removeFavorite.mockResolvedValue({ productId: 'product-a', isFavorited: false });
  });

  afterEach(async () => {
    if (tree) {
      await renderer.act(async () => tree?.unmount());
      tree = null;
    }
    jest.restoreAllMocks();
  });

  const renderScreen = async () => {
    await renderer.act(async () => {
      tree = renderer.create(<FavoritesScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const pressText = async (label: string) => {
    const textNode = tree?.root.findAllByType(Text).find((node) => node.props.children === label);
    expect(textNode).toBeDefined();
    let pressable = textNode?.parent ?? null;
    while (pressable && typeof pressable.props.onPress !== 'function') pressable = pressable.parent;
    expect(pressable).toBeDefined();
    await renderer.act(async () => pressable?.props.onPress());
  };

  const favoriteButton = (name: string) => {
    const button = tree?.root.findAll((node) => node.props.accessibilityLabel === `Bỏ yêu thích ${name}`)[0];
    expect(button).toBeDefined();
    return button!;
  };

  it('loads a newly selected page immediately', async () => {
    mockedFavoritesApi.getFavorites
      .mockResolvedValueOnce(response([favorite('product-a', 'Áo A')], { totalItems: 11, totalPages: 2 }))
      .mockResolvedValueOnce(response([favorite('product-b', 'Áo B')], { page: 2, totalItems: 11, totalPages: 2 }));
    await renderScreen();

    await pressText('Sau');
    await renderer.act(async () => { await Promise.resolve(); });

    expect(mockedFavoritesApi.getFavorites).toHaveBeenLastCalledWith('access-token', expect.objectContaining({ page: 2 }));
    expect(tree?.root.findAllByType(Text).map((node) => node.props.children)).toContain('Áo B');
  });

  it('ignores an older load after a newer refresh completes', async () => {
    const oldLoad = deferred<FavoriteListResponse>();
    mockedFavoritesApi.getFavorites
      .mockReturnValueOnce(oldLoad.promise)
      .mockResolvedValueOnce(response([favorite('product-new', 'Mới nhất')]));
    await renderScreen();

    now += 31_000;
    const focusCallbacks = Array.from(mockFocusCallbacks);
    await renderer.act(async () => {
      focusCallbacks.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    });
    await renderer.act(async () => {
      oldLoad.resolve(response([favorite('product-old', 'Dữ liệu cũ')]));
      await Promise.resolve();
    });

    const labels = tree?.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels).toContain('Mới nhất');
    expect(labels).not.toContain('Dữ liệu cũ');
  });

  it('keeps the last good list when a background refresh is offline', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedFavoritesApi.getFavorites
      .mockResolvedValueOnce(response([favorite('product-a', 'Áo vẫn còn')]))
      .mockRejectedValueOnce(new Error('Mất kết nối'));
    await renderScreen();

    const scrollView = tree?.root.findAllByType(ScrollView)[0];
    expect(scrollView).toBeDefined();
    await renderer.act(async () => {
      scrollView!.props.refreshControl.props.onRefresh();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(tree?.root.findAllByType(Text).map((node) => node.props.children)).toContain('Áo vẫn còn');
    expect(alertSpy).toHaveBeenCalledWith('Chưa tải được yêu thích', 'Mất kết nối');
  });

  it('keeps the current list visible during a silent stale focus refresh', async () => {
    const current = favorite('product-a', 'Áo đang hiển thị');
    mockedFavoritesApi.getFavorites.mockResolvedValueOnce(response([current]));
    await renderScreen();

    const refresh = deferred<FavoriteListResponse>();
    mockedFavoritesApi.getFavorites.mockReturnValueOnce(refresh.promise);
    now += 31_000;
    await renderer.act(async () => {
      Array.from(mockFocusCallbacks).forEach((callback) => callback());
      await Promise.resolve();
    });

    const labels = tree?.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels).toContain('Áo đang hiển thị');
    expect(labels).not.toContain('Đang tải danh sách yêu thích');
    expect(tree?.root.findAllByType(ScrollView)[0]?.props.refreshControl.props.refreshing).toBe(false);

    await renderer.act(async () => {
      refresh.resolve(response([current]));
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('deduplicates removal of one product while allowing another product to be removed', async () => {
    const removalA = deferred<{ productId: string; isFavorited: boolean }>();
    const removalB = deferred<{ productId: string; isFavorited: boolean }>();
    mockedFavoritesApi.getFavorites.mockResolvedValue(response([
      favorite('product-a', 'Áo A'),
      favorite('product-b', 'Áo B'),
    ]));
    mockedFavoritesApi.removeFavorite.mockImplementation((_token, productId) => (
      productId === 'product-a' ? removalA.promise : removalB.promise
    ));
    await renderScreen();

    const event = { stopPropagation: jest.fn() };
    await renderer.act(async () => {
      favoriteButton('Áo A').props.onPress(event);
      favoriteButton('Áo A').props.onPress(event);
      favoriteButton('Áo B').props.onPress(event);
      await Promise.resolve();
    });

    expect(mockedFavoritesApi.removeFavorite).toHaveBeenCalledTimes(2);
    expect(mockedFavoritesApi.removeFavorite).toHaveBeenCalledWith('access-token', 'product-a');
    expect(mockedFavoritesApi.removeFavorite).toHaveBeenCalledWith('access-token', 'product-b');

    await renderer.act(async () => {
      removalA.resolve({ productId: 'product-a', isFavorited: false });
      removalB.resolve({ productId: 'product-b', isFavorited: false });
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
