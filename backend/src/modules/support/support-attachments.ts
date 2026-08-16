import type { ISupportAttachment } from '../../database/models';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.util';

export const uploadSupportAttachments = async (
  files: Express.Multer.File[] = [],
): Promise<ISupportAttachment[]> => {
  const results = await Promise.allSettled(files.map(async (file) => {
    const result = await uploadToCloudinary(file.buffer, file.originalname, 'fashion-ecommerce/support');
    return {
      url: result.secure_url,
      publicId: result.public_id,
      mimeType: file.mimetype as ISupportAttachment['mimeType'],
      size: file.size,
    };
  }));
  const uploaded = results
    .filter((result): result is PromiseFulfilledResult<ISupportAttachment> => result.status === 'fulfilled')
    .map((result) => result.value);
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

  if (failed) {
    await cleanupSupportAttachments(uploaded);
    throw failed.reason;
  }

  return uploaded;
};

export const cleanupSupportAttachments = async (attachments: ISupportAttachment[]) => {
  await Promise.allSettled(attachments.map((attachment) => deleteFromCloudinary(attachment.publicId)));
};
