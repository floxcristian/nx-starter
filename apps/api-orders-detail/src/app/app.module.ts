import { Module } from '@nestjs/common';
import { CoreOrdersModule } from '@nx-starter/core-orders';

@Module({
  imports: [CoreOrdersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
