import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { connectDB } from '../config/database';
import {
  Product,
  User,
  VirtualTryOnAsset,
  VirtualTryOnJob,
} from '../database/models';
import type {
  VirtualTryOnContextPreset,
  VirtualTryOnItemRole,
  VirtualTryOnOutfitMode,
} from '../database/models';
import type {
  IColorVariant,
  IProductSizeMeasurement,
  IProductVariant,
} from '../database/models/product.model';

dotenv.config({ path: path.resolve('.env') });

type GarmentRequest = {
  productId: string;
  color: string;
  role: VirtualTryOnItemRole;
  size?: string;
};

type CampaignRun = {
  id: number;
  sourceIndex: number;
  label: string;
  preset: VirtualTryOnContextPreset;
  scene?: string;
  garments: GarmentRequest[];
  makeVideo?: boolean;
};

type ResolvedGarment = {
  productId: string;
  variantId: string;
  colorVariantId: string;
  size?: string;
  role: VirtualTryOnItemRole;
  name: string;
  color: string;
  image: string;
};

type Timing = {
  runId: number;
  label: string;
  sourceIndex: number;
  preserveBackground: boolean;
  makeVideo: boolean;
  state: 'pending' | 'queued' | 'processing' | 'complete' | 'failed';
  jobId?: string;
  createdAt?: string;
  startedAt?: string;
  imageReadyAt?: string;
  videoStartedAt?: string;
  completedAt?: string;
  queueMs?: number;
  imageStageMs?: number;
  videoStageMs?: number;
  totalMs?: number;
  imageCount?: number;
  imageUrls?: string[];
  videoUrl?: string;
  garments?: Array<{ name: string; color: string; role: string; image: string }>;
  error?: string;
};

const workspaceRoot = path.resolve('..');
const outputRoot = path.join(workspaceRoot, 'output', 'comfy-mobile-shop-garments-2026-08-09');
const batchKey = 'mobile-shop-garments-2026-08-09-v1';
const previousSourceBatchKey = 'mobile-user-campaign-2026-08-09-v2';
const pollIntervalMs = 2_500;
const jobTimeoutMs = 55 * 60 * 1_000;

const garment = (
  productId: string,
  color: string,
  role: VirtualTryOnItemRole,
  size?: string,
): GarmentRequest => ({ productId, color, role, size });

const runs: CampaignRun[] = [
  { id: 1, sourceIndex: 1, label: 'Giữ nền nữ 01 - sơ mi vàng và quần be', preset: 'none', garments: [garment('76fe4f7aa5634a3ae8c50aa5', 'Vàng', 'top', 'S'), garment('8e259df3bc1a520b6bdd93f9', 'Be', 'bottom', 'S')] },
  { id: 2, sourceIndex: 2, label: 'Giữ nền nữ 02 - polo hồng và baggy trắng', preset: 'none', garments: [garment('7c0f8a10a147d1c0ba9ac745', 'Hồng', 'top', 'S'), garment('2f5fa044af449c0a22678290', 'Trắng', 'bottom', 'S')] },
  { id: 3, sourceIndex: 3, label: 'Giữ nền nữ 03 - len sọc đen trắng', preset: 'none', garments: [garment('32736048dd640fb65fb85672', 'Đen kẻ trắng', 'top', 'M')] },
  { id: 4, sourceIndex: 4, label: 'Giữ nền nữ 04 - sơ mi xanh', preset: 'none', garments: [garment('70e60ecff89e27906a220007', 'Xanh', 'top', 'M')] },
  { id: 5, sourceIndex: 5, label: 'Giữ nền nữ 05 - áo giữ nhiệt đỏ đô', preset: 'none', garments: [garment('30bdd588b0aa1f48f6e5cc7d', 'Đỏ đô', 'top', 'M')] },
  { id: 6, sourceIndex: 6, label: 'Giữ nền nữ 06 - hai dây xanh và quần đen', preset: 'none', garments: [garment('c0dae92879d2cd8592aae2c2', 'Xanh coban', 'top', 'M'), garment('cd4cac0fe79ca49560e69cd1', 'Đen', 'bottom', 'M')] },
  { id: 7, sourceIndex: 7, label: 'Giữ nền nam 01 - sơ mi be, quần đen, giày trắng', preset: 'none', garments: [garment('9905aed6b4eecaaee1820d55', 'Be sáng', 'top', 'M'), garment('bc492e32ec672b0d1f935789', 'Đen', 'bottom', '31'), garment('ecc96b7d12b9ee473fea88f5', 'Trắng.', 'shoes', '41')] },
  { id: 8, sourceIndex: 8, label: 'Giữ nền nam 02 - thể thao cam đen', preset: 'none', garments: [garment('d2cb577f0f884de0117b3668', 'Cam', 'top', 'L'), garment('34f5c75b2394beb83245f8c1', 'Đen', 'bottom', 'L'), garment('ecc96b7d12b9ee473fea88f5', 'Đen', 'shoes', '41')] },
  { id: 9, sourceIndex: 9, label: 'Giữ nền nam 03 - polo navy', preset: 'none', garments: [garment('84d44f8e5a90390663e497b3', 'Navy', 'top', 'M')] },
  { id: 10, sourceIndex: 10, label: 'Giữ nền nam 04 - len navy, quần ghi, giày trắng', preset: 'none', garments: [garment('e9f86f8c63e8bc17b63394e8', 'Navy', 'top', 'M'), garment('bc492e32ec672b0d1f935789', 'Ghi', 'bottom', '31'), garment('ecc96b7d12b9ee473fea88f5', 'Trắng.', 'shoes', '41')] },
  { id: 11, sourceIndex: 11, label: 'Giữ nền ảnh hai nam - polo trắng shop', preset: 'none', garments: [garment('c543e525a21574f6bd95e8c1', 'Trắng', 'top', 'M')] },
  { id: 12, sourceIndex: 12, label: 'Giữ nền nam 06 - sơ mi nhung be', preset: 'none', garments: [garment('0400035ff551fd22c8553ce2', 'Be sáng', 'top', 'M')] },
  { id: 13, sourceIndex: 13, label: 'Giữ nền nam 07 - len sọc, quần đen, loafer', preset: 'none', garments: [garment('5592c2bf129a66e947360c6e', 'Đen kẻ trắng', 'top', 'M'), garment('bc492e32ec672b0d1f935789', 'Đen', 'bottom', '31'), garment('4161b1e8dea1c1a0b51e8701', 'Đen', 'shoes', '41')] },
  { id: 14, sourceIndex: 14, label: 'Giữ nền nam 08 - polo đen', preset: 'none', garments: [garment('002b74340f878eb87e4ae306', 'Đen', 'top', 'M')] },
  { id: 15, sourceIndex: 1, label: 'Sáng tạo nữ 01 - showroom dệt may', preset: 'custom', scene: 'a refined contemporary textile showroom with soft window light, clean architectural lines, and natural editorial depth', garments: [garment('b33b4457d177bfc9f2617daf', 'Navy', 'top', 'S'), garment('e38db686365335c332f36264', 'Nâu', 'bottom', 'S')], makeVideo: true },
  { id: 16, sourceIndex: 2, label: 'Sáng tạo nữ 02 - phố văn hóa blue hour', preset: 'custom', scene: 'an open cultural pedestrian plaza at blue hour with soft lantern light, spacious background, and lively but unobtrusive atmosphere', garments: [garment('1484171a0ca7ff7ff92f8916', 'Trắng in xanh', 'top', 'S'), garment('2f5fa044af449c0a22678290', 'Nâu nhạt', 'bottom', 'S')], makeVideo: true },
  { id: 17, sourceIndex: 3, label: 'Sáng tạo nữ 03 - gallery đại học', preset: 'custom', scene: 'a minimalist university art gallery with pale stone walls, diffused daylight, and a calm contemporary mood', garments: [garment('6b72b7d33f9b8307c4a958eb', 'Navy', 'top', 'M')] },
  { id: 18, sourceIndex: 4, label: 'Sáng tạo nữ 04 - thư viện nghệ thuật', preset: 'custom', scene: 'a warm art-library reading lounge with walnut shelves, soft practical lamps, and gentle cinematic depth', garments: [garment('76fe4f7aa5634a3ae8c50aa5', 'Đen', 'top', 'S')], makeVideo: true },
  { id: 19, sourceIndex: 5, label: 'Sáng tạo nữ 05 - studio daylight', preset: 'custom', scene: 'a clean daylight vanity studio with warm neutral walls, soft reflected light, and a natural lifestyle campaign feeling', garments: [garment('32736048dd640fb65fb85672', 'Trắng Kẻ Cam', 'top', 'M')], makeVideo: true },
  { id: 20, sourceIndex: 6, label: 'Sáng tạo nữ 06 - cyclorama cao cấp', preset: 'custom', scene: 'a premium white cyclorama studio with subtle gradient lighting, restrained shadows, and polished ecommerce editorial styling', garments: [garment('e1416f27eac0557c580933b5', 'Xanh', 'top', 'S'), garment('8e259df3bc1a520b6bdd93f9', 'Tím than', 'bottom', 'S')], makeVideo: true },
  { id: 21, sourceIndex: 7, label: 'Sáng tạo nam 01 - café golden hour', preset: 'custom', scene: 'a contemporary sidewalk cafe during golden hour with soft tree shadows, warm reflections, and uncluttered editorial composition', garments: [garment('8047a82a85d7078038eed86d', 'Xanh 1', 'top', 'M'), garment('625c119dad5281c2d5eb5dc6', 'Vàng', 'bottom', '31'), garment('4161b1e8dea1c1a0b51e8701', 'Nâu', 'shoes', '41')], makeVideo: true },
  { id: 22, sourceIndex: 8, label: 'Sáng tạo nam 02 - stadium tunnel', preset: 'custom', scene: 'a modern stadium tunnel opening toward a softly lit football pitch at dawn, crisp atmosphere, and realistic sports campaign lighting', garments: [garment('8bc2541158e2e3bfa15fb279', 'Đỏ kẻ trắng', 'top', 'L'), garment('34f5c75b2394beb83245f8c1', 'Ghi Đậm', 'bottom', 'L'), garment('ecc96b7d12b9ee473fea88f5', 'Trắng.', 'shoes', '41')], makeVideo: true },
  { id: 23, sourceIndex: 9, label: 'Sáng tạo nam 03 - hành lang tốt nghiệp', preset: 'custom', scene: 'a modern university graduation corridor with glass walls, balanced daylight, shallow depth, and a confident professional mood', garments: [garment('9905aed6b4eecaaee1820d55', 'Nâu', 'top', 'M')] },
  { id: 24, sourceIndex: 10, label: 'Sáng tạo nam 04 - sân di sản Việt', preset: 'custom', scene: 'an elegant Vietnamese heritage courtyard in warm early-morning light with brick textures, greenery, and cinematic but natural depth', garments: [garment('39d480990e008c1644c53637', 'TRẮNG KẺ NÂU', 'top', 'M'), garment('76408a59f1605a5a4c5f9dd6', 'Xám', 'bottom', '31'), garment('ecc96b7d12b9ee473fea88f5', 'Đen', 'shoes', '41')], makeVideo: true },
  { id: 25, sourceIndex: 11, label: 'Sáng tạo ảnh hai nam - café kiến trúc', preset: 'custom', scene: 'a contemporary cafe with warm architectural lighting, clean table styling, and a relaxed best-friends fashion campaign atmosphere', garments: [garment('e9f86f8c63e8bc17b63394e8', 'Đen', 'top', 'M')], makeVideo: true },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const timestamp = (value?: Date | null) => value ? value.getTime() : undefined;

const getOutfitMode = (items: ResolvedGarment[]): VirtualTryOnOutfitMode => {
  if (items.length === 1) return 'single';
  return items.length === 2 ? 'top_bottom' : 'full_set';
};

const resolveGarments = async (requests: GarmentRequest[]): Promise<ResolvedGarment[]> => {
  const products = await Product.find({
    _id: { $in: requests.map((item) => item.productId) },
    isActive: true,
  });
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  return requests.map((request) => {
    const product = productMap.get(request.productId);
    if (!product) throw new Error(`Không tìm thấy sản phẩm shop ${request.productId}`);
    const variant = product.variant.find((item: IProductVariant) => item.isActive);
    if (!variant) throw new Error(`Sản phẩm ${product.name} không có variant hoạt động`);
    const color = variant.colors.find((item: IColorVariant) => item.color === request.color);
    if (!color) throw new Error(`Sản phẩm ${product.name} không có màu ${request.color}`);
    const availableSizes = variant.sizeMeasurements.map((item: IProductSizeMeasurement) => item.size);
    const size = request.size && availableSizes.includes(request.size)
      ? request.size
      : availableSizes[0];

    return {
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      colorVariantId: color._id.toString(),
      size,
      role: request.role,
      name: product.name,
      color: color.color,
      image: color.image,
    };
  });
};

const saveTimings = async (timings: Timing[]) => {
  await mkdir(outputRoot, { recursive: true });
  await writeFile(
    path.join(outputRoot, 'timing.json'),
    JSON.stringify({ updatedAt: new Date().toISOString(), batchKey, runs: timings }, null, 2),
  );
  const fields: Array<keyof Timing> = [
    'runId', 'label', 'sourceIndex', 'preserveBackground', 'makeVideo', 'state',
    'jobId', 'createdAt', 'startedAt', 'imageReadyAt', 'videoStartedAt', 'completedAt',
    'queueMs', 'imageStageMs', 'videoStageMs', 'totalMs', 'imageCount', 'videoUrl', 'error',
  ];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [
    fields.join(','),
    ...timings.map((item) => fields.map((field) => escape(item[field])).join(',')),
  ].join('\n');
  await writeFile(path.join(outputRoot, 'timing.csv'), `${csv}\n`);
};

const findSourceAsset = async (userId: string, sourceIndex: number) => {
  const publicId = `fashion-ecommerce/virtual-try-on/users/${userId}/source/${previousSourceBatchKey}-source-${sourceIndex}`;
  const asset = await VirtualTryOnAsset.findOne({ userId, publicId, status: 'active' });
  if (!asset) throw new Error(`Thiếu source asset ${sourceIndex} trong tài khoản mobile`);
  return asset;
};

const setTimingFromJob = (timing: Timing, job: InstanceType<typeof VirtualTryOnJob>) => {
  const createdMs = timestamp(job.createdAt);
  const startedMs = timestamp(job.startedAt);
  const videoStartedMs = timestamp(job.videoStartedAt);
  const completedMs = timestamp(job.completedAt);
  const imageUrls = [...new Set([...(job.generatedImageUrls || []), job.generatedImageUrl]
    .filter((url): url is string => Boolean(url)))];

  timing.jobId = job._id.toString();
  timing.state = job.status === 'failed' || job.status === 'canceled'
    ? 'failed'
    : job.status === 'succeeded'
      ? 'complete'
      : job.status;
  timing.createdAt = job.createdAt?.toISOString();
  timing.startedAt = job.startedAt?.toISOString();
  timing.completedAt = job.completedAt?.toISOString();
  if (createdMs && startedMs) timing.queueMs = startedMs - createdMs;
  if (imageUrls.length && !timing.imageReadyAt) timing.imageReadyAt = new Date().toISOString();
  const imageReadyMs = timing.imageReadyAt ? Date.parse(timing.imageReadyAt) : undefined;
  if (startedMs && imageReadyMs) timing.imageStageMs = imageReadyMs - startedMs;
  timing.videoStartedAt = job.videoStartedAt?.toISOString();
  if (videoStartedMs && completedMs) timing.videoStageMs = completedMs - videoStartedMs;
  if (createdMs && completedMs) timing.totalMs = completedMs - createdMs;
  timing.imageUrls = imageUrls;
  timing.imageCount = imageUrls.length;
  timing.videoUrl = job.generatedVideoUrl || undefined;
  timing.error = job.errorMessage || job.videoErrorMessage || undefined;
};

const downloadResultMedia = async (runId: number, job: InstanceType<typeof VirtualTryOnJob>) => {
  const runDir = path.join(outputRoot, `run-${String(runId).padStart(2, '0')}`);
  await mkdir(runDir, { recursive: true });
  const imageUrls = [...new Set([...(job.generatedImageUrls || []), job.generatedImageUrl]
    .filter((url): url is string => Boolean(url)))];

  for (const [index, url] of imageUrls.entries()) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Không tải được ảnh kết quả ${index + 1}`);
    await writeFile(path.join(runDir, `image-${index + 1}.png`), Buffer.from(await response.arrayBuffer()));
  }
  if (job.generatedVideoUrl) {
    const response = await fetch(job.generatedVideoUrl);
    if (!response.ok) throw new Error('Không tải được video kết quả');
    await writeFile(path.join(runDir, 'video.mp4'), Buffer.from(await response.arrayBuffer()));
  }
  await writeFile(path.join(runDir, 'job.json'), JSON.stringify(job.toObject(), null, 2));
};

const waitForJob = async (jobId: string, timing: Timing, timings: Timing[]) => {
  const started = Date.now();
  let lastStage = '';
  while (Date.now() - started < jobTimeoutMs) {
    const job = await VirtualTryOnJob.findById(jobId);
    if (!job) throw new Error(`Không tìm thấy job ${jobId}`);
    setTimingFromJob(timing, job);
    const stage = `${job.status}/${job.processingStage}/${job.progress}/${job.videoStatus}/${job.videoProgress}`;
    if (stage !== lastStage) {
      lastStage = stage;
      console.log(`RUN_STAGE run=${timing.runId} job=${jobId} ${stage}`);
      await saveTimings(timings);
    }
    if (['succeeded', 'failed', 'canceled'].includes(job.status)) return job;
    await delay(pollIntervalMs);
  }
  throw new Error(`Job ${jobId} quá ${Math.round(jobTimeoutMs / 60_000)} phút`);
};

const processRun = async (
  run: CampaignRun,
  timing: Timing,
  timings: Timing[],
  userId: string,
  virtualTryOnService: typeof import('../modules/virtual-try-on/virtual-try-on.service').virtualTryOnService,
) => {
  const resolvedGarments = await resolveGarments(run.garments);
  timing.garments = resolvedGarments.map((item) => ({
    name: item.name,
    color: item.color,
    role: item.role,
    image: item.image,
  }));
  const idempotencyKey = `${batchKey}-run-${run.id}`;
  let existing = await VirtualTryOnJob.findOne({ userId, idempotencyKey, deletedAt: null });
  if (existing?.status === 'failed') {
    await virtualTryOnService.retryJob(userId, existing._id.toString());
    existing = await VirtualTryOnJob.findById(existing._id);
  }

  let jobId = existing?._id.toString();
  if (!jobId) {
    const sourceAsset = await findSourceAsset(userId, run.sourceIndex);
    const created = await virtualTryOnService.createJob(
      userId,
      {
        sourceAssetId: sourceAsset._id.toString(),
        outfitMode: getOutfitMode(resolvedGarments),
        selectedItems: resolvedGarments.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          colorVariantId: item.colorVariantId,
          size: item.size,
          role: item.role,
        })),
        contextPreset: run.preset,
        contextPrompt: run.scene,
        outputMode: run.makeVideo ? 'image_and_video' : 'image',
        videoDurationSeconds: run.makeVideo ? 5 : undefined,
      },
      idempotencyKey,
    );
    jobId = created._id;
  }

  timing.state = 'queued';
  timing.jobId = jobId;
  await saveTimings(timings);
  const completed = await waitForJob(jobId, timing, timings);
  if (completed.status !== 'succeeded') {
    throw new Error(completed.errorMessage || completed.videoErrorMessage || `Job ${jobId} thất bại`);
  }
  await downloadResultMedia(run.id, completed);
  setTimingFromJob(timing, completed);
  timing.state = 'complete';
  await saveTimings(timings);
  console.log(`RUN_COMPLETE ${run.id}/25 job=${jobId} images=${timing.imageCount || 0} video=${Boolean(timing.videoUrl)}`);
};

const main = async () => {
  const identifier = process.env.MOBILE_USER_IDENTIFIER?.trim();
  const password = process.env.MOBILE_USER_PASSWORD;
  if (!identifier || !password) throw new Error('MOBILE_USER_IDENTIFIER và MOBILE_USER_PASSWORD là bắt buộc');
  await mkdir(outputRoot, { recursive: true });
  await connectDB();

  const user = await User.findOne({
    $or: [{ phone: identifier }, { email: identifier.toLowerCase() }],
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error('Tài khoản mobile hoặc mật khẩu không đúng');
  }
  if (user.role !== 'user') throw new Error('Tài khoản cung cấp không phải mobile user');
  const userId = user._id.toString();
  console.log(`AUTH_OK user=${userId}`);

  if (process.env.CAMPAIGN_PREFLIGHT === 'true') {
    const resolved = await Promise.all(runs.map(async (run) => ({
      run,
      garments: await resolveGarments(run.garments),
      sourceAsset: await findSourceAsset(userId, run.sourceIndex),
    })));
    console.log(`PREFLIGHT_OK runs=${resolved.length} videos=${resolved.filter((item) => item.run.makeVideo).length} uniqueSources=${new Set(resolved.map((item) => item.sourceAsset._id.toString())).size}`);
    for (const item of resolved) {
      console.log(`PREFLIGHT_RUN ${item.run.id} source=${item.run.sourceIndex} background=${item.run.preset === 'none' ? 'preserve' : 'creative'} garments=${item.garments.map((garmentItem) => `${garmentItem.role}:${garmentItem.name}:${garmentItem.color}`).join(' | ')}`);
    }
    return;
  }

  const { virtualTryOnService } = await import('../modules/virtual-try-on/virtual-try-on.service');
  const timings: Timing[] = runs.map((run) => ({
    runId: run.id,
    label: run.label,
    sourceIndex: run.sourceIndex,
    preserveBackground: run.preset === 'none',
    makeVideo: Boolean(run.makeVideo),
    state: 'pending',
  }));
  await saveTimings(timings);

  let cursor = 0;
  const worker = async () => {
    while (cursor < runs.length) {
      const index = cursor++;
      try {
        await processRun(runs[index], timings[index], timings, userId, virtualTryOnService);
      } catch (error) {
        timings[index].state = 'failed';
        timings[index].error = error instanceof Error ? error.message : String(error);
        console.error(`RUN_FAILED run=${runs[index].id} ${timings[index].error}`);
        await saveTimings(timings);
      }
    }
  };

  await Promise.all([worker(), worker()]);
  const complete = timings.filter((item) => item.state === 'complete').length;
  const videos = timings.filter((item) => item.videoUrl).length;
  const images = timings.reduce((total, item) => total + (item.imageCount || 0), 0);
  console.log(`SUMMARY runs=${complete}/25 images=${images} videos=${videos}/9 failed=${timings.filter((item) => item.state === 'failed').length}`);
};

const keepAlive = setInterval(() => undefined, 1_000);
void main().finally(async () => {
  clearInterval(keepAlive);
  await mongoose.disconnect().catch(() => undefined);
});
