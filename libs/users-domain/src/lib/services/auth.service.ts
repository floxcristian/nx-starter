import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateToken(user: UserEntity): Promise<string> {
    const payload = { sub: user.id, email: user.email, name: user.name };
    return this.jwtService.signAsync(payload);
  }

  async login(
    email: string,
    password: string,
    user: UserEntity
  ): Promise<{ accessToken: string; user: UserEntity }> {
    const isValid = await this.validatePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const accessToken = await this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword as UserEntity,
    };
  }
}
