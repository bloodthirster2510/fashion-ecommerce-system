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
    viPreview: 'Thay nền thành văn phòng hiện đại có vách kính, bàn gỗ sáng, cây xanh và ánh sáng cửa sổ dịu.',
    enPromptPreview: 'Replace the background with a contemporary office, glass partitions, light wood desks, plants, and soft window light.',
  },
  {
    key: 'casual',
    label: 'Đi chơi',
    icon: 'party-popper',
    viPreview: 'Thay nền thành phố đi bộ hiện đại, có cửa hàng và cây xanh, ánh sáng ban ngày tự nhiên.',
    enPromptPreview: 'Replace the background with a modern pedestrian street, storefronts, trees, and natural daylight.',
  },
  {
    key: 'party',
    label: 'Dự tiệc',
    icon: 'glass-cocktail',
    viPreview: 'Thay nền thành tiệc tối sân thượng sang trọng, đèn vàng lung linh và đường chân trời thành phố.',
    enPromptPreview: 'Replace the background with an upscale rooftop evening reception, warm decorative lights, and a city skyline.',
  },
  {
    key: 'travel',
    label: 'Du lịch',
    icon: 'airplane',
    viPreview: 'Thay nền thành lối đi ven biển thoáng đãng, có trời xanh, mặt nước và ánh sáng tự nhiên.',
    enPromptPreview: 'Replace the background with a scenic seaside promenade, open sky, distant water, and bright natural daylight.',
  },
  {
    key: 'sport',
    label: 'Thể thao',
    icon: 'run',
    viPreview: 'Thay nền thành phòng tập hiện đại, không gian rộng, thiết bị gọn gàng và cửa sổ lớn.',
    enPromptPreview: 'Replace the background with a modern fitness studio, clean equipment, open floor space, and large daylight windows.',
  },
  {
    key: 'date',
    label: 'Hẹn hò',
    icon: 'heart-outline',
    viPreview: 'Thay nền thành quán cà phê ấm cúng, đèn thả vàng, bàn ghế thanh lịch và hậu cảnh xóa nhẹ.',
    enPromptPreview: 'Replace the background with a cozy upscale cafe, warm pendant lights, tasteful tables, plants, and soft interior bokeh.',
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
