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
    return this.estimatesService.create(req.user.tenantId, data);
  }

  @Get()
  findAll(@Req() req) {
    return this.estimatesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.estimatesService.findOne(Number(id), req.user.tenantId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: { clientId: number; date: string; items: any[]; status?: string },
    @Req() req,
  ) {
    return this.estimatesService.update(Number(id), req.user.tenantId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.estimatesService.remove(Number(id), req.user.tenantId);
  }

  @Post(':id/share')
  async generateShareLink(@Param('id') id: string, @Req() req) {
    const token = await this.estimatesService.generateShareToken(
      Number(id),
      req.user.tenantId,
    );
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const apiBasePath = process.env.API_BASE_PATH || '/api';
    const url = `${baseUrl}${apiBasePath}/public/estimates/share/${token}`;
    return { url };
  }

  @Post(':id/send-whatsapp')
  async sendViaWhatsApp(@Param('id') id: string, @Req() req) {
    return this.estimatesService.sendViaWhatsApp(Number(id), req.user.tenantId);
  }
}

@Controller('public/estimates')
export class PublicEstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Public()
  @Get('share/:token')
  async getSharedPdf(@Param('token') token: string, @Res() res: Response) {
    console.log(`[PublicEstimates] Recebido token: ${token}`);
    if (!token) {
      return res.status(400).send('Token não fornecido');
    }

    try {
      const pdfBuffer = await this.estimatesService.getPdfByShareToken(token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=orcamento-compartilhado.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PublicEstimates] Erro ao gerar PDF:', error);
      if (error.message === 'Token inválido' || error.message === 'Token expirado') {
        res.status(404).send('Link inválido ou expirado');
      } else {
        res.status(500).send('Erro ao gerar PDF. Tente novamente mais tarde.');
      }
    }
  }
}