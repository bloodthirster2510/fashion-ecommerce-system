import { useEffect, useRef, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { authApi, type AuthSession } from './authApi';

export const useGoogleAuth = (onSuccess: (session: AuthSession) => void) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleToken(id_token);
    } else if (response?.type === 'error') {
      setError(response.error?.message || 'Đăng nhập Google thất bại');
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string) => {
    setLoading(true);
    setError('');
    try {
      const session = await authApi.socialLogin('google', idToken);
      onSuccessRef.current(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    await promptAsync();
  };

  return { signInWithGoogle, loading, error };
};
