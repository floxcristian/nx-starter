import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import {
  CreateUserDto,
  UserEntity,
  LoginDto,
  AuthResponse,
} from '../entities/user.entity';

@Injectable()
export class UsersService {
  private users: UserEntity[] = [];
  private currentId = 1;

  constructor(private authService: AuthService) {
    // Crear usuario demo
    this.createDemoUser();
  }

  private async createDemoUser() {
    const demoUser: CreateUserDto = {
      name: 'Admin Demo',
      email: 'admin@demo.com',
      password: 'password123',
      phone: '+56912345678',
    };

    try {
      await this.createUser(demoUser);
    } catch (error) {
      // Usuario ya existe, ignorar
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<UserEntity> {
    // Verificar si el email ya existe
    const existingUser = this.users.find(
      (u) => u.email === createUserDto.email
    );
    if (existingUser) {
      throw new ConflictException('El email ya está en uso');
    }

    const hashedPassword = await this.authService.hashPassword(
      createUserDto.password
    );

    const user = new UserEntity({
      id: this.currentId.toString(),
      name: createUserDto.name,
      email: createUserDto.email,
      phone: createUserDto.phone,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.users.push(user);
    this.currentId++;

    // Devolver usuario sin password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserEntity;
  }

  async findAll(): Promise<UserEntity[]> {
    return this.users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as UserEntity;
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = this.users.find((u) => u.email === email);
    if (!user) return null;

    return user; // Devolver con password para validación
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserEntity;
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.findByEmail(loginDto.email);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.authService.login(loginDto, user);
  }

  async getUserStats() {
    return {
      totalUsers: this.users.length,
      recentUsers: this.users.filter((u) => {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return u.createdAt > dayAgo;
      }).length,
    };
  }
}
