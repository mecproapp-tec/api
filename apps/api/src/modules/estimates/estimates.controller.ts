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
import { EstimatesService } from './estimates.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { Public } from '../../auth/public.decorator';
import type { Response } from 'express';

@Controller('estimates')
@UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Post()
  create(@Body() data: { clientId: number; date: string; items: any[] }, @Req() req) {
    // O método create não usa role, apenas tenantId
    return this.estimatesService.create(req.user.tenantId, data);
  }

  @Get()
  findAll(@Req() req) {
    // Passa o role para filtrar corretamente (se não for admin, filtra por tenant)
    return this.estimatesService.findAll(req.user.tenantId, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.estimatesService.findOne(Number(id), req.user.tenantId, req.user.role);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: { clientId: number; date: string; items: any[]; status?: string },
    @Req() req,
  ) {
    return this.estimatesService.update(Number(id), req.user.tenantId, data, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.estimatesService.remove(Number(id), req.user.tenantId, req.user.role);
  }

  @Post(':id/share')
  async generateShareLink(@Param('id') id: string, @Req() req) {
    const token = await this.estimatesService.generateShareToken(
      Number(id),
      req.user.tenantId,
      req.user.role,
    );
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const url = `${baseUrl}/api/public/estimates/share/${token}`;
    return { url };
  }

  @Post(':id/send-whatsapp')
  async sendViaWhatsApp(
    @Param('id') id: string,
    @Body() body: { workshopData?: any },
    @Req() req,
  ) {
    return this.estimatesService.sendViaWhatsApp(
      Number(id),
      req.user.tenantId,
      body.workshopData,
      req.user.role,
    );
  }
}

@Controller('public/estimates')
export class PublicEstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Public()
  @Get('share/:token')
  async getSharedPdf(@Param('token') token: string, @Res() res: Response) {
    if (!token) return res.status(400).send('Token não fornecido');

    try {
      const pdfBuffer = await this.estimatesService.getPdfByShareToken(token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=orcamento.pdf');
      return res.send(pdfBuffer);
    } catch (error) {
      if (error.message === 'Token inválido' || error.message === 'Token expirado') {
        return res.status(404).send('Link inválido ou expirado');
      }
      return res.status(500).send('Erro ao gerar PDF');
    }
  }
}