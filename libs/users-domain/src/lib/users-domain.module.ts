import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Services
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env['JWT_SECRET'] || 'dev-secret-key',
      signOptions: {
        expiresIn: '24h',
        issuer: 'core-api',
      },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UsersService],
  exports: [AuthService, UsersService],
})
export class UsersDomainModule {}
