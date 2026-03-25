import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import puppeteer from 'puppeteer';

@Injectable()
export class InvoicesPdfService {
  constructor(private prisma: PrismaService) {}

  async getPdfByShareToken(token: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { shareToken: token },
      include: {
        items: true,
        client: true,
      },
    });

    if (!invoice) {
      throw new Error('Fatura não encontrada');
    }

    const client = invoice.client as any; // cast para any para acessar campos novos

    const vehicleDetails =
      client?.vehicleBrand && client?.vehicleModel
        ? `${client.vehicleBrand} ${client.vehicleModel}${
            client.vehicleYear ? ` ${client.vehicleYear}` : ''
          }${client.vehicleColor ? ` - ${client.vehicleColor}` : ''}`.trim()
        : client?.vehicle || 'Não informado';

    const plate = client?.plate || 'Não informado';

    let subtotal = 0;
    let issTotal = 0;

    const itemsWithTotal = invoice.items.map((item) => {
      const itemTotal = item.price * item.quantity;
      const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;

      subtotal += itemTotal;
      issTotal += iss;

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.price.toFixed(2),
        total: (itemTotal + iss).toFixed(2),
      };
    });

    const total = subtotal + issTotal;

    const templatePath = path.join(__dirname, 'invoice-pdf.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);

    const data = {
      invoiceNumber: invoice.number,
      client: {
        name: client.name,
        document: client.document || 'Não informado',
        address: client.address || '',
        phone: client.phone,
        vehicle: vehicleDetails,
        plate: plate,
      },
      issueDate: new Date(invoice.createdAt).toLocaleDateString('pt-BR'),
      dueDate: '',
      status: this.getStatusText(invoice.status),
      items: itemsWithTotal,
      subtotal: subtotal.toFixed(2),
      issRate: 0,
      issValue: issTotal.toFixed(2),
      total: total.toFixed(2),
      companyName: process.env.COMPANY_NAME || 'Oficina',
      companyDocument: process.env.COMPANY_DOCUMENT || '',
      companyPhone: process.env.COMPANY_PHONE || '',
      companyEmail: process.env.COMPANY_EMAIL || '',
      logoUrl: process.env.LOGO_URL || '',
    };

    const html = template(data);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    return Buffer.from(pdfUint8);
  }

  private getStatusText(status: string): string {
    const map = {
      PAID: 'Paga',
      PENDING: 'Pendente',
      CANCELED: 'Cancelada',
    };
    return map[status] || 'Desconhecido';
  }
}