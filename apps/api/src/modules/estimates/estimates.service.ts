import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EstimatesPdfService } from './estimates-pdf.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    private prisma: PrismaService,
    private estimatesPdfService: EstimatesPdfService,
    private storageService: StorageService,
  ) {}

  private calculate(items: any[]) {
    let total = 0;
    const normalized = items.map((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      const itemTotal = price * quantity;
      total += itemTotal;
      return {
        description: item.description || '-',
        quantity,
        price,
        total: itemTotal,
      };
    });
    return { items: normalized, total };
  }

  async create(data: any) {
    const { tenantId, clientId, items: inputItems } = data;

    this.logger.log(`Criando orçamento para tenant: ${tenantId}, client: ${clientId}`);

    // Validações iniciais
    if (!tenantId) {
      throw new BadRequestException('TenantId não informado');
    }
    if (!clientId) {
      throw new BadRequestException('Cliente não informado');
    }
    if (!inputItems || !inputItems.length) {
      throw new BadRequestException('Orçamento sem itens');
    }

    // Verifica se o cliente existe e pertence ao tenant
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new BadRequestException('Cliente não encontrado ou não pertence ao seu tenant');
    }

    const { items, total } = this.calculate(inputItems);

    try {
      const estimate = await this.prisma.estimate.create({
        data: {
          tenant: { connect: { id: tenantId } },
          client: { connect: { id: clientId } },
          total,
          status: 'DRAFT',
          date: new Date(),
          items: {
            create: items,
          },
        },
        include: {
          items: true,
          client: true,
          tenant: true,
        },
      });

      this.logger.log(`Orçamento criado com ID: ${estimate.id}`);

      // Gerar PDF em background (sem await para não bloquear)
      this.generatePdfInBackground(estimate).catch((err) => {
        this.logger.error(`Erro em background ao gerar PDF: ${err.message}`);
      });

      return estimate;
    } catch (error) {
      this.logger.error(`Erro ao criar orçamento: ${error.message}`, error.stack);
      // Se for erro de chave estrangeira ou constraint do Prisma
      if (error.code === 'P2003') {
        throw new BadRequestException('Cliente ou Tenant inválido');
      }
      throw new InternalServerErrorException('Erro interno ao criar orçamento');
    }
  }

  private async generatePdfInBackground(estimate: any) {
    try {
      this.logger.log(`Iniciando geração de PDF para orçamento ${estimate.id}`);

      const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimate);
      const pdfKey = `${estimate.tenantId}/estimates/${estimate.id}-${Date.now()}.pdf`;
      const pdfUrl = await this.storageService.uploadPdf(pdfBuffer, pdfKey);

      await this.prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          pdfUrl,
          pdfKey,
          pdfStatus: 'generated',
          pdfGeneratedAt: new Date(),
        },
      });

      this.logger.log(`PDF gerado com sucesso para orçamento ${estimate.id}`);
    } catch (error) {
      // Apenas loga o erro, não quebra a criação do orçamento
      this.logger.error(`Erro ao gerar PDF para orçamento ${estimate.id}: ${error.message}`);
      // Opcional: atualizar status para 'failed'
      await this.prisma.estimate.update({
        where: { id: estimate.id },
        data: { pdfStatus: 'failed' },
      }).catch(e => this.logger.error(e.message));
    }
  }

  async findAll(tenantId: string) {
    this.logger.log(`Buscando orçamentos do tenant: ${tenantId}`);

    if (!tenantId) {
      throw new BadRequestException('TenantId inválido');
    }

    try {
      // Verificar se o tenant existe (opcional, pode ser removido para performance)
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        this.logger.error(`Tenant não encontrado: ${tenantId}`);
        throw new BadRequestException('Tenant não encontrado');
      }

      const estimates = await this.prisma.estimate.findMany({
        where: { tenantId },
        include: { client: true, items: true },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(`Encontrados ${estimates.length} orçamentos`);
      return estimates;
    } catch (error) {
      this.logger.error(`Erro detalhado ao buscar orçamentos: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Erro ao buscar orçamentos');
    }
  }

  async findOne(id: number, tenantId: string) {
    this.logger.log(`Buscando orçamento ${id} do tenant ${tenantId}`);

    if (!tenantId) {
      throw new BadRequestException('TenantId inválido');
    }

    const estimate = await this.prisma.estimate.findFirst({
      where: {
        id,
        tenantId,
      },
      include: { client: true, items: true, tenant: true },
    });

    if (!estimate) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    return estimate;
  }

  async remove(id: number, tenantId: string) {
    const estimate = await this.findOne(id, tenantId);

    if (estimate.pdfKey) {
      await this.storageService.deleteFile(estimate.pdfKey).catch((err) => {
        this.logger.warn(`Erro ao deletar PDF no storage: ${err.message}`);
      });
    }

    try {
      await this.prisma.estimate.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      this.logger.error(`Erro ao deletar orçamento ${id}: ${error.message}`);
      throw new InternalServerErrorException('Erro ao deletar orçamento');
    }
  }

  async sendToWhatsApp(id: number, tenantId: string, phoneNumber: string) {
    this.logger.log(`Preparando envio WhatsApp para orçamento ${id}`);

    const estimate = await this.findOne(id, tenantId);

    if (!estimate.pdfUrl) {
      throw new BadRequestException('PDF ainda não gerado. Aguarde alguns segundos e tente novamente.');
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    const message =
      `📄 *ORÇAMENTO MECPRO #${estimate.id}*\n\n` +
      `👤 *Cliente:* ${estimate.client?.name || '-'}\n` +
      `🚗 *Veículo:* ${estimate.client?.vehicle || '-'}\n` +
      `💰 *Total:* R$ ${Number(estimate.total).toFixed(2)}\n` +
      `📅 *Data:* ${new Date(estimate.date).toLocaleDateString('pt-BR')}\n\n` +
      `📎 *PDF:*\n${estimate.pdfUrl}\n\n` +
      `---\n` +
      `*MecPro - Sua oficina de confiança*\n` +
      `Qualquer dúvida, estamos à disposição! 🚀`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;

    this.logger.log(`Link WhatsApp gerado: ${whatsappUrl}`);

    return {
      success: true,
      whatsappUrl,
      message: 'Clique no link para enviar pelo WhatsApp',
    };
  }

  async resendPdf(id: number, tenantId: string) {
    this.logger.log(`Regenerando PDF para orçamento ${id}`);

    const estimate = await this.findOne(id, tenantId);

    try {
      const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimate);
      const pdfKey = `${estimate.tenantId}/estimates/${estimate.id}-${Date.now()}.pdf`;
      const pdfUrl = await this.storageService.uploadPdf(pdfBuffer, pdfKey);

      await this.prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          pdfUrl,
          pdfKey,
          pdfGeneratedAt: new Date(),
        },
      });

      return { success: true, pdfUrl };
    } catch (error) {
      this.logger.error(`Erro ao regenerar PDF: ${error.message}`);
      throw new InternalServerErrorException('Erro ao regenerar PDF');
    }
  }
}