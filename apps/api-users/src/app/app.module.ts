import { Module } from '@nestjs/common';
import { UsersDomainModule } from '@nx-starter/users-domain';

@Module({
  imports: [UsersDomainModule], // Solo importar el módulo del dominio
  controllers: [], // No controllers propios
  providers: [], // No providers propios
})
export class AppModule {}
