import { sessionStorage } from '../auth/sessionStorage';

const RECOMMENDATION_SESSION_STORAGE_KEY = 'fashionista.recommendationSessionId';

const createSessionId = () =>
  `rec_session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const getRecommendationSessionId = async () => {
  const existingSessionId = await sessionStorage.getItemAsync(RECOMMENDATION_SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createSessionId();
  await sessionStorage.setItemAsync(RECOMMENDATION_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
};
