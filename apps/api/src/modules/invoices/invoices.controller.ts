import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { Public } from '../../auth/public.decorator';
import type { Response } from 'express';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@Body() body: any, @Req() req) {
    return this.invoicesService.create(req.user.tenantId, body);
  }

  @Get()
  findAll(@Req() req) {
    return this.invoicesService.findAll(req.user.tenantId, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.invoicesService.findOne(Number(id), req.user.tenantId, req.user.role);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.invoicesService.update(Number(id), req.user.tenantId, body, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.invoicesService.remove(Number(id), req.user.tenantId, req.user.role);
  }

  @Post(':id/share')
  async generateShareLink(@Param('id') id: string, @Req() req) {
    const token = await this.invoicesService.generateShareToken(
      Number(id),
      req.user.tenantId,
      req.user.role,
    );

    const apiBase = (process.env.API_URL || process.env.APP_URL || 'https://api.mecpro.tec.br').replace(/\/api$/, '');
    const url = `${apiBase}/api/public/invoices/share/${token}`;
    return { url, token };
  }

  // 🆕 Endpoint para enviar fatura via WhatsApp
  @Post(':id/send-whatsapp')
  async sendViaWhatsApp(
    @Param('id') id: string,
    @Body() body: { workshopData?: any },
    @Req() req,
  ) {
    return this.invoicesService.sendViaWhatsApp(
      Number(id),
      req.user.tenantId,
      body.workshopData,
      req.user.role,
    );
  }
}

@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Public()
  @Get('share/:token')
  async getSharedPdf(@Param('token') token: string, @Res() res: Response) {
    if (!token) return res.status(400).send('Token não fornecido');

    try {
      const pdfBuffer = await this.invoicesService.getPdfByShareToken(token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=fatura.pdf');
      return res.send(pdfBuffer);
    } catch (error) {
      if (error.message === 'Token inválido' || error.message === 'Token expirado') {
        return res.status(404).send('Link inválido ou expirado');
      }
      console.error('Erro ao gerar PDF público:', error);
      return res.status(500).send('Erro ao gerar PDF');
    }
  }
}