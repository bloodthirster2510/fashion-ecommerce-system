import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { TryOnContextPreset } from './virtualTryOn.types';

export type ContextPresetMeta = {
  key: TryOnContextPreset;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  viPreview: string;
  enPromptPreview: string;
};

export const contextPresets: ContextPresetMeta[] = [
  {
    key: 'none',
    label: 'Giữ nền cũ',
    icon: 'image-outline',
    viPreview: 'Giữ nguyên nền, ánh sáng và góc máy của ảnh gốc, chỉ thay đồ mặc.',
    enPromptPreview: 'Keep original background, lighting, camera angle and room details, swap only the clothing.',
  },
  {
    key: 'work',
    label: 'Đi làm',
    icon: 'briefcase-outline',
    viPreview: 'Phong cách công sở hiện đại, ánh sáng gọn gàng, cảm giác chỉn chu và lịch sự.',
    enPromptPreview: 'Modern office setting, polished everyday workwear mood, clean professional styling, soft indoor lighting.',
  },
  {
    key: 'casual',
    label: 'Đi chơi',
    icon: 'party-popper',
    viPreview: 'Phố thị thoải mái, ánh sáng ban ngày tự nhiên, dáng đi năng động và dễ gần.',
    enPromptPreview: 'Clean casual street setting, natural daylight, relaxed everyday styling, effortless outfit balance.',
  },
  {
    key: 'party',
    label: 'Dự tiệc',
    icon: 'glass-cocktail',
    viPreview: 'Không gian tiệc tối thanh lịch, ánh sáng lung linh, phong cách chỉn chu và sang trọng.',
    enPromptPreview: 'Tasteful evening event setting, elegant lighting, refined social occasion styling, polished fashion finish.',
  },
  {
    key: 'travel',
    label: 'Du lịch',
    icon: 'airplane',
    viPreview: 'Cảm giác du lịch ngoài trời, ánh sáng tự nhiên thoáng đãng, dáng thoải mái và năng động.',
    enPromptPreview: 'Bright travel lifestyle setting, natural outdoor feel, vacation-ready styling, airy daylight, realistic movement.',
  },
  {
    key: 'sport',
    label: 'Thể thao',
    icon: 'run',
    viPreview: 'Không gian vận động sạch sẽ, năng lượng thể thao, cảm giác vải thoáng và dáng chủ động.',
    enPromptPreview: 'Active lifestyle setting, clean sporty energy, athletic styling, breathable fabric feel, dynamic but realistic body alignment.',
  },
  {
    key: 'date',
    label: 'Hẹn hò',
    icon: 'heart-outline',
    viPreview: 'Quán cà phê hoặc nhà hàng ấm cúng, ánh sáng dịu và tôn vinh, phong cách thanh lịch, gần gũi.',
    enPromptPreview: 'Warm cafe or dinner setting, natural flattering light, soft lifestyle portrait mood, tasteful styling, approachable elegant atmosphere.',
  },
  {
    key: 'custom',
    label: 'Mô tả riêng',
    icon: 'pencil-outline',
    viPreview: 'Bạn đang yêu cầu AI tạo bối cảnh theo mô tả của bạn — chỉ nên mô tả không gian, ánh sáng hoặc dịp mặc thời trang.',
    enPromptPreview: '',
  },
];

const contextPresetMap: Record<TryOnContextPreset, ContextPresetMeta> = contextPresets.reduce(
  (acc, meta) => {
    acc[meta.key] = meta;
    return acc;
  },
  {} as Record<TryOnContextPreset, ContextPresetMeta>,
);

export const contextPresetLabel = (key: TryOnContextPreset | string | undefined): string => {
  if (!key) return '';
  const meta = contextPresetMap[key as TryOnContextPreset];
  return meta ? meta.label : '';
};

export const contextPresetMeta = (key: TryOnContextPreset | string | undefined): ContextPresetMeta | undefined => {
  if (!key) return undefined;
  return contextPresetMap[key as TryOnContextPreset];
};