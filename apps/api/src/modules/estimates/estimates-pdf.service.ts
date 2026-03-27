import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { BrowserPoolService } from '../../shared/browser-pool.service';

@Injectable()
export class EstimatesPdfService {
  private readonly logger = new Logger(EstimatesPdfService.name);

  constructor(private readonly browserPool: BrowserPoolService) {}

  async generateEstimatePdf(estimate: any, tenant: any): Promise<Buffer> {
    // ... restante do código (igual ao que você já tem, mas usando this.browserPool.getBrowser())
    const items = estimate.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.price.toFixed(2),
      issPercent: item.issPercent || 0,
      total: item.total.toFixed(2),
    }));

    const subtotal = estimate.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const issValue = estimate.items.reduce((acc, item) => {
      const iss = item.issPercent ? item.price * (item.issPercent / 100) * item.quantity : 0;
      return acc + iss;
    }, 0);

    const issueDate = new Date(estimate.date).toLocaleDateString('pt-BR');
    const validUntil = new Date(new Date(estimate.date).getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR');

    const statusMap: Record<string, string> = {
      DRAFT: 'Pendente',
      APPROVED: 'Aceito',
      CONVERTED: 'Convertido',
    };

    const client = estimate.client;
    const vehicleDetails = client.vehicleBrand && client.vehicleModel
      ? `${client.vehicleBrand} ${client.vehicleModel} ${client.vehicleYear || ''} - ${client.vehicleColor || ''}`.trim()
      : client.vehicle || 'Não informado';
    const plate = client.plate || 'Não informado';

    const companyName = tenant?.name || 'Oficina Mecânica';
    const companyDocument = tenant?.documentNumber || tenant?.document || '00.000.000/0001-00';
    const companyPhone = tenant?.phone || '(11) 1234-5678';
    const companyEmail = tenant?.email || 'contato@oficina.com';
    const logoUrl = tenant?.logoUrl || '';

    const templatePath = path.join(__dirname, 'estimates-pdf.hbs');
    const templateContent = await readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);

    const html = compiledTemplate({
      logoUrl,
      estimateNumber: estimate.id,
      client: {
        name: client.name,
        document: client.document || 'Não informado',
        address: client.address || 'Não informado',
        phone: client.phone,
        vehicle: vehicleDetails,
        plate,
      },
      issueDate,
      validUntil,
      status: statusMap[estimate.status] || estimate.status,
      items,
      subtotal: subtotal.toFixed(2),
      issValue: issValue.toFixed(2),
      total: estimate.total.toFixed(2),
      companyName,
      companyDocument,
      companyPhone,
      companyEmail,
    });

    const browser = await this.browserPool.getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  }
}