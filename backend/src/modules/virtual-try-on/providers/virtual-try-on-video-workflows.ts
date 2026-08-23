import { existsSync } from 'fs';
import path from 'path';

export type VirtualTryOnVideoWorkflowProfile = 'fast' | 'balanced' | 'quality';

export type VirtualTryOnVideoWorkflowDefinition = {
  id: VirtualTryOnVideoWorkflowProfile;
  label: string;
  description: string;
  model: string;
  workflowPath: string;
  workflowMapPath: string;
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
  return normalized === 'fast' || normalized === 'balanced' || normalized === 'quality'
    ? normalized
    : 'quality';
};

export const inferVideoWorkflowProfile = (
  profile: unknown,
  model?: unknown,
): VirtualTryOnVideoWorkflowProfile => {
  if (profile === 'fast' || profile === 'balanced' || profile === 'quality') return profile;
  const normalizedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';
  if (normalizedModel.startsWith('vidu')) return 'fast';
  if (normalizedModel === 'kling-v2-5-turbo') return 'balanced';
  return 'quality';
};

export const getVideoWorkflowDefinition = (
  profile: unknown,
): VirtualTryOnVideoWorkflowDefinition => {
  const normalized = normalizeVideoWorkflowProfile(profile);
  const definitions: Record<VirtualTryOnVideoWorkflowProfile, VirtualTryOnVideoWorkflowDefinition> = {
    fast: {
      id: 'fast',
      label: 'Nhanh — Vidu Q2 Turbo',
      description: 'Ưu tiên tốc độ xử lý, phù hợp xem thử nhanh.',
      model: 'viduq2-turbo',
      workflowPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-vidu-q2-turbo-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-vidu-q2-turbo-i2v-map.json',
      ),
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
    balanced: {
      id: 'balanced',
      label: 'Cân bằng — Kling 2.5 Turbo',
      description: 'Cân bằng giữa thời gian xử lý và chất lượng chuyển động.',
      model: 'kling-v2-5-turbo',
      workflowPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-kling-v2-5-turbo-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        undefined,
        'config/comfy-workflows/fashion-tryon-kling-v2-5-turbo-i2v-map.json',
      ),
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
    quality: {
      id: 'quality',
      label: 'Chất lượng cao — Kling 3 Omni',
      description: 'Workflow hiện tại, ưu tiên chất lượng hình ảnh.',
      model: 'kling-v3-omni',
      workflowPath: resolveWorkflowFile(
        process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_PATH,
        'config/comfy-workflows/fashion-tryon-kling-v3-i2v-api.json',
      ),
      workflowMapPath: resolveWorkflowFile(
        process.env.VIRTUAL_TRY_ON_VIDEO_COMFY_WORKFLOW_MAP_PATH,
        'config/comfy-workflows/fashion-tryon-kling-v3-i2v-map.json',
      ),
      defaults: { durationSeconds: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false },
    },
  };
  return definitions[normalized];
};

export const getVideoWorkflowOptions = () => (
  (['fast', 'balanced', 'quality'] as const).map((profile) => getVideoWorkflowDefinition(profile))
);

export const transformVideoWorkflowInput = (
  profile: VirtualTryOnVideoWorkflowProfile,
  key: string,
  value: unknown,
) => profile === 'balanced' && key === 'duration'
  ? String(Number(value) < 8 ? 5 : 10)
  : value;
