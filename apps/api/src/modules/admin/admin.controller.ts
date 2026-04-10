import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantStatus } from '@prisma/client';
import type { Response } from 'express';

import { InvoicesPdfService } from '../invoices/invoices-pdf.service';
import { EstimatesPdfService } from '../estimates/estimates-pdf.service';

// @Post('notifications/send')
// async sendNotification(...) {
//   return this.adminService.sendNotification(body);
// }

// @Post('notifications/schedule')
// async scheduleNotification(...) {
//   return this.adminService.scheduleNotification(body);
// }

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly invoicesPdfService: InvoicesPdfService,
    private readonly estimatesPdfService: EstimatesPdfService,
  ) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('tenants')
  async getTenants(@Query() query: { search?: string; status?: string }) {
    return this.adminService.getTenants(query);
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Put('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    const status = body.status as TenantStatus;
    return this.adminService.updateTenantStatus(id, status);
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string) {
    return this.adminService.deleteTenant(id);
  }

  @Get('financial/summary')
  async getFinancialSummary(
    @Query() query: { month?: string; year?: string },
  ) {
    return this.adminService.getFinancialSummary(query);
  }

  @Post('notifications/send')
  async sendNotification(@Body() body: any) {
    return this.adminService.sendNotification(body);
  }

  @Post('notifications/schedule')
  async scheduleNotification(@Body() body: any) {
    return this.adminService.scheduleNotification(body);

    
  }

  // ================= INVOICES =================

  @Get('invoices')
  async getAllInvoices(@Query() query: any) {
    return this.adminService.getAllInvoices(query);
  }

  @Get('invoices/:id/pdf')
  async getInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.adminService.getInvoiceById(Number(id));

    const pdfBuffer =
      await this.invoicesPdfService.generateInvoicePdf(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=fatura_${invoice.number}.pdf`,
    );

    res.send(pdfBuffer);
  }

  // ================= ESTIMATES =================

  @Get('estimates')
  async getAllEstimates(@Query() query: any) {
    return this.adminService.getAllEstimates(query);
  }

  @Get('estimates/:id/pdf')
  async getEstimatePdf(@Param('id') id: string, @Res() res: Response) {
    const estimate = await this.adminService.getEstimateById(Number(id));

    const pdfBuffer =
      await this.estimatesPdfService.generateEstimatePdf(estimate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=orcamento_${estimate.id}.pdf`,
    );

    res.send(pdfBuffer);
  }

  // ================= CLIENTS =================

  @Get('clients')
  async getAllClients(@Query() query: any) {
    return this.adminService.getAllClients(query);
  }

  @Get('clients/:id')
  async getClientById(@Param('id') id: string) {
    return this.adminService.getClientById(id);
  }

  // ================= NOTIFICATIONS =================

  @Get('notifications')
  async getNotifications() {
    return this.adminService.getNotifications();
  }

  @Put('notifications/:id/read')
  async markAsRead(@Param('id') id: string) {
    return this.adminService.markAsRead(id);
  }

  @Put('notifications/read-all')
  async markAllAsRead() {
    return this.adminService.markAllAsRead();
  }

  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    return this.adminService.deleteNotification(Number(id));
  }
}