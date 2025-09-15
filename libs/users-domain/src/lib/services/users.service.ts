import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, UserEntity } from '../entities/user.entity';

@Injectable()
export class UsersService {
  private users: UserEntity[] = [];
  private currentId = 1;

  constructor(private authService: AuthService) {
    this.createDemoUser();
  }

  private async createDemoUser() {
    const hashedPassword = await this.authService.hashPassword('password123');

    const demo = new UserEntity({
      id: '1',
      name: 'Admin Demo',
      email: 'admin@demo.com',
      phone: '+56912345678',
      password: hashedPassword,
      createdAt: new Date(),
    });

    const demo2 = new UserEntity({
      id: '2',
      name: 'Super Adminxx',
      email: 'superadmin@demo.com',
      phone: '+56912345678',
      password: hashedPassword,
      createdAt: new Date(),
    });

    this.users.push(demo);
    this.users.push(demo2);
    this.currentId = 2;
  }

  async createUser(dto: CreateUserDto): Promise<UserEntity> {
    const exists = this.users.find((u) => u.email === dto.email);
    if (exists) {
      throw new ConflictException('Email ya existe');
    }

    const hashedPassword = await this.authService.hashPassword(dto.password);

    const user = new UserEntity({
      id: this.currentId.toString(),
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      createdAt: new Date(),
    });

    this.users.push(user);
    this.currentId++;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserEntity;
  }

  async findAll(): Promise<UserEntity[]> {
    return this.users.map(({ password, ...user }) => user as UserEntity);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.find((u) => u.email === email) || null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserEntity;
  }
}
