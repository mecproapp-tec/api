import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';

import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

@Injectable()
export class EstimatesPdfService {
  private readonly logger = new Logger(EstimatesPdfService.name);

  constructor() {
    this.logger.log('EstimatesPdfService inicializado');
  }

  private loadTemplate(): HandlebarsTemplateDelegate {
    try {
      const templatePath = path.join(__dirname, 'estimates-pdf.hbs');

      this.logger.log(`Carregando template: ${templatePath}`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template não encontrado em: ${templatePath}`);
      }

      const templateHtml = fs.readFileSync(templatePath, 'utf-8');

      return Handlebars.compile(templateHtml);
    } catch (error) {
      this.logger.error('Erro ao carregar template de orçamento', error);
      throw new InternalServerErrorException(
        'Erro ao carregar template de PDF',
      );
    }
  }

  async generateEstimatePdf(estimate: any): Promise<Buffer> {
    if (!estimate) {
      throw new InternalServerErrorException('Dados inválidos');
    }

    try {
      const compiledTemplate = this.loadTemplate();

      const client = estimate.client || {};
      const tenant = estimate.tenant || {};

      let subtotal = 0;

      const items = (estimate.items || []).map((item: any) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const total = quantity * price;

        subtotal += total;

        return {
          description: item.description || '-',
          quantity,
          unitPrice: price.toFixed(2),
          total: total.toFixed(2),
        };
      });

      const html = compiledTemplate({
        estimateNumber: estimate.id,

        client: {
          name: client.name || '-',
          phone: client.phone || '-',
          vehicle: client.vehicle || '-',
          plate: client.plate || '-',
          document: client.document || '-',
          address: client.address || '-',
        },

        items,

        subtotal: subtotal.toFixed(2),
        issValue: '0.00',
        total: subtotal.toFixed(2),

        companyName: tenant.name || 'Empresa',
        companyDocument: tenant.documentNumber || '-',
        companyPhone: tenant.phone || '-',
        companyEmail: tenant.email || '-',

        status: estimate.status || 'DRAFT',

        issueDate: estimate.date
          ? new Date(estimate.date).toLocaleDateString('pt-BR')
          : '-',

        validUntil: '-',
      });

      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
      });

      await browser.close();

      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Erro ao gerar PDF', error);
      throw new InternalServerErrorException('Erro ao gerar PDF');
    }
  }
}