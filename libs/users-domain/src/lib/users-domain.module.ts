import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth/auth.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
      signOptions: {
        expiresIn: '24h',
        issuer: 'core-api',
      },
    }),
  ],
  providers: [AuthService, UsersService],
  exports: [AuthService, UsersService, JwtModule],
})
export class UsersDomainModule {}
