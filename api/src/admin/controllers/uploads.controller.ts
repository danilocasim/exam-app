import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { S3Service } from '../services/s3.service';
import * as path from 'path';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Upload an explanation image to S3
   * POST /admin/uploads/explanation-image
   * Multipart form with field name "file"
   */
  @Post('explanation-image')
  async uploadExplanationImage(
    @Req() req: FastifyRequest,
  ): Promise<{ url: string; filename: string }> {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${data.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validate extension
    const ext = path.extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // Read the file buffer
    const buffer = await data.toBuffer();

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Max: 2MB`,
      );
    }

    // Upload to S3
    try {
      return await this.s3Service.uploadExplanationImage(
        buffer,
        ext,
        data.mimetype,
      );
    } catch (err) {
      this.logger.error(`S3 upload failed: ${err}`);
      throw new BadRequestException('Image upload failed. Please try again.');
    }
  }

  /**
   * Delete an explanation image from S3
   * DELETE /admin/uploads/explanation-image/:filename
   */
  @Delete('explanation-image/:filename')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExplanationImage(
    @Param('filename') filename: string,
  ): Promise<void> {
    // Validate filename format to prevent path traversal
    if (!filename || /[\/\\]/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    try {
      await this.s3Service.deleteExplanationImage(filename);
    } catch (err) {
      this.logger.error(`S3 delete failed for ${filename}: ${err}`);
      throw new BadRequestException('Image deletion failed. Please try again.');
    }
  }
}
