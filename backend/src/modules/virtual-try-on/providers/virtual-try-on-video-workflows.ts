import { existsSync } from 'fs';
import path from 'path';

export type VirtualTryOnVideoWorkflowProfile = 'budget' | 'fast' | 'balanced' | 'quality';

export type VirtualTryOnVideoWorkflowDefinition = {
  id: VirtualTryOnVideoWorkflowProfile;
  label: string;
  description: string;
  model: string;
  workflowPath: string;
  workflowMapPath: string;
  performance: {
    speedLabel: string;
    costLabel: string;
    estimatedCostUsd: number;
    estimateBasis: string;
  };
  defaults: {
    durationSeconds: number;
    resolution: '720p' | '1080p';
    aspectRatio: '9:16' | '16:9' | '1:1';
    generateAudio: boolean;
  };
};

const resolveWorkflowFile = (configuredPath: string | undefined, fallbackPath: string) => {
  const requestedPath = configuredPath?.trim() || fallbackPath;
  const candidates = [
    path.resolve(requestedPath),
    path.resolve(process.cwd(), 'backend', requestedPath),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
};

export const normalizeVideoWorkflowProfile = (
  value: unknown,
): VirtualTryOnVideoWorkflowProfile => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'budget' || normalized === 'fast' || normalized === 'balanced' || normalized === 'quality'
    ? normalized
    : 'quality';
};

export const inferVideoWorkflowProfile = (
  profile: unknown,
  model?: unknown,
): VirtualTryOnVideoWorkflowProfile => {
  if (profile === 'budget' || profile === 'fast' || profile === 'balanced' || profile === 'quality') return profile;
  const normalizedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';
  if (normalizedModel === 'viduq2-pro-fast') return 'budget';
  if (normalizedModel.startsWith('vidu')) return 'fast';
  if (normalizedModel === 'kling-v2-5-turbo') return 'balanced';
  return 'quality';
};

export const getVideoWorkflowDefinition = (
  profile: unknown,
): VirtualTryOnVideoWorkflowDefinition => {
  const normalized = normalizeVideoWorkflowProfile(profile);
  const definitions: Record<VirtualTryOnVideoWorkflowProfile, VirtualTryOnVideoWorkflowDefinition> = {
    budget: {
      id: 'budget',
      label: 'Tiết kiệm nhất — Vidu Q2 Pro Fast (~$0.08)',
      description: 'Chi phí thấp nhất cho bản xem thử nhanh; ưu tiên tốc độ và ngân sách.',
      model: 'viduq2-pro-fast',
      workflowPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-vidu-q2-turbo-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-vidu-q2-turbo-i2v-map.json',
      ),
      performance: {
        speedLabel: 'Rất nhanh',
        costLabel: 'Rẻ nhất',
        estimatedCostUsd: 0.08,
        estimateBasis: '5 giây, 720p',
      },
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
    fast: {
      id: 'fast',
      label: 'Nhanh — Vidu Q2 Turbo (~$0.20)',
      description: 'Ưu tiên tốc độ xử lý và chuyển động tốt hơn bản tiết kiệm.',
      model: 'viduq2-turbo',
      workflowPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-vidu-q2-turbo-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-vidu-q2-turbo-i2v-map.json',
      ),
      performance: {
        speedLabel: 'Nhanh',
        costLabel: 'Rẻ',
        estimatedCostUsd: 0.20,
        estimateBasis: '5 giây, 720p',
      },
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
    balanced: {
      id: 'balanced',
      label: 'Cân bằng — Kling 2.5 Turbo (~$0.35)',
      description: 'Cân bằng giữa thời gian xử lý, chi phí và chất lượng chuyển động.',
      model: 'kling-v2-5-turbo',
      workflowPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-kling-v2-5-turbo-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-kling-v2-5-turbo-i2v-map.json',
      ),
      performance: {
        speedLabel: 'Trung bình',
        costLabel: 'Trung bình',
        estimatedCostUsd: 0.35,
        estimateBasis: '5 giây, chế độ Pro',
      },
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
    quality: {
      id: 'quality',
      label: 'Cao cấp — Kling 3 Omni (~$0.42)',
      description: 'Ưu tiên chất lượng và độ ổn định; chi phí tăng theo thời lượng, độ phân giải và âm thanh.',
      model: 'kling-v3-omni',
      workflowPath: resolveWorkflowFile(
        process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH,
        'config/comfy-workflows/fashion-tryon-kling-v3-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH,
        'config/comfy-workflows/fashion-tryon-kling-v3-i2v-map.json',
      ),
      performance: {
        speedLabel: 'Chậm hơn',
        costLabel: 'Cao',
        estimatedCostUsd: 0.42,
        estimateBasis: '5 giây, 720p, không âm thanh',
      },
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
  };
  return definitions[normalized];
};

export const getVideoWorkflowOptions = () => (
  (['budget', 'fast', 'balanced', 'quality'] as const).map((profile) => getVideoWorkflowDefinition(profile))
);

export const transformVideoWorkflowInput = (
  profile: VirtualTryOnVideoWorkflowProfile,
  key: string,
  value: unknown,
) => profile === 'balanced' && key === 'duration'
  ? String(Number(value) < 8 ? 5 : 10)
  : value;
