import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { env } from './env.js';
import logger from './logger.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
};

const uploadOnCloudinary = async (
  fileBuffer: Buffer,
  options: { folder?: string; resource_type?: 'auto' | 'video' | 'image' | 'raw' } = {},
): Promise<CloudinaryUploadResult | null> => {
  const { folder = 'superior_trends', resource_type = 'auto' } = options;

  if (!fileBuffer?.length) {
    logger.error('Cloudinary Upload Error: File buffer is empty');
    return null;
  }

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type },
      (error, result) => {
        if (error) {
          logger.error(`Cloudinary Upload Error: ${error.message}`);
          return resolve(null);
        }
        if (result?.secure_url) {
          return resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
        return resolve(null);
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

export { uploadOnCloudinary, cloudinary };
