import type { IReviewImage } from '../../database/models';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.util';

const toThumbnailUrl = (url: string) =>
  url.replace('/upload/', '/upload/c_fill,w_320,h_320,q_auto,f_auto/');

export const uploadReviewImages = async (
  reviewId: string,
  files: Express.Multer.File[] = [],
): Promise<Array<Omit<IReviewImage, '_id'>>> => {
  const uploaded: Array<Omit<IReviewImage, '_id'>> = [];
  try {
    for (const file of files) {
      const result = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        `fashion-ecommerce/reviews/${reviewId}`,
      );
      uploaded.push({
        url: result.secure_url,
        thumbnailUrl: toThumbnailUrl(result.secure_url),
        publicId: result.public_id,
        mimeType: file.mimetype as IReviewImage['mimeType'],
        size: result.bytes || file.size,
        width: result.width || null,
        height: result.height || null,
      });
    }
    return uploaded;
  } catch (error) {
    await cleanupReviewImages(uploaded);
    throw error;
  }
};

export const cleanupReviewImages = async (
  images: Array<Pick<IReviewImage, 'publicId'>> = [],
) => {
  await Promise.allSettled(images
    .filter((image) => Boolean(image.publicId))
    .map((image) => deleteFromCloudinary(image.publicId!)));
};
