import { useCallback, useEffect, useRef, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { authApi, type AuthSession } from './authApi';

type GoogleAuthOptions = {
  clientId: string;
  redirectUri?: string;
  onSuccess: (session: AuthSession) => void;
  onError: (message: string) => void;
};

export const useGoogleAuth = ({
  clientId,
  redirectUri,
  onSuccess,
  onError,
}: GoogleAuthOptions) => {
  const [loading, setLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const processedTokenRef = useRef('');
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId,
    redirectUri,
    selectAccount: true,
  });

  const handleGoogleToken = useCallback(async (idToken: string) => {
    if (!idToken || processedTokenRef.current === idToken) return;
    processedTokenRef.current = idToken;
    let succeeded = false;
    setLoading(true);
    try {
      const session = await authApi.socialLogin('google', idToken);
      succeeded = true;
      onSuccessRef.current(session);
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : 'Đăng nhập Google thất bại');
    } finally {
      if (!succeeded) processedTokenRef.current = '';
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token || response.authentication?.idToken;
      if (idToken) {
        void handleGoogleToken(idToken);
      } else {
        setLoading(false);
        onErrorRef.current('Google không trả về mã xác thực hợp lệ');
      }
    } else if (response?.type === 'error') {
      setLoading(false);
      onErrorRef.current(response.error?.message || 'Đăng nhập Google thất bại');
    } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [handleGoogleToken, response]);

  const signInWithGoogle = useCallback(async () => {
    if (!request || loading) return;
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') setLoading(false);
    } catch (error) {
      setLoading(false);
      onErrorRef.current(error instanceof Error ? error.message : 'Không thể mở đăng nhập Google');
    }
  }, [loading, promptAsync, request]);

  return { signInWithGoogle, loading, ready: Boolean(request) };
};
