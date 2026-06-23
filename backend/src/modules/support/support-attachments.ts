import type { ISupportAttachment } from '../../database/models';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.util';

export const uploadSupportAttachments = async (
  files: Express.Multer.File[] = [],
): Promise<ISupportAttachment[]> => {
  const uploaded: ISupportAttachment[] = [];

  try {
    for (const file of files) {
      const result = await uploadToCloudinary(file.buffer, file.originalname, 'fashion-ecommerce/support');
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        mimeType: file.mimetype as ISupportAttachment['mimeType'],
        size: file.size,
      });
    }
    return uploaded;
  } catch (error) {
    await cleanupSupportAttachments(uploaded);
    throw error;
  }
};

export const cleanupSupportAttachments = async (attachments: ISupportAttachment[]) => {
  await Promise.allSettled(attachments.map((attachment) => deleteFromCloudinary(attachment.publicId)));
};
