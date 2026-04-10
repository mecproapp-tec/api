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
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesPdfService } from './invoices-pdf.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { Public } from '../../auth/public.decorator';
import { Request, Response } from 'express';

// ============================
// TIPOS
// ============================
interface AuthRequest extends Request {
  user: {
    tenantId: string;
    role: string;
  };
}

interface CreateInvoiceDto {
  clientId: number;
  items: any[];
}

interface UpdateInvoiceDto extends CreateInvoiceDto {
  status?: string;
}

// ============================
// CONTROLLER PRIVADO (LOGADO)
// ============================
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
  ) {}

  @Post()
  create(@Body() body: CreateInvoiceDto, @Req() req: AuthRequest) {
    return this.invoicesService.create(req.user.tenantId, body);
  }

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.invoicesService.findAll(
      req.user.tenantId,
      req.user.role,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.invoicesService.findOne(
      Number(id),
      req.user.tenantId,
      req.user.role,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateInvoiceDto,
    @Req() req: AuthRequest,
  ) {
    return this.invoicesService.update(
      Number(id),
      req.user.tenantId,
      body,
      req.user.role,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.invoicesService.remove(
      Number(id),
      req.user.tenantId,
      req.user.role,
    );
  }

  // 🔗 GERAR LINK PÚBLICO
  @Post(':id/share')
  async generateShareLink(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    const token = await this.invoicesService.generateShareToken(
      Number(id),
    );

    const baseUrl =
      (process.env.API_URL || 'https://api.mecpro.tec.br').replace(/\/$/, '');

    return {
      url: `${baseUrl}/public/invoices/share/${token}`,
    };
  }

  // 📲 WHATSAPP
  @Post(':id/send-whatsapp')
  async sendViaWhatsApp(@Param('id') id: string) {
    return this.invoicesService.sendViaWhatsApp(Number(id));
  }
}

// ============================
// CONTROLLER PÚBLICO (SEM LOGIN)
// ============================
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicesPdfService: InvoicesPdfService,
  ) {}

  @Public()
  @Get('share/:token')
  async getSharedPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send('Token não fornecido');
    }

    try {
      // 🔥 BUSCA FATURA
      const invoice =
        await this.invoicesService.getInvoiceByShareToken(token);

      if (!invoice) {
        throw new NotFoundException('Fatura não encontrada');
      }

      // 🔥 GERA PDF COM TEMPLATE NOVO
      const pdf =
        await this.invoicesPdfService.generateInvoicePdf(invoice);

      // 🔥 RETORNA PDF DIRETO
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=fatura.pdf`,
      });

      return res.send(pdf);
    } catch (error: any) {
      console.error('Erro ao gerar PDF público:', error);

      if (
        error?.message === 'Token inválido' ||
        error?.message === 'Token expirado'
      ) {
        return res
          .status(HttpStatus.NOT_FOUND)
          .send('Link inválido ou expirado');
      }

      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send('Erro ao gerar PDF');
    }
  }
}