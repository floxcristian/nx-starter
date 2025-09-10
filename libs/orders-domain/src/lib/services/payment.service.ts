import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  async processPayment(amount: number, currency: string, description: string) {
    this.logger.log(`Processing payment: ${amount} ${currency}`);

    // Mock Stripe payment
    const mockPayment = {
      id: `pi_mock_${Date.now()}`,
      status: Math.random() > 0.1 ? 'succeeded' : 'failed',
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
    };

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.logger.log(`Payment result: ${mockPayment.status}`);
    return mockPayment;
  }

  async generateInvoice(orderId: string): Promise<string> {
    this.logger.log(`Generating invoice for order: ${orderId}`);

    // Mock invoice generation
    await new Promise((resolve) => setTimeout(resolve, 500));

    return `https://mock-bucket.s3.amazonaws.com/invoices/${orderId}.pdf`;
  }

  async sendInvoiceEmail(
    email: string,
    invoiceUrl: string,
    orderId: string
  ): Promise<void> {
    this.logger.log(`Sending invoice email to: ${email} for order: ${orderId}`);

    // Mock email sending
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.logger.log('Invoice email sent successfully');
  }
}
