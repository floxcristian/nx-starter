import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UserEntity {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;

  @ApiProperty({ example: 'juan@example.com' })
  email!: string;

  @ApiProperty({ example: '+56912345678', required: false })
  phone?: string;

  @ApiProperty()
  createdAt!: Date;

  password!: string; // No exponer

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

export class CreateUserDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '+56912345678', required: false })
  @IsOptional()
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  password!: string;
}

export class AuthResponse {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserEntity })
  user!: UserEntity;
}
