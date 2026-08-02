import { sessionStorage } from '../auth/sessionStorage';

const RECOMMENDATION_SESSION_STORAGE_KEY = 'fashionista.recommendationSessionId';
let sessionInitialization: Promise<string> | null = null;

const createSessionId = () =>
  `rec_session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const initializeRecommendationSessionId = async () => {
  const existingSessionId = await sessionStorage.getItemAsync(RECOMMENDATION_SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createSessionId();
  await sessionStorage.setItemAsync(RECOMMENDATION_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
};

export const getRecommendationSessionId = () => {
  if (!sessionInitialization) {
    sessionInitialization = initializeRecommendationSessionId()
      .finally(() => {
        sessionInitialization = null;
      });
  }

  return sessionInitialization;
};
