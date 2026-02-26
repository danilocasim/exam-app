import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  readonly bucket: string;
  readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('s3.region') || 'us-east-1';
    this.bucket =
      this.configService.get<string>('s3.bucket') || 'dojo-exam-explanations';

    const accessKeyId = this.configService.get<string>('s3.accessKeyId');
    const secretAccessKey =
      this.configService.get<string>('s3.secretAccessKey');

    this.s3 = new S3Client({
      region: this.region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });

    this.logger.log(
      `S3 service configured: bucket=${this.bucket}, region=${this.region}`,
    );
  }

  /**
   * Upload a file to S3 under the explanations/ prefix.
   * Returns the public URL and filename.
   */
  async uploadExplanationImage(
    buffer: Buffer,
    ext: string,
    contentType: string,
  ): Promise<{ url: string; filename: string }> {
    const hash = crypto
      .createHash('md5')
      .update(buffer)
      .digest('hex')
      .slice(0, 12);
    const timestamp = Date.now();
    const filename = `${timestamp}-${hash}${ext}`;
    const key = `explanations/${filename}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    this.logger.log(
      `Image uploaded to S3: ${key} (${(buffer.length / 1024).toFixed(1)}KB)`,
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return { url, filename };
  }

  /**
   * Delete a single explanation image from S3 by filename.
   */
  async deleteExplanationImage(filename: string): Promise<void> {
    const key = `explanations/${filename}`;
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Image deleted from S3: ${key}`);
    } catch (err) {
      this.logger.error(`Failed to delete S3 object ${key}: ${err}`);
      throw err;
    }
  }

  /**
   * Delete multiple explanation images from S3 in a single batch request.
   * Silently skips any that don't exist.
   */
  async deleteExplanationImages(filenames: string[]): Promise<void> {
    if (filenames.length === 0) return;

    const objects = filenames.map((f) => ({ Key: `explanations/${f}` }));

    try {
      const result = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );

      if (result.Errors && result.Errors.length > 0) {
        this.logger.warn(
          `Some S3 deletes failed: ${JSON.stringify(result.Errors)}`,
        );
      }

      this.logger.log(
        `Batch deleted ${filenames.length} image(s) from S3: ${filenames.join(', ')}`,
      );
    } catch (err) {
      this.logger.error(`Batch S3 delete failed: ${err}`);
      // Don't throw — image cleanup is best-effort, shouldn't block the question update
    }
  }

  /**
   * Extract S3 filenames from explanation blocks that belong to our bucket.
   * Returns only filenames (not full URLs) for images hosted on our S3 bucket.
   */
  extractS3Filenames(blocks: any[] | null | undefined): string[] {
    if (!blocks || !Array.isArray(blocks)) return [];

    const prefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/explanations/`;
    const filenames: string[] = [];

    for (const block of blocks) {
      if (block.type === 'image' && typeof block.content === 'string') {
        if (block.content.startsWith(prefix)) {
          const filename = block.content.slice(prefix.length);
          if (filename) filenames.push(filename);
        }
      }
    }

    return filenames;
  }
}
