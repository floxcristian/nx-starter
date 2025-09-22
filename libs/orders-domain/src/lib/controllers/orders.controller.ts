import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service';
import {
  CreateOrderDto,
  OrderEntity,
  PaymentResponse,
} from '../entities/order.entity';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create and process order' })
  @ApiResponse({ status: 201, type: PaymentResponse })
  async createOrder(@Body() dto: CreateOrderDto): Promise<PaymentResponse> {
    const order = await this.ordersService.createOrder(dto);
    const result = await this.ordersService.processOrderPayment(order.id);

    return {
      order: result.order,
      payment: result.payment,
      invoiceUrl: result.order.invoiceUrl,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiResponse({ status: 200, type: [OrderEntity] })
  async findAll(): Promise<OrderEntity[]> {
    return this.ordersService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get orders by user ID' })
  @ApiResponse({ status: 200, type: [OrderEntity] })
  async findByUserId(@Param('userId') userId: string): Promise<OrderEntity[]> {
    return this.ordersService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, type: OrderEntity })
  async findOne(@Param('id') id: string): Promise<OrderEntity | null> {
    return this.ordersService.findById(id);
  }
}
