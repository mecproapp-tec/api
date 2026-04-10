<h1 style="color:red">TESTE NOVO 🔥🔥🔥</h1>



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


export class InvoicesPdfService {
  private readonly logger = new Logger(InvoicesPdfService.name);

  constructor() {
    this.logger.log('InvoicesPdfService inicializado');
  }

  private loadTemplate(): HandlebarsTemplateDelegate {
    try {
      const templatePath = path.join(__dirname, 'invoices-pdf.hbs');

      this.logger.log(`Carregando template: ${templatePath}`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template não encontrado em: ${templatePath}`);
      }

      const templateHtml = fs.readFileSync(templatePath, 'utf-8');

      return Handlebars.compile(templateHtml);
    } catch (error) {
      this.logger.error('Erro ao carregar template de fatura', error);
      throw new InternalServerErrorException(
        'Erro ao carregar template de PDF',
      );
    }
  }

  

  async generateInvoicePdf(invoice: any): Promise<Buffer> {
    if (!invoice) {
      throw new InternalServerErrorException('Dados inválidos');
    }

    try {
      const compiledTemplate = this.loadTemplate();

      let total = 0;

      const items = (invoice.items || []).map((item: any) => {
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const itemTotal = quantity * price;

        total += itemTotal;

        return {
          description: item.description || '-',
          quantity,
          unitPrice: price.toFixed(2),
          total: itemTotal.toFixed(2),
        };
      });

      const html = compiledTemplate({
        invoiceNumber: invoice.number || invoice.id,

        client: {
          name: invoice.client?.name || '-',
        },

        items,

        total: total.toFixed(2),

        companyName: invoice.tenant?.name || 'Empresa',
        companyPhone: invoice.tenant?.phone || '-',
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
      this.logger.error('Erro ao gerar PDF da fatura', error);
      throw new InternalServerErrorException('Erro ao gerar PDF');
    }
  }
}