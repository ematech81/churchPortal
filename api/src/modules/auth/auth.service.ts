import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { UserRole } from '@/types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({ ...dto, passwordHash });

    await this._dispatchOtp(user.id, user.email);

    return {
      message: 'A 6-digit verification code has been sent to your email.',
      email: user.email,
      userId: user.id,
    };
  }

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('No account found with that email');
    if (user.isEmailVerified) throw new BadRequestException('Email is already verified');

    // Rate-limit: 1 resend per 60 seconds
    if (user.otpExpiresAt && user.otpExpiresAt.getTime() - Date.now() > 9 * 60 * 1000) {
      throw new BadRequestException('Please wait 60 seconds before requesting a new code');
    }

    await this._dispatchOtp(user.id, email);
    return { message: 'A new verification code has been sent to your email.' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid verification attempt');

    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('No pending verification. Please request a new code.');
    }

    if (Date.now() > user.otpExpiresAt.getTime()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (user.otpCode !== dto.code) {
      throw new UnauthorizedException('Invalid verification code. Please try again.');
    }

    await this.usersService.setEmailVerified(user.id);
    const fresh = await this.usersService.findById(user.id);
    return this.issueTokens(fresh!);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isEmailVerified) {
      // Auto-resend OTP so they can verify immediately
      await this._dispatchOtp(user.id, user.email);
      throw new ForbiddenException({
        message: 'Please verify your email first. A new code has been sent.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    return this.issueTokens(user);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash)
      throw new UnauthorizedException('Access denied');

    const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!valid) throw new UnauthorizedException('Access denied');

    return this.issueTokens(user);
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshToken(userId);
  }

  // Called by ChurchesService after church creation to re-issue tokens with updated churchId
  async issueTokens(user: User) {
    const payload = { sub: user.id, churchId: user.churchId, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('app.jwtRefreshSecret'),
      expiresIn: this.config.get('app.jwtRefreshExpiresIn', '30d'),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.usersService.setRefreshToken(user.id, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        churchId: user.churchId,
      },
    };
  }

  // ── Branch Pastor phone-OTP login ────────────────────────────────────────────

  async loginWithPhone(phone: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException({
        message: 'Access Denied!',
        detail:
          'Either you entered an incorrect phone number or you have not yet been assigned a Branch Pastor role. Kindly contact your Senior Pastor for assistance.',
        code: 'PHONE_NOT_FOUND',
      });
    }
    if (user.role !== UserRole.BRANCH_PASTOR) {
      throw new ForbiddenException({
        message: 'Access Denied!',
        detail:
          'This login is for Branch Pastors only. Please use the Admin login with your email address.',
        code: 'WRONG_LOGIN_TYPE',
      });
    }
    if (!user.churchId) {
      throw new ForbiddenException({
        message: 'Access Denied!',
        detail:
          'Your account has not yet been assigned to a branch. Kindly contact your Senior Pastor for assistance.',
        code: 'NO_BRANCH_ASSIGNED',
      });
    }
    await this._dispatchPhoneOtp(user.id, phone);
    return { message: 'A 6-digit verification code has been sent to your phone.', phone };
  }

  async resendPhoneOtp(phone: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user) throw new NotFoundException('No account found with this phone number.');
    // Rate-limit: same 60-second window as email OTP
    if (user.otpExpiresAt && user.otpExpiresAt.getTime() - Date.now() > 9 * 60 * 1000) {
      throw new BadRequestException('Please wait 60 seconds before requesting a new code.');
    }
    await this._dispatchPhoneOtp(user.id, phone);
    return { message: 'A new verification code has been sent.' };
  }

  async verifyPhoneOtp(dto: { phone: string; code: string }) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('Invalid verification attempt.');

    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('No pending verification. Please request a new code.');
    }
    if (Date.now() > user.otpExpiresAt.getTime()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }
    if (user.otpCode !== dto.code) {
      throw new UnauthorizedException('Invalid verification code. Please try again.');
    }

    await this.usersService.clearOtp(user.id);
    const fresh = await this.usersService.findById(user.id);
    return this.issueTokens(fresh!);
  }

  private async _dispatchPhoneOtp(userId: string, phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.usersService.setOtp(userId, code, expiresAt);
    // TODO: replace with Termii SMS in production
    console.log(`[DEV] Branch Pastor OTP for ${phone}: ${code}`);
  }

  private async _dispatchOtp(userId: string, email: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.usersService.setOtp(userId, code, expiresAt);
    await this.mailService.sendOtp(email, code);
  }
}
