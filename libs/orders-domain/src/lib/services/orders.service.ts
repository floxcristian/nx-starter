import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateOrderDto,
  OrderEntity,
  OrderStatus,
} from '../entities/order.entity';
import { PaymentService } from './payment.service';

@Injectable()
export class OrdersService {
  private orders: OrderEntity[] = [];
  private currentId = 1;

  constructor(private paymentService: PaymentService) {
    this.createDemoOrders();
  }

  private createDemoOrders() {
    const demoOrders = [
      {
        userId: '1',
        amount: 99.99,
        currency: 'USD',
        description: 'Premium Plan',
        status: OrderStatus.PAID,
      },
      {
        userId: '1',
        amount: 49.99,
        currency: 'USD',
        description: 'Basic Plan',
        status: OrderStatus.PENDING,
      },
      {
        userId: '1',
        amount: 199.99,
        currency: 'USD',
        description: 'Elite Plan',
        status: OrderStatus.PAID,
      },
    ];

    demoOrders.forEach((data) => {
      const order = new OrderEntity({
        id: `ord_${this.currentId}`,
        ...data,
        createdAt: new Date(),
      });
      this.orders.push(order);
      this.currentId++;
    });
  }

  async createOrder(dto: CreateOrderDto): Promise<OrderEntity> {
    const order = new OrderEntity({
      id: `ord_${this.currentId}`,
      userId: dto.userId,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
    });

    this.orders.push(order);
    this.currentId++;
    return order;
  }

  async processOrderPayment(orderId: string): Promise<any> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Process payment
    const payment = await this.paymentService.processPayment(
      order.amount,
      order.currency,
      order.description
    );

    // Update order status
    if (payment.status === 'succeeded') {
      order.status = OrderStatus.PAID;
      order.paymentIntentId = payment.id;

      // Generate invoice
      order.invoiceUrl = await this.paymentService.generateInvoice(order.id);
    } else {
      order.status = OrderStatus.FAILED;
    }

    return { order, payment };
  }

  async findAll(): Promise<OrderEntity[]> {
    return this.orders;
  }

  async findByUserId(userId: string): Promise<OrderEntity[]> {
    return this.orders.filter((o) => o.userId === userId);
  }

  async findById(id: string): Promise<OrderEntity | null> {
    return this.orders.find((o) => o.id === id) || null;
  }
}
