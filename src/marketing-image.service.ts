import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

@Injectable()
export class MarketingImageService {
  private credentials(): CloudinaryCredentials {
    const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Image uploads are not configured for this API.');
    }
    return { cloudName, apiKey, apiSecret };
  }

  private signature(params: Record<string, string>, secret: string): string {
    const signed = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(signed + secret).digest('hex');
  }

  async upload(buffer: Buffer, mimeType: string, agencyId: string) {
    const credentials = this.credentials();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = `contentflow/marketing-performance/${agencyId}/${randomUUID()}`;
    const params = { public_id: publicId, timestamp };
    const body = new FormData();
    const bytes = new Uint8Array(buffer);
    body.append('file', new Blob([bytes.buffer], { type: mimeType }), 'ad-creative');
    body.append('api_key', credentials.apiKey);
    body.append('public_id', publicId);
    body.append('timestamp', timestamp);
    body.append('signature', this.signature(params, credentials.apiSecret));

    let response: Response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`, {
        method: 'POST',
        body,
      });
    } catch {
      throw new ServiceUnavailableException('Image storage could not be reached.');
    }

    const result = await response.json().catch(() => ({})) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    };
    if (!response.ok || !result.secure_url || !result.public_id) {
      // Cloudinary's error text helps distinguish bad credentials/signatures from
      // account limits and unsupported uploads. Keep it short and strip controls.
      const detail = result.error?.message?.replace(/[\r\n\t]/g, ' ').slice(0, 240);
      throw new ServiceUnavailableException(
        detail
          ? `Image storage rejected the upload: ${detail}`
          : `Image storage rejected the upload (HTTP ${response.status}). Check the local Cloudinary settings.`,
      );
    }

    return { imageUrl: result.secure_url, imagePublicId: result.public_id };
  }

  async delete(publicId: string): Promise<void> {
    const credentials = this.credentials();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = { public_id: publicId, timestamp };
    const body = new FormData();
    body.append('api_key', credentials.apiKey);
    body.append('public_id', publicId);
    body.append('timestamp', timestamp);
    body.append('signature', this.signature(params, credentials.apiSecret));

    let response: Response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/destroy`, {
        method: 'POST',
        body,
      });
    } catch {
      throw new ServiceUnavailableException('Image storage could not be reached to remove the creative.');
    }
    if (!response.ok) throw new ServiceUnavailableException('Image storage could not remove the creative.');
  }
}
