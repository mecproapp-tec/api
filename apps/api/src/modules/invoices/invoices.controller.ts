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
    return this.invoicesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.invoicesService.findOne(Number(id), req.user.tenantId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.invoicesService.update(Number(id), req.user.tenantId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.invoicesService.remove(Number(id), req.user.tenantId);
  }

  @Post(':id/share')
  async generateShareLink(@Param('id') id: string, @Req() req) {
    const token = await this.invoicesService.generateShareToken(
      Number(id),
      req.user.tenantId,
    );

    const baseUrl =
      process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

    // ✅ URL CORRETA COM /api
    const url = `${baseUrl}/api/public/invoices/share/${token}`;

    return { url };
  }

  @Post(':id/send-whatsapp')
  async sendViaWhatsApp(@Param('id') id: string, @Req() req) {
    return this.invoicesService.sendViaWhatsApp(
      Number(id),
      req.user.tenantId,
    );
  }
}

@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Public()
  @Get('share/:token')
  async getSharedPdf(@Param('token') token: string, @Res() res: Response) {
    if (!token) {
      return res.status(400).send('Token não fornecido');
    }

    try {
      const pdfBuffer =
        await this.invoicesService.getPdfByShareToken(token);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename=fatura.pdf',
      );

      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);

      if (
        error.message === 'Token inválido' ||
        error.message === 'Token expirado'
      ) {
        return res.status(404).send('Link inválido ou expirado');
      }

      return res.status(500).send('Erro ao gerar PDF');
    }
  }
}