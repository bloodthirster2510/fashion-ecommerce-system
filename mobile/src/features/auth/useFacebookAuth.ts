import { useCallback, useEffect, useRef, useState } from 'react';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { authApi, type AuthSession } from './authApi';

type FacebookAuthOptions = {
  clientId: string;
  redirectUri?: string;
  onSuccess: (session: AuthSession) => void;
  onError: (message: string) => void;
};

export const useFacebookAuth = ({
  clientId,
  redirectUri,
  onSuccess,
  onError,
}: FacebookAuthOptions) => {
  const [loading, setLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const processedTokenRef = useRef('');
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId,
    redirectUri,
    scopes: ['public_profile', 'email'],
  });

  const handleFacebookToken = useCallback(async (accessToken: string) => {
    if (!accessToken || processedTokenRef.current === accessToken) return;
    processedTokenRef.current = accessToken;
    let succeeded = false;
    setLoading(true);
    try {
      const session = await authApi.socialLogin('facebook', accessToken);
      succeeded = true;
      onSuccessRef.current(session);
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : 'Đăng nhập Facebook thất bại');
    } finally {
      if (!succeeded) processedTokenRef.current = '';
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const accessToken = response.params.access_token || response.authentication?.accessToken;
      if (accessToken) {
        void handleFacebookToken(accessToken);
      } else {
        setLoading(false);
        onErrorRef.current('Facebook không trả về mã xác thực hợp lệ');
      }
    } else if (response?.type === 'error') {
      setLoading(false);
      onErrorRef.current(response.error?.message || 'Đăng nhập Facebook thất bại');
    } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [handleFacebookToken, response]);

  const signInWithFacebook = useCallback(async () => {
    if (!request || loading) return;
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') setLoading(false);
    } catch (error) {
      setLoading(false);
      onErrorRef.current(error instanceof Error ? error.message : 'Không thể mở đăng nhập Facebook');
    }
  }, [loading, promptAsync, request]);

  return { signInWithFacebook, loading, ready: Boolean(request) };
};
