import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import {
  type IVirtualTryOnAsset,
  VirtualTryOnAsset,
  type VirtualTryOnAssetType,
} from '../database/models/virtual-try-on-asset.model';
import {
  applyImageValidationBasePolicy,
  createImageValidationProvider,
  getConfiguredImageValidationProviderName,
  getImageValidationReasonMessage,
  isImageValidationFailOpen,
  isImageValidationReasonCode,
  type ImageValidationInput,
  type ImageValidationReasonCode,
  type ImageValidationResult,
} from '../modules/virtual-try-on/image-validation';

dotenv.config();

const IMAGE_DOWNLOAD_TIMEOUT_MS = 15_000;
const sourceAssetTypes: readonly VirtualTryOnAssetType[] = ['source_upload', 'source_camera'];

type BackfillOptions = {
  dryRun: boolean;
  force: boolean;
  limit?: number;
};

type StoredValidationWarning = {
  reasonCode: ImageValidationReasonCode;
  message: string;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

const getNumberArg = (name: string) => {
  const prefix = `--${name}=`;
  const rawValue = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : undefined;
};

const getImageValidationSource = (asset: IVirtualTryOnAsset): ImageValidationInput['source'] =>
  asset.source === 'camera' ? 'camera' : 'upload';

const downloadImageValidationBuffer = async (asset: IVirtualTryOnAsset) => {
  const response = await axios.get<ArrayBuffer>(asset.url, {
    responseType: 'arraybuffer',
    timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
  });

  const responseMimeType = String(response.headers['content-type'] || '').split(';')[0].trim();
  const buffer = Buffer.from(response.data);

  return {
    buffer,
    mimeType: asset.mimeType || responseMimeType || 'image/jpeg',
    bytes: asset.bytes ?? buffer.byteLength,
  };
};

const validateAsset = async (asset: IVirtualTryOnAsset) => {
  const providerName = getConfiguredImageValidationProviderName();
  if (providerName === 'disabled') return null;

  const { buffer, mimeType, bytes } = await downloadImageValidationBuffer(asset);
  const input: ImageValidationInput = {
    imageBuffer: buffer,
    mimeType,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    bytes,
    source: getImageValidationSource(asset),
  };

  try {
    const provider = createImageValidationProvider(providerName);
    const personScoreThreshold = Number(process.env.IMAGE_VALIDATION_PERSON_SCORE_THRESHOLD);
    return applyImageValidationBasePolicy(
      await provider.validate(input),
      Number.isFinite(personScoreThreshold) ? personScoreThreshold : 0.5,
    );
  } catch (error) {
    if (isImageValidationFailOpen()) {
      console.warn('Image validation failed open, clearing warning for asset:', asset._id.toString(), error);
      return null;
    }

    throw error;
  }
};

const getStoredValidationWarning = (result: ImageValidationResult | null): StoredValidationWarning | null => {
  if (!result || result.allowed) return null;

  const reasonCode: ImageValidationReasonCode = isImageValidationReasonCode(result.reasonCode)
    ? result.reasonCode
    : 'NO_PERSON_DETECTED';

  return {
    reasonCode,
    message: result.message || getImageValidationReasonMessage(reasonCode),
  };
};

const buildQuery = (options: BackfillOptions): Record<string, unknown> => ({
  type: { $in: sourceAssetTypes },
  status: 'active',
  ...(options.force ? {} : { validationCheckedAt: null }),
});

const backfillVirtualTryOnAssets = async (options: BackfillOptions) => {
  const query = buildQuery(options);
  const total = await VirtualTryOnAsset.countDocuments(query);
  const cursor = VirtualTryOnAsset.find(query)
    .sort({ createdAt: 1 })
    .limit(options.limit ?? 0)
    .cursor();

  const summary = {
    totalMatched: total,
    scanned: 0,
    updated: 0,
    warned: 0,
    cleared: 0,
    failed: 0,
    dryRun: options.dryRun,
    force: options.force,
    limit: options.limit ?? null,
  };

  for await (const asset of cursor) {
    summary.scanned += 1;

    try {
      const result = await validateAsset(asset);
      const warning = getStoredValidationWarning(result);

      if (warning) summary.warned += 1;
      else summary.cleared += 1;

      if (!options.dryRun) {
        asset.set('validationWarning', warning ?? undefined);
        asset.set('validationCheckedAt', new Date());
        await asset.save();
        summary.updated += 1;
      }

      console.log(JSON.stringify({
        assetId: asset._id.toString(),
        warning: warning?.reasonCode ?? null,
        dryRun: options.dryRun,
      }));
    } catch (error) {
      summary.failed += 1;
      console.error('Virtual try-on asset validation failed:', {
        assetId: asset._id.toString(),
        error,
      });
    }
  }

  return summary;
};

const run = async () => {
  await connectDB();

  const result = await backfillVirtualTryOnAssets({
    dryRun: hasFlag('--dry-run'),
    force: hasFlag('--force'),
    limit: getNumberArg('limit'),
  });

  console.log(JSON.stringify(result, null, 2));
};

run()
  .catch((error) => {
    console.error('Virtual try-on asset backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
