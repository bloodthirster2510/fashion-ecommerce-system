import type {
  VirtualTryOnContextPreset,
  VirtualTryOnItemRole,
  VirtualTryOnOutfitMode,
} from '../../../database/models';
import type {
  VirtualTryOnProviderGarment,
  VirtualTryOnSourceImageProfile,
} from './virtual-try-on-provider';

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

export type VirtualTryOnContextPresetPreview = {
  key: VirtualTryOnContextPreset;
  label: string;
  viPreview: string;
  enPromptPreview: string;
};

export const contextPresetPreviews: VirtualTryOnContextPresetPreview[] = [
  {
    key: 'none',
    label: 'Giữ nền cũ',
    viPreview: 'Giữ nguyên nền, ánh sáng và góc máy của ảnh gốc, chỉ thay đồ mặc.',
    enPromptPreview: 'Keep original background, lighting, camera angle and room details, swap only the clothing.',
  },
  {
    key: 'work',
    label: 'Đi làm',
    viPreview: 'Phong cách công sở hiện đại, ánh sáng gọn gàng, cảm giác chỉn chu và lịch sự.',
    enPromptPreview: 'Modern office setting, polished everyday workwear mood, clean professional styling, soft indoor lighting.',
  },
  {
    key: 'casual',
    label: 'Đi chơi',
    viPreview: 'Phố thị thoải mái, ánh sáng ban ngày tự nhiên, dáng đi năng động và dễ gần.',
    enPromptPreview: 'Clean casual street setting, natural daylight, relaxed everyday styling, effortless outfit balance.',
  },
  {
    key: 'party',
    label: 'Dự tiệc',
    viPreview: 'Không gian tiệc tối thanh lịch, ánh sáng lung linh, phong cách chỉn chu và sang trọng.',
    enPromptPreview: 'Tasteful evening event setting, elegant lighting, refined social occasion styling, polished fashion finish.',
  },
  {
    key: 'travel',
    label: 'Du lịch',
    viPreview: 'Cảm giác du lịch ngoài trời, ánh sáng tự nhiên thoáng đãng, dáng thoải mái và năng động.',
    enPromptPreview: 'Bright travel lifestyle setting, natural outdoor feel, vacation-ready styling, airy daylight, realistic movement.',
  },
  {
    key: 'sport',
    label: 'Thể thao',
    viPreview: 'Không gian vận động sạch sẽ, năng lượng thể thao, cảm giác vải thoáng và dáng chủ động.',
    enPromptPreview: 'Active lifestyle setting, clean sporty energy, athletic styling, breathable fabric feel, dynamic but realistic body alignment.',
  },
  {
    key: 'date',
    label: 'Hẹn hò',
    viPreview: 'Quán cà phê hoặc nhà hàng ấm cúng, ánh sáng dịu và tôn vinh, phong cách thanh lịch, gần gũi.',
    enPromptPreview: 'Warm cafe or dinner setting, natural flattering light, soft lifestyle portrait mood, tasteful styling, approachable elegant atmosphere.',
  },
  {
    key: 'custom',
    label: 'Mô tả riêng',
    viPreview: 'Bạn đang yêu cầu AI tạo bối cảnh theo mô tả của bạn — chỉ nên mô tả không gian, ánh sáng hoặc dịp mặc thời trang.',
    enPromptPreview: '',
  },
];

const roleLabels: Record<VirtualTryOnItemRole, string> = {
  top: 'upper-body garment such as shirt, blouse, polo, sweater, or t-shirt',
  bottom: 'lower-body garment such as pants, jeans, skirt, or shorts',
  dress: 'one-piece dress or long one-piece garment',
  shoes: 'footwear, matching pair of shoes or sandals',
  outerwear: 'outerwear layer such as jacket, blazer, coat, or cardigan',
  accessory: 'fashion accessory such as bag, hat, scarf, belt, glasses, or watch',
};

const rolePromptDetails: Record<VirtualTryOnItemRole, string> = {
  top: 'align neckline, shoulders, sleeves, chest fit, armholes, side seams, tucked or untucked hem, and visible print placement',
  bottom: 'align waistband, belt loops, hips, rise, crotch area, leg shape, inseam, cuffs, and hem length',
  dress: 'align neckline, shoulders, waistline, skirt fall, hem length, side seams, and continuous one-piece silhouette',
  shoes: 'place the complete matching pair on both feet with correct left-right pairing, sole contact, shadows, scale, and perspective',
  outerwear: 'layer over the inner outfit with correct lapels, collar, shoulder line, sleeve length, cuffs, closure, opening, and drape',
  accessory: 'place the accessory with correct scale, orientation, hand or body contact, strap path, occlusion, and natural shadow',
};

const getSourceFramingPromptParts = (sourceImageProfile?: VirtualTryOnSourceImageProfile) => {
  const visibleRegions = new Set(sourceImageProfile?.visibleRegions ?? []);
  const hasUpper = visibleRegions.has('upper');
  const hasHips = visibleRegions.has('hips');
  const hasLegs = visibleRegions.has('legs');
  const hasFeet = visibleRegions.has('feet');
  const hasAnyRegion = visibleRegions.size > 0;
  const isFullBody = hasUpper && hasHips && hasLegs && hasFeet;
  const isUpperCrop = hasUpper && !hasLegs && !hasFeet;
  const isLowerCrop = !hasUpper && (hasHips || hasLegs || hasFeet);
  const isFootCrop = hasFeet && !hasUpper && !hasHips;

  const prompts = [
    'virtual fashion try-on for the person or visible body part in the source image',
    'use the source person image as the only reference for visible identity cues, hair, expression, pose, body shape, body proportions, and skin tone',
    'preserve the original camera framing, crop, perspective, and visible body coverage from the source image',
    'do not expand a cropped source image into a full-body image, and do not invent unseen face, torso, legs, feet, or hands',
    'do not copy or infer any face, body shape, pose, age, gender presentation, or skin tone from catalog garment images or garment models',
    'preserve visible hands, fingers, neck, legs, feet, and body boundaries unless covered by selected garments',
    'replace or overlay only the selected fashion items realistically within the visible crop',
  ];

  if (!hasAnyRegion) {
    prompts.push('if the person crop is ambiguous, keep the original crop and only edit clearly visible clothing areas');
    return prompts;
  }

  if (isFullBody) {
    prompts.push('source image supports full-body try-on; keep the full body visible with the same framing and ground contact');
    return prompts;
  }

  if (isFootCrop) {
    prompts.push('source image is a feet or footwear crop; focus on feet, ankles, footwear, floor contact, and shadows without inventing upper body or face');
    return prompts;
  }

  if (isLowerCrop) {
    prompts.push('source image is a lower-body crop; focus on visible waist, hips, legs, feet, and garment fit without inventing face or upper torso');
    return prompts;
  }

  if (isUpperCrop) {
    prompts.push('source image is an upper-body crop; focus on visible head, neck, shoulders, torso, arms, and upper garments without inventing legs or feet');
    return prompts;
  }

  prompts.push('source image shows only part of the body; edit only the visible body regions and avoid hallucinating missing regions');
  return prompts;
};

const basePromptParts = [
  'virtual fashion try-on for the person in the source image',
  'the source person image is the only reference for face, identity, hair, expression, pose, body shape, body proportions, height, shoulder width, waist, legs, and skin tone',
  'do not copy or infer any face, body shape, pose, age, gender presentation, or skin tone from catalog garment images or garment models',
  'preserve hands, fingers, neck, legs, and visible body boundaries unless covered by selected garments',
  'replace or overlay only the selected fashion items realistically',
];

const garmentFidelityParts = [
  'faithfully transfer garment type, color, fabric texture, pattern, print placement, silhouette, and visible details',
  'respect seams, buttons, zippers, pockets, collars, cuffs, waistbands, hems, pleats, shoe soles, logos already present on the catalog item, and accessory hardware',
  'keep selected catalog items recognizable while adapting them to the body perspective',
  'when the catalog image contains a model or extra clothes, use only the selected garment role and ignore unrelated garments, body parts, props, hangers, labels, and background',
];

const realismPromptParts = [
  'photorealistic fashion ecommerce result',
  'natural fabric drape, realistic folds and wrinkles, correct scale, clean garment edges',
  'accurate shadows, highlights, occlusion, depth, and contact points',
  'sharp but natural image, balanced exposure, realistic skin and fabric interaction',
];

const baseNegativePromptParts = [
  'nudity, underwear-only result, explicit content, suggestive pose',
  'childlike body, violence, blood, weapon',
  'face swap, changed identity, changed body shape, changed skin tone',
  'extra limbs, missing limbs, malformed limbs, distorted hands, distorted fingers, distorted face',
  'wrong garment color, wrong garment type, missing selected garment, unselected garment replacement',
  'duplicated clothing, mismatched clothing layers, floating garment, garment detached from body',
  'duplicated shoes, mismatched shoes, single shoe only, floating shoes, shoes not on feet',
  'warped fabric, melted garment, broken seams, unnatural folds, bad occlusion, jagged mask edge',
  'text overlay, watermark, fake logo, logo hallucination, low quality, blurry, overexposed, underexposed',
];

const roleNegativePrompts: Record<VirtualTryOnItemRole, string[]> = {
  top: [
    'wrong neckline, missing sleeves, duplicated collar, shirt fused into skin, changed pants or shoes when only top is selected',
  ],
  bottom: [
    'wrong waistband, missing legs, duplicated pants, skirt turned into pants, changed shirt or shoes when only bottom is selected',
  ],
  dress: [
    'dress split into separate top and bottom, pants added under dress unless selected, broken waistline, unnatural skirt fall',
  ],
  shoes: [
    'bare feet, socks only, missing footwear, shoes on wrong feet, extra pair of shoes, distorted soles, shoes floating above ground',
  ],
  outerwear: [
    'jacket fused with inner shirt, missing lapels, impossible sleeve layering, outerwear under the shirt, changed bottom when only outerwear is selected',
  ],
  accessory: [
    'oversized accessory, tiny accessory, accessory floating, strap disconnected, accessory covering face or hiding selected garments',
  ],
};

const roleOrder: VirtualTryOnItemRole[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory'];

const uniqueRoles = (garments: VirtualTryOnProviderGarment[]) => {
  const selected = new Set(garments.map((garment) => garment.role));
  return roleOrder.filter((role) => selected.has(role));
};

const hasRole = (roles: VirtualTryOnItemRole[], role: VirtualTryOnItemRole) => roles.includes(role);

const getSingleRolePrompt = (role?: VirtualTryOnItemRole) => {
  switch (role) {
    case 'top':
      return [
        'single top try-on: replace only the upper-body garment',
        'preserve the original pants or skirt, shoes, accessories, hand position, and background unless they are naturally occluded by the new top',
        'make the top follow the torso angle, shoulder slope, arm bend, and chest depth',
      ];
    case 'bottom':
      return [
        'single bottom try-on: replace only the lower-body garment',
        'preserve the original top, outerwear, shoes, accessories, hands, and background unless natural overlap is required at the waist',
        'make the waistband sit on the hips or waist with correct rise, leg opening, and body perspective',
      ];
    case 'dress':
      return [
        'single dress try-on: replace the visible outfit with the selected one-piece dress',
        'the dress must read as one continuous garment from upper body to hem',
        'preserve the person, legs, shoes, hands, hair, and background where they remain visible',
      ];
    case 'shoes':
      return [
        'single footwear try-on: replace only the shoes or sandals',
        'preserve the outfit above the ankles and keep pants, dress, skin, and background unchanged',
        'both selected shoes must be worn on the correct feet with realistic floor contact and shadows',
      ];
    case 'outerwear':
      return [
        'single outerwear try-on: add or replace only the outer layer',
        'keep the inner top visible at neckline, front opening, cuffs, and hem when appropriate',
        'do not replace pants, skirt, dress, shoes, or accessories unless hidden by natural jacket overlap',
      ];
    case 'accessory':
      return [
        'single accessory try-on: add only the selected accessory',
        'preserve all clothing and body features while placing the accessory at a natural contact point',
        'keep straps, handles, lenses, belt line, or hardware aligned with the person perspective',
      ];
    default:
      return ['single item try-on: apply only the selected item and preserve all unrelated clothing'];
  }
};

const getTopBottomPrompt = (roles: VirtualTryOnItemRole[]) => {
  const prompts = [
    'two-piece outfit try-on: combine the selected upper garment and lower garment as a coherent outfit',
    'resolve the waist overlap naturally with correct tucked, untucked, cropped, or layered behavior',
    'keep the top above the bottom with believable fabric stacking, shadows, and no duplicate waistband',
    'preserve shoes, accessories, face, hands, hair, and background unless they are naturally occluded',
  ];

  if (hasRole(roles, 'outerwear')) {
    prompts.push('if an outerwear item is selected, layer it over the top without hiding the top completely');
  }
  if (hasRole(roles, 'shoes')) {
    prompts.push('if footwear is selected, make the full outfit read from shoulder to feet with shoes clearly grounded');
  }

  return prompts;
};

const getFullSetPrompt = (roles: VirtualTryOnItemRole[]) => {
  const prompts = [
    'complete outfit try-on: coordinate all selected garments into one wearable full look',
    'respect the vertical outfit order from shoulders and torso to waist, legs, feet, and accessories',
    'avoid inventing extra garments; every visible changed fashion item must come from the selected catalog items',
  ];

  if (hasRole(roles, 'dress')) {
    prompts.push('if a dress is selected, treat it as the main body garment and avoid adding separate pants or skirt unless that item is explicitly selected');
  }
  if (hasRole(roles, 'top') && hasRole(roles, 'bottom')) {
    prompts.push('if top and bottom are selected together, maintain a clean waist transition and consistent proportions between torso and legs');
  }
  if (hasRole(roles, 'outerwear')) {
    prompts.push('if outerwear is selected, make it sit above the top or dress with believable sleeve and collar layering');
  }
  if (hasRole(roles, 'shoes')) {
    prompts.push('if shoes are selected, show the pair on the feet with correct scale, ground contact, and no floating footwear');
  }
  if (hasRole(roles, 'accessory')) {
    prompts.push('if accessories are selected, place them naturally without covering the face or hiding important garment details');
  }

  return prompts;
};

const getOutfitModePrompts = (
  outfitMode: VirtualTryOnOutfitMode,
  roles: VirtualTryOnItemRole[],
) => {
  if (outfitMode === 'single') return getSingleRolePrompt(roles[0]);
  if (outfitMode === 'top_bottom') return getTopBottomPrompt(roles);
  return getFullSetPrompt(roles);
};

const describeGarment = (item: VirtualTryOnProviderGarment) => {
  const details = [
    roleLabels[item.role],
    item.name,
    item.color ? `color ${item.color}` : '',
    item.size ? `size ${item.size}` : '',
    rolePromptDetails[item.role],
  ].filter(Boolean);

  return details.join(', ');
};

const getRoleSpecificPrompts = (roles: VirtualTryOnItemRole[]) =>
  roles.map((role) => rolePromptDetails[role]);

const getRoleNegativePrompts = (roles: VirtualTryOnItemRole[]) =>
  roles.flatMap((role) => roleNegativePrompts[role]);

export const buildVirtualTryOnPrompt = (input: {
  garments: VirtualTryOnProviderGarment[];
  preset: VirtualTryOnContextPreset;
  outfitMode?: VirtualTryOnOutfitMode;
  customPrompt?: string;
  sourceImageProfile?: VirtualTryOnSourceImageProfile;
}) => {
  const garmentText = input.garments.map(describeGarment).join('; ');
  const roles = uniqueRoles(input.garments);
  const presetPromptParts = contextPresetPrompts[input.preset] || [];
  const contextPrompt = input.customPrompt?.trim();
  const outfitMode = input.outfitMode
    || (input.garments.length >= 3 ? 'full_set' : input.garments.length === 2 ? 'top_bottom' : 'single');
  const outfitPrompts = getOutfitModePrompts(outfitMode, roles);

  const prompt = [
    ...(input.sourceImageProfile ? getSourceFramingPromptParts(input.sourceImageProfile) : basePromptParts),
    garmentText ? `selected garments: ${garmentText}` : '',
    ...outfitPrompts,
    ...getRoleSpecificPrompts(roles),
    ...garmentFidelityParts,
    contextPrompt ? `scene requested by user: ${contextPrompt}` : '',
    ...presetPromptParts,
    ...realismPromptParts,
  ].filter(Boolean).join('. ');

  const negativePrompt = [
    ...baseNegativePromptParts,
    ...getRoleNegativePrompts(roles),
  ].join(', ');

  return { prompt, negativePrompt };
};

const videoMotionByPreset: Record<VirtualTryOnContextPreset, string> = {
  none: 'the person slowly transfers a little weight to one leg while the hips, torso, shoulders, and head follow as one connected movement, then makes a slight three-quarter turn',
  work: 'the person gently straightens their posture, shifts weight with quiet confidence, and makes a small composed shoulder turn while keeping a relaxed professional expression',
  casual: 'the person takes an easy breath, makes a relaxed side-to-side weight shift, and turns slightly as if naturally showing the outfit to a friend',
  party: 'the person eases into one understated elegant pose, with a small coordinated hip and shoulder turn and a calm glance toward the camera',
  travel: 'the person makes a relaxed sightseeing-style weight shift and slight turn while a faint steady breeze softly lifts only loose hair and fabric edges',
  sport: 'the person makes one small controlled athletic weight shift with softly flexing knees, coordinated hips and shoulders, and both feet remaining planted',
  date: 'the person takes a soft breath, makes a gentle pose change with a slight head tilt, and lets a subtle friendly expression appear naturally',
  custom: 'the person slowly transfers a little weight to one leg while the hips, torso, shoulders, and head follow as one connected movement, then makes a slight three-quarter turn',
};

const videoNegativePrompt = [
  'identity, face, body shape, or skin tone change',
  'wardrobe, garment color, pattern, print, logo, accessory, or shoe change',
  'missing or extra garment, fabric melting, texture morphing',
  'robotic motion, stiff or frozen pose, mechanical turn, unnatural rhythm',
  'abrupt start or stop, sudden acceleration, repeated or looping gesture',
  'foot sliding, floating feet, body gliding, lost balance',
  'disconnected arm motion, rubber limbs, twitching hands, fused fingers',
  'excessive blinking, darting eyes, talking, lip movement, exaggerated expression',
  'flicker, jitter, temporal inconsistency, warping, duplicated limbs, extra fingers',
  'deformed hands or face, camera cut, transition, speed ramp, slow motion',
  'camera shake or drift, pan, tilt, orbit, dolly, zoom, changing crop',
  'moving or replaced background, lighting change, text, watermark',
  'nudity, explicit content',
].join(', ');

export const buildVirtualTryOnVideoPrompt = (input: {
  preset: VirtualTryOnContextPreset;
  durationSeconds: number;
  customPrompt?: string;
}) => {
  const contextPrompt = input.customPrompt?.trim();
  const prompt = [
    `Use the input image as the exact first frame of one continuous ${input.durationSeconds}-second photorealistic fashion shot at normal real-time speed`,
    'begin almost still, ease smoothly into one simple movement, and gently settle into a balanced final pose; use natural acceleration and deceleration with no abrupt stop',
    videoMotionByPreset[input.preset],
    'keep the motion anatomically connected: planted feet and hips initiate the weight transfer, followed by the torso, shoulders, head, and relaxed visible arms and hands',
    'add only soft breathing and, when the face is clearly visible, one relaxed blink; keep the mouth naturally still',
    'fabric reacts a moment after the body, with subtle inertia, realistic folds, and gentle settling; heavy fabric moves less than loose fabric',
    'locked-off camera, stable perspective and focal length; the camera and background remain still',
    'preserve the person, face, hair, proportions, skin tone, complete outfit, garment details, accessories, shoes, background, lighting, and framing exactly as shown',
    contextPrompt ? `keep the existing user scene context: ${contextPrompt}` : '',
  ].filter(Boolean).join('. ');

  return { prompt, negativePrompt: videoNegativePrompt };
};
