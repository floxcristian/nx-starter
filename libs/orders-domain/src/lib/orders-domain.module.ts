import { Module } from '@nestjs/common';

// Services
import { OrdersService } from './services/orders.service';
import { PaymentService } from './services/payment.service';

// Controllers
import { OrdersController } from './controllers/orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PaymentService],
  exports: [OrdersService, PaymentService],
})
export class OrdersDomainModule {}
