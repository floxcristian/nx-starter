import { Module } from '@nestjs/common';
import { OrdersDomainModule } from '@nx-starter/orders-domain';

@Module({
  imports: [OrdersDomainModule], // Solo importar el módulo del dominio
  controllers: [], // No controllers propios
  providers: [], // No providers propios
})
export class AppModule {}
