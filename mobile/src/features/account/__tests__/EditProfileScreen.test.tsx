import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { locationApi } from '../../auth/locationApi';
import { accountApi, type UserAddress, type UserProfile } from '../accountApi';
import EditProfileScreen from '../EditProfileScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('../../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../auth/locationApi', () => ({
  locationApi: {
    getProvinces: jest.fn(),
    getWardList: jest.fn(),
  },
}));

jest.mock('../accountApi', () => ({
  accountApi: {
    getMe: jest.fn(),
    getAddresses: jest.fn(),
    updateMe: jest.fn(),
    uploadAvatar: jest.fn(),
    addAddress: jest.fn(),
    updateAddress: jest.fn(),
    deleteAddress: jest.fn(),
    setDefaultAddress: jest.fn(),
    changePassword: jest.fn(),
  },
}));

jest.mock('../../../components/ui/LocationPicker', () => {
  const ReactModule = require('react') as typeof React;
  return {
    LocationPicker: (props: Record<string, unknown>) => ReactModule.createElement('LocationPicker', props),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react') as typeof React;
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactModule = require('react') as typeof React;
  return {
    MaterialCommunityIcons: (props: Record<string, unknown>) => ReactModule.createElement('Icon', props),
  };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

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

type TestNode = {
  type: unknown;
  props: Record<string, any>;
  parent: TestNode | null;
};

const mockedUseNavigation = useNavigation as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedAccountApi = accountApi as jest.Mocked<typeof accountApi>;
const mockedLocationApi = locationApi as jest.Mocked<typeof locationApi>;
const mockedImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;

const baseProfile: UserProfile = {
  _id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  phone: '0900000000',
  role: 'user',
  gender: 'female',
  dateOfBirth: '1995-05-10',
  profileCompleted: true,
};

const address: UserAddress = {
  _id: 'address-1',
  customerName: 'Test User',
  phoneNumber: '0900000000',
  province: 'Province A',
  provinceCode: 'A',
  ward: 'Ward A',
  wardCode: 'A-1',
  streetName: '123 Test Street',
  isDefault: true,
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

describe('EditProfileScreen account lifecycle', () => {
  let tree: ReturnType<typeof renderer.create> | null = null;
  let updateSessionUser: jest.Mock;
  let logout: jest.Mock;
  let navigation: { goBack: jest.Mock; reset: jest.Mock };
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    updateSessionUser = jest.fn();
    logout = jest.fn().mockResolvedValue(undefined);
    navigation = { goBack: jest.fn(), reset: jest.fn() };
    mockedUseNavigation.mockReturnValue(navigation);
    mockedUseAuth.mockReturnValue({
      session: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { ...baseProfile, mustChangePassword: false },
      },
      updateSessionUser,
      logout,
      runWithAuth: (action: (token: string) => Promise<unknown>) => action('access-token'),
    });
    mockedAccountApi.getMe.mockResolvedValue(baseProfile);
    mockedAccountApi.getAddresses.mockResolvedValue([]);
    mockedAccountApi.deleteAddress.mockResolvedValue([]);
    mockedAccountApi.changePassword.mockResolvedValue(null);
    mockedLocationApi.getProvinces.mockResolvedValue([
      { code: 'A', name: 'Province A' },
      { code: 'B', name: 'Province B' },
    ]);
    mockedLocationApi.getWardList.mockResolvedValue({
      province: null,
      wards: [],
      manualEntryAllowed: false,
    });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    if (tree) {
      await renderer.act(async () => tree?.unmount());
      tree = null;
    }
    alertSpy.mockRestore();
  });

  const renderScreen = async () => {
    await renderer.act(async () => {
      tree = renderer.create(<EditProfileScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const pressableForText = (label: string) => {
    const textNode = tree?.root.findAllByType(Text).find((node) => node.props.children === label);
    expect(textNode).toBeDefined();
    let pressable = textNode?.parent ?? null;
    while (pressable && typeof pressable.props.onPress !== 'function') {
      pressable = pressable.parent;
    }
    expect(pressable).toBeDefined();
    return pressable!;
  };

  const pressText = async (label: string) => {
    const pressable = pressableForText(label);
    await renderer.act(async () => pressable.props.onPress());
  };

  const locationPicker = () => {
    const picker = tree?.root.findAll((node) => node.type === 'LocationPicker')[0];
    expect(picker).toBeDefined();
    return picker!;
  };

  const pressIcon = async (name: string) => {
    const icon = tree?.root.findAll((node) => node.type === 'Icon' && node.props.name === name)[0];
    expect(icon).toBeDefined();
    let pressable = icon?.parent ?? null;
    while (pressable && typeof pressable.props.onPress !== 'function') {
      pressable = pressable.parent;
    }
    expect(pressable).toBeDefined();
    await renderer.act(async () => pressable?.props.onPress());
  };

  it('ignores an older account reload after a newer refresh finishes', async () => {
    const oldProfile = deferred<UserProfile>();
    const oldAddresses = deferred<UserAddress[]>();
    mockedAccountApi.getMe
      .mockImplementationOnce(() => oldProfile.promise)
      .mockResolvedValueOnce({ ...baseProfile, name: 'Newest User' });
    mockedAccountApi.getAddresses
      .mockImplementationOnce(() => oldAddresses.promise)
      .mockResolvedValueOnce([]);
    await renderScreen();

    await pressIcon('refresh');
    await renderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await renderer.act(async () => {
      oldProfile.resolve({ ...baseProfile, name: 'Stale User' });
      oldAddresses.resolve([]);
      await Promise.resolve();
    });

    const visibleText = tree?.root.findAllByType(Text).map((node) => node.props.children);
    expect(visibleText).toContain('Newest User');
    expect(visibleText).not.toContain('Stale User');
    expect(mockedLocationApi.getProvinces).toHaveBeenCalledTimes(1);
  });

  it('keeps wards from the latest province selection when responses finish out of order', async () => {
    const provinceA = deferred<Awaited<ReturnType<typeof locationApi.getWardList>>>();
    const provinceB = deferred<Awaited<ReturnType<typeof locationApi.getWardList>>>();
    mockedLocationApi.getWardList.mockImplementation((code) => (
      String(code) === 'A' ? provinceA.promise : provinceB.promise
    ));
    await renderScreen();
    await pressText('Địa chỉ');
    await pressText('Chọn tỉnh/thành phố');

    await renderer.act(async () => {
      locationPicker().props.onSelect('A');
      locationPicker().props.onSelect('B');
    });
    await renderer.act(async () => provinceB.resolve({
      province: null,
      wards: [{ code: 'B-1', name: 'Ward B', provinceCode: 'B' }],
      manualEntryAllowed: false,
    }));
    await renderer.act(async () => provinceA.resolve({
      province: null,
      wards: [{ code: 'A-1', name: 'Ward A', provinceCode: 'A' }],
      manualEntryAllowed: false,
    }));

    await pressText('Chọn phường/xã');
    expect(locationPicker().props.options).toEqual([
      { label: 'Ward B', value: 'B-1' },
    ]);
  });

  it('marks the session profile incomplete after deleting the last address', async () => {
    mockedAccountApi.getMe.mockResolvedValue({ ...baseProfile, address: [address] });
    mockedAccountApi.getAddresses.mockResolvedValue([address]);
    mockedLocationApi.getWardList.mockResolvedValue({
      province: null,
      wards: [{ code: 'A-1', name: 'Ward A', provinceCode: 'A' }],
      manualEntryAllowed: false,
    });
    await renderScreen();
    await pressText('Địa chỉ');

    const deleteIcon = tree?.root.findAll((node) => (
      node.type === 'Icon' && node.props.name === 'trash-can-outline'
    ))[0];
    expect(deleteIcon).toBeDefined();
    let deleteButton = deleteIcon?.parent ?? null;
    while (deleteButton && typeof deleteButton.props.onPress !== 'function') {
      deleteButton = deleteButton.parent;
    }
    expect(deleteButton).toBeDefined();
    await renderer.act(async () => deleteButton?.props.onPress());
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void | Promise<void> }>;
    const confirmDelete = buttons.find((button) => button.text === 'Xóa');

    await renderer.act(async () => { await confirmDelete?.onPress?.(); });

    expect(updateSessionUser).toHaveBeenCalledWith({ profileCompleted: false });
  });

  it('clears the local session immediately after a successful password change', async () => {
    await renderScreen();
    await pressText('Bảo mật');
    const inputs = tree?.root.findAllByType(TextInput) ?? [];
    expect(inputs).toHaveLength(3);

    await renderer.act(async () => {
      inputs[0].props.onChangeText('current123');
      inputs[1].props.onChangeText('newPassword123');
      inputs[2].props.onChangeText('newPassword123');
    });
    await pressText('Đổi mật khẩu');

    expect(mockedAccountApi.changePassword).toHaveBeenCalled();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  });

  it('submits only one password change when the button is tapped twice quickly', async () => {
    const passwordChange = deferred<null>();
    mockedAccountApi.changePassword.mockReturnValue(passwordChange.promise);
    await renderScreen();
    await pressText('Bảo mật');
    const inputs = tree?.root.findAllByType(TextInput) ?? [];
    await renderer.act(async () => {
      inputs[0].props.onChangeText('current123');
      inputs[1].props.onChangeText('newPassword123');
      inputs[2].props.onChangeText('newPassword123');
    });
    const changePasswordButton = pressableForText('Đổi mật khẩu');

    await renderer.act(async () => {
      const firstRequest = changePasswordButton.props.onPress();
      const duplicateRequest = changePasswordButton.props.onPress();
      expect(mockedAccountApi.changePassword).toHaveBeenCalledTimes(1);
      passwordChange.resolve(null);
      await Promise.all([firstRequest, duplicateRequest]);
    });

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('rejects an unsupported avatar before uploading it', async () => {
    mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file:///avatar.gif',
        base64: 'invalid-image-content',
        mimeType: 'image/gif',
        fileSize: 1024,
      }],
    } as never);
    await renderScreen();

    await pressText('Chọn ảnh');

    expect(mockedAccountApi.uploadAvatar).not.toHaveBeenCalled();
    expect(updateSessionUser).not.toHaveBeenCalled();
  });
});
