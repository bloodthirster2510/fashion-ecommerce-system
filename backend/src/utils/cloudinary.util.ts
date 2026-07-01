import cloudinary from '../integrations/cloudinary/cloudinary';

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export type CloudinaryResourceType = 'image' | 'video';

//Upload file to Cloudinary from buffer (multer memory storage)
export const uploadToCloudinary = async (
  buffer: Buffer,
  fileName: string,
  folder: string = 'fashion-ecommerce',
  resourceType: CloudinaryResourceType = 'image',
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        public_id: `${Date.now()}-${fileName.replace(/\.[^.]+$/, '')}`,
        overwrite: true,
        ...(resourceType === 'image' ? { quality: 'auto', fetch_format: 'auto' } : {}),
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            url: result.url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error('Cloudinary upload failed: No result returned'));
        }
      },
    );

    stream.end(buffer);
  });
};


//Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw new Error(`Failed to delete from Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};


//Extract public_id from secure_url
export const extractPublicIdFromUrl = (url: string): string => {
  const uploadSegment = '/upload/';
  const uploadIndex = url.indexOf(uploadSegment);

  if (uploadIndex === -1) {
    const fallbackFile = url.split('/').pop() ?? url;
    return fallbackFile.replace(/\.[^.]+$/, '');
  }

  const pathAfterUpload = url.slice(uploadIndex + uploadSegment.length);
  const pathWithoutVersion = pathAfterUpload.replace(/^v\d+\//, '');

  return decodeURIComponent(pathWithoutVersion).replace(/\.[^.]+$/, '');
};
