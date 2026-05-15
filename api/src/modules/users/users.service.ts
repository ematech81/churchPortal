import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '@/types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findByPhone(phone: string) {
    return this.repo.findOne({ where: { phone } });
  }

  async clearOtp(userId: string) {
    await this.repo.update(userId, { otpCode: null as any, otpExpiresAt: null as any });
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  async setRefreshToken(userId: string, hash: string) {
    await this.repo.update(userId, { refreshTokenHash: hash });
  }

  async clearRefreshToken(userId: string) {
    await this.repo.update(userId, { refreshTokenHash: null });
  }

  async update(userId: string, data: Partial<User>) {
    await this.repo.update(userId, data);
    return this.findById(userId);
  }

  async setOtp(userId: string, code: string, expiresAt: Date) {
    await this.repo.update(userId, { otpCode: code, otpExpiresAt: expiresAt });
  }

  async setEmailVerified(userId: string) {
    await this.repo.update(userId, { isEmailVerified: true, otpCode: null, otpExpiresAt: null });
  }

  async setChurchAndRole(userId: string, churchId: string, role: UserRole) {
    await this.repo.update(userId, { churchId, role });
  }
}
