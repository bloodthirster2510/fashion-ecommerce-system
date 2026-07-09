import type { VirtualTryOnContextPreset, VirtualTryOnOutfitMode } from '../../../database/models';
import type { VirtualTryOnProviderGarment } from './virtual-try-on-provider';

const contextPresetPrompts: Record<VirtualTryOnContextPreset, string[]> = {
  none: [
    'preserve the original background, lighting, camera angle, and room details',
    'make only the clothing change look natural in the existing photo',
  ],
  work: [
    'modern office setting, polished everyday workwear mood',
    'clean professional styling, soft indoor lighting, neat business-casual finish',
  ],
  casual: [
    'clean casual street setting, natural daylight',
    'relaxed everyday styling, wearable lifestyle look, effortless outfit balance',
  ],
  party: [
    'tasteful evening event setting, elegant lighting',
    'refined social occasion styling, flattering highlights, polished fashion finish',
  ],
  travel: [
    'bright travel lifestyle setting, natural outdoor feel',
    'vacation-ready styling, airy daylight, realistic movement and relaxed posture',
  ],
  sport: [
    'active lifestyle setting, clean sporty energy',
    'athletic styling, breathable fabric feel, dynamic but realistic body alignment',
  ],
  date: [
    'warm cafe or dinner setting, natural flattering light',
    'soft lifestyle portrait mood, tasteful styling, approachable elegant atmosphere',
  ],
  custom: [],
};

const roleLabels: Record<string, string> = {
  top: 'upper-body garment, shirt or top',
  bottom: 'lower-body garment, pants, jeans, skirt, or shorts',
  dress: 'one-piece dress',
  shoes: 'footwear, matching pair of shoes',
  outerwear: 'outerwear layer, jacket, blazer, coat, or cardigan',
  accessory: 'fashion accessory',
};

const rolePromptDetails: Record<string, string> = {
  top: 'align neckline, shoulders, sleeves, chest fit, armholes, and hem naturally',
  bottom: 'align waistband, hips, rise, leg shape, inseam, cuffs, and hem naturally',
  dress: 'align neckline, waistline, skirt fall, hem length, and full-body silhouette naturally',
  shoes: 'place shoes on both feet, correct left-right pairing, realistic contact, scale, and perspective',
  outerwear: 'layer over the outfit with correct lapels, collar, sleeves, cuffs, closure, and drape',
  accessory: 'place accessory with correct scale, orientation, occlusion, and natural contact',
};

const basePromptParts = [
  'virtual fashion try-on for the person in the source image',
  'keep the same person identity, face, hair, expression, pose, body shape, body proportions, and skin tone',
  'preserve hands, fingers, neck, legs, and visible body boundaries unless covered by selected garments',
  'replace or overlay only the selected fashion items realistically',
];

const garmentFidelityParts = [
  'faithfully transfer garment type, color, fabric texture, pattern, print placement, silhouette, and visible details',
  'respect seams, buttons, zippers, pockets, collars, cuffs, waistbands, hems, shoe soles, and accessory hardware',
  'keep selected catalog items recognizable while adapting them to the body perspective',
];

const realismPromptParts = [
  'photorealistic fashion ecommerce result',
  'natural fabric drape, realistic folds and wrinkles, correct scale, clean garment edges',
  'accurate shadows, highlights, occlusion, depth, and contact points',
  'sharp but natural image, balanced exposure, realistic skin and fabric interaction',
];

const outfitModePrompts = {
  single: 'style the selected item as the main garment while preserving the rest of the original outfit when appropriate',
  top_bottom: 'combine the selected top and bottom into a coherent outfit with matching proportions and natural waist overlap',
  full_set: 'coordinate all selected garments into a complete outfit, keeping shoes and accessories visible when selected',
};

const describeGarment = (item: VirtualTryOnProviderGarment) => {
  const details = [
    roleLabels[item.role] || item.role,
    item.name,
    item.color ? `color ${item.color}` : '',
    item.size ? `size ${item.size}` : '',
    rolePromptDetails[item.role] || '',
  ].filter(Boolean);

  return details.join(', ');
};

export const buildVirtualTryOnPrompt = (input: {
  garments: VirtualTryOnProviderGarment[];
  preset: VirtualTryOnContextPreset;
  outfitMode?: VirtualTryOnOutfitMode;
  customPrompt?: string;
}) => {
  const garmentText = input.garments.map(describeGarment).join('; ');
  const presetPromptParts = contextPresetPrompts[input.preset] || [];
  const contextPrompt = input.customPrompt?.trim();
  const outfitMode = input.outfitMode
    || (input.garments.length >= 3 ? 'full_set' : input.garments.length === 2 ? 'top_bottom' : 'single');

  const prompt = [
    ...basePromptParts,
    garmentText ? `selected garments: ${garmentText}` : '',
    outfitModePrompts[outfitMode],
    ...garmentFidelityParts,
    contextPrompt ? `scene requested by user: ${contextPrompt}` : '',
    ...presetPromptParts,
    ...realismPromptParts,
  ].filter(Boolean).join('. ');

  const negativePrompt = [
    'nudity, underwear-only result, explicit content, suggestive pose',
    'childlike body, violence, blood, weapon',
    'face swap, changed identity, changed body shape, changed skin tone',
    'extra limbs, missing limbs, malformed limbs, distorted hands, distorted fingers, distorted face',
    'wrong garment color, wrong garment type, missing selected garment, unselected garment replacement',
    'duplicated clothing, duplicate shoes, mismatched shoes, floating shoes, shoes not on feet',
    'warped fabric, melted garment, broken seams, unnatural folds, bad occlusion, jagged mask edge',
    'text overlay, watermark, fake logo, logo hallucination, low quality, blurry, overexposed, underexposed',
  ].join(', ');

  return { prompt, negativePrompt };
};
