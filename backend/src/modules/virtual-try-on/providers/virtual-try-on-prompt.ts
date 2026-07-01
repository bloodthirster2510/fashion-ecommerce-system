import type { VirtualTryOnContextPreset } from '../../../database/models';
import type { VirtualTryOnProviderGarment } from './virtual-try-on-provider';

const contextPresetPrompts: Record<VirtualTryOnContextPreset, string> = {
  none: 'preserve the original background and lighting',
  work: 'modern office setting, polished everyday workwear mood',
  casual: 'clean casual street setting, natural daylight',
  party: 'tasteful evening event setting, elegant lighting',
  travel: 'bright travel lifestyle setting, natural outdoor feel',
  sport: 'active lifestyle setting, clean sporty energy',
  date: 'warm cafe or dinner setting, natural flattering light',
  custom: '',
};

const roleLabels: Record<string, string> = {
  top: 'top',
  bottom: 'bottom',
  dress: 'dress',
  shoes: 'shoes',
  outerwear: 'outerwear',
  accessory: 'accessory',
};

const describeGarment = (item: VirtualTryOnProviderGarment) => {
  const details = [
    roleLabels[item.role] || item.role,
    item.name,
    item.color ? `color ${item.color}` : '',
    item.size ? `size ${item.size}` : '',
  ].filter(Boolean);

  return details.join(', ');
};

export const buildVirtualTryOnPrompt = (input: {
  garments: VirtualTryOnProviderGarment[];
  preset: VirtualTryOnContextPreset;
  customPrompt?: string;
}) => {
  const garmentText = input.garments.map(describeGarment).join('; ');
  const presetPrompt = contextPresetPrompts[input.preset];
  const contextPrompt = input.customPrompt?.trim() || presetPrompt;

  const prompt = [
    'virtual fashion try-on for the person in the source image',
    'keep the person identity, face, pose, body shape, and skin tone consistent',
    'replace or overlay only the selected fashion items realistically',
    garmentText ? `selected garments: ${garmentText}` : '',
    contextPrompt ? `scene: ${contextPrompt}` : '',
    'photorealistic, natural fabric drape, correct scale, clean edges',
  ].filter(Boolean).join('. ');

  const negativePrompt = [
    'nudity, underwear-only result, explicit content, suggestive pose',
    'childlike body, violence, blood, weapon',
    'extra limbs, missing limbs, distorted hands, distorted face',
    'wrong garment color, wrong garment type, duplicate shoes',
    'text overlay, watermark, logo hallucination, low quality, blurry',
  ].join(', ');

  return { prompt, negativePrompt };
};
