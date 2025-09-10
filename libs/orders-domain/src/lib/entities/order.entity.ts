import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  IsOptional,
} from 'class-validator';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export class OrderEntity {
  @ApiProperty({ example: 'ord_123' })
  id!: string;

  @ApiProperty({ example: '1' })
  userId!: string;

  @ApiProperty({ example: 99.99 })
  amount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ example: 'Premium subscription' })
  description!: string;

  @ApiProperty({ required: false })
  paymentIntentId?: string;

  @ApiProperty({ required: false })
  invoiceUrl?: string;

  @ApiProperty()
  createdAt!: Date;

  constructor(partial: Partial<OrderEntity>) {
    Object.assign(this, partial);
  }
}

export class CreateOrderDto {
  @ApiProperty({ example: '1' })
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @ApiProperty({ example: 99.99 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsOptional()
  currency!: string;

  @ApiProperty({ example: 'Premium subscription' })
  @IsNotEmpty()
  @IsString()
  description!: string;
}

export class PaymentResponse {
  @ApiProperty({ type: OrderEntity })
  order!: OrderEntity;

  @ApiProperty()
  payment!: {
    id: string;
    status: string;
    amount: number;
    currency: string;
  };

  @ApiProperty({ required: false })
  invoiceUrl?: string;
}
