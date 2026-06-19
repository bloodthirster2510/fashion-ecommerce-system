import { useEffect, useRef, useState } from 'react';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { authApi, type AuthSession } from './authApi';

export const useFacebookAuth = (onSuccess: (session: AuthSession) => void) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [, response, promptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '',
    scopes: ['public_profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      handleFacebookToken(access_token);
    } else if (response?.type === 'error') {
      setError(response.error?.message || 'Đăng nhập Facebook thất bại');
    }
  }, [response]);

  const handleFacebookToken = async (accessToken: string) => {
    setLoading(true);
    setError('');
    try {
      const session = await authApi.socialLogin('facebook', accessToken);
      onSuccessRef.current(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập Facebook thất bại');
    } finally {
      setLoading(false);
    }
  };

  const signInWithFacebook = async () => {
    setError('');
    await promptAsync();
  };

  return { signInWithFacebook, loading, error };
};
