import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomBytes } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private configService: ConfigService,
  ) {}

  async create(tenantId: string, data: any) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('A fatura deve ter pelo menos um item.');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: data.clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const itemsWithTotal = data.items.map((item) => {
      const iss = item.issPercent ? item.price * (item.issPercent / 100) : 0;
      const total = (item.price + iss) * item.quantity;

      return {
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        issPercent: item.issPercent,
        total,
      };
    });

    const total = itemsWithTotal.reduce((acc, item) => acc + item.total, 0);
    const invoiceNumber = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

    return this.prisma.invoice.create({
      data: {
        tenantId,
        clientId: data.clientId,
        number: invoiceNumber,
        total,
        status: data.status || 'PENDING',
        items: { create: itemsWithTotal },
      },
      include: { items: true, client: true },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: { items: true, client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { items: true, client: true },
    });

    if (!invoice) throw new NotFoundException('Fatura não encontrada');

    return invoice;
  }

  async update(id: number, tenantId: string, updateData: any) {
    await this.findOne(id, tenantId);

    if (updateData.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: updateData.clientId, tenantId },
      });
      if (!client) throw new NotFoundException('Cliente não encontrado');
    }

    if (updateData.items && updateData.items.length > 0) {
      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const itemsWithTotal = updateData.items.map((item) => {
        const iss = item.issPercent ? item.price * (item.issPercent / 100) : 0;
        const total = (item.price + iss) * item.quantity;
        return {
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          issPercent: item.issPercent,
          total,
        };
      });

      const total = itemsWithTotal.reduce((acc, item) => acc + item.total, 0);

      const dataToUpdate: any = {
        clientId: updateData.clientId,
        total,
        items: { create: itemsWithTotal },
      };

      if (updateData.status) {
        dataToUpdate.status = updateData.status;
      }

      return this.prisma.invoice.update({
        where: { id },
        data: dataToUpdate,
        include: { items: true, client: true },
      });
    }

    const dataToUpdate: any = {};
    if (updateData.clientId) dataToUpdate.clientId = updateData.clientId;
    if (updateData.status) dataToUpdate.status = updateData.status;

    return this.prisma.invoice.update({
      where: { id },
      data: dataToUpdate,
      include: { items: true, client: true },
    });
  }

  async remove(id: number, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.invoiceItem.deleteMany({
      where: { invoiceId: id },
    });

    await this.prisma.invoice.delete({
      where: { id },
    });

    return { message: 'Fatura removida com sucesso' };
  }

  private async generatePdfFromInvoice(invoice: any, tenant: any): Promise<Buffer> {
    const templatePath = path.join(__dirname, 'invoice-pdf.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);

    const html = compiledTemplate({
      invoice,
      tenant,
    });

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    return Buffer.from(pdf);
  }

  async generatePdf(id: number, tenantId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    return this.generatePdfFromInvoice(invoice, tenant);
  }

  async generateShareToken(id: number, tenantId: string): Promise<string> {
    const invoice = await this.findOne(id, tenantId);

    if (
      invoice.shareToken &&
      invoice.shareTokenExpires &&
      new Date() < invoice.shareTokenExpires
    ) {
      return invoice.shareToken;
    }

    const token = randomBytes(32).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.invoice.update({
      where: { id },
      data: {
        shareToken: token,
        shareTokenExpires: expiresAt,
      },
    });

    return token;
  }

  async validateShareToken(token: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { shareToken: token },
      include: {
        items: true,
        client: true,
      },
    });

    if (!invoice) {
      throw new UnauthorizedException('Token inválido');
    }

    if (
      invoice.shareTokenExpires &&
      new Date() > invoice.shareTokenExpires
    ) {
      throw new UnauthorizedException('Token expirado');
    }

    return invoice;
  }

  async getPdfByShareToken(token: string): Promise<Buffer> {
    const invoice = await this.validateShareToken(token);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invoice.tenantId },
    });

    return this.generatePdfFromInvoice(invoice, tenant);
  }

  async sendViaWhatsApp(id: number, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);
    const client = invoice.client;

    if (!client.phone) {
      throw new BadRequestException('Cliente sem telefone');
    }

    const token = await this.generateShareToken(id, tenantId);

    const baseUrl =
      this.configService.get<string>('APP_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';

    const pdfUrl = `${baseUrl}/api/public/invoices/share/${token}`;

    const message = `Olá ${client.name}!

Sua fatura ${invoice.number} está pronta ✅

Acesse:
${pdfUrl}

Total: R$ ${invoice.total.toFixed(2)}`;

    const whatsappLink = this.whatsappService.generateWhatsAppLink(
      client.phone,
      message,
    );

    return {
      whatsappLink,
      message,
      pdfUrl,
    };
  }
}