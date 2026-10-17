import { v2 as cloudinary } from 'cloudinary';

import { env } from './env.js';

/**
 * Configures the Cloudinary SDK using validated environment variables.
 */
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export { cloudinary };
