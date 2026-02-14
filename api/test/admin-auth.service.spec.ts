import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminAuthService } from '../../src/admin/auth/admin-auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.mock('bcrypt');

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: PrismaService,
          useValue: {
            admin: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  describe('login (T076)', () => {
    it('should return JWT token on successful login (FR-023)', async () => {
      const email = 'admin@example.com';
      const password = 'password123';
      const passwordHash = await bcrypt.hash(password, 10);

      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        email,
        passwordHash,
        name: 'Admin User',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = await service.login(email, password);

      expect(result.token).toBe('mock-jwt-token');
      expect(result.admin).toEqual({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'admin-123',
        email: 'admin@example.com',
      });
    });

    it('should throw UnauthorizedException for non-existent admin', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login('nonexistent@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const email = 'admin@example.com';

      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        email,
        passwordHash: 'somehash',
        name: 'Admin User',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(email, 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include correct payload in JWT token', async () => {
      const email = 'admin@example.com';

      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-456',
        email,
        passwordHash: 'somehash',
        name: 'Admin User',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('token');

      await service.login(email, 'password');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'admin-456',
        email: 'admin@example.com',
      });
    });
  });

  describe('validateAdmin', () => {
    it('should return admin user if found', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
      });

      const result = await service.validateAdmin('admin-123');

      expect(result).toEqual({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
      });
    });

    it('should return null if admin not found', async () => {
      (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateAdmin('nonexistent');

      expect(result).toBeNull();
    });
  });
});
