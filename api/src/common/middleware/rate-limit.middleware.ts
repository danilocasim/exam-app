import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RateLimit');
  private readonly store = new Map<string, RateLimitEntry>();

  /** Max requests per window */
  private readonly maxRequests = 100;

  /** Window duration in milliseconds (1 minute) */
  private readonly windowMs = 60 * 1000;

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const ip = req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = this.store.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.store.set(ip, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, this.maxRequests - entry.count)),
    );
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > this.maxRequests) {
      this.logger.warn(`Rate limit exceeded for ${ip}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Periodic cleanup of expired entries
    if (this.store.size > 10000) {
      for (const [key, val] of this.store.entries()) {
        if (now > val.resetAt) {
          this.store.delete(key);
        }
      }
    }

    next();
  }
}
