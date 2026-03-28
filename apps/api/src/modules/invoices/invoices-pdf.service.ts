import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { BrowserPoolService } from '../../shared/browser-pool.service';

@Injectable()
export class InvoicesPdfService {
  private readonly logger = new Logger(InvoicesPdfService.name);

  constructor(private readonly browserPool: BrowserPoolService) {}

  async generateInvoicePdf(invoice: any, tenant: any): Promise<Buffer> {
    this.logger.log(`Gerando PDF da fatura ${invoice.id}`);

    try {
      // 1. Extrair dados do cliente com valores padrão
      const client = invoice.client || {};
      const vehicleDetails =
        client?.vehicleBrand && client?.vehicleModel
          ? `${client.vehicleBrand} ${client.vehicleModel}${client.vehicleYear ? ` ${client.vehicleYear}` : ''}${client.vehicleColor ? ` - ${client.vehicleColor}` : ''}`.trim()
          : client?.vehicle || 'Não informado';
      const plate = client?.plate || 'Não informado';

      // 2. Processar itens e totais (garantir que items seja array)
      const itemsArray = invoice.items || [];
      let subtotal = 0;
      let issTotal = 0;
      const items = itemsArray.map((item: any) => {
        const quantity = item.quantity || 1;
        const price = item.price || 0;
        const itemTotal = price * quantity;
        const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;
        subtotal += itemTotal;
        issTotal += iss;
        return {
          description: item.description || 'Item não descrito',
          quantity,
          unitPrice: price.toFixed(2),
          issPercent: item.issPercent || 0,
          total: (itemTotal + iss).toFixed(2),
        };
      });
      const total = subtotal + issTotal;

      // 3. Datas e status
      const issueDate = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
      const dueDate = ''; // opcional
      const statusMap: Record<string, string> = {
        PENDING: 'Pendente',
        PAID: 'Paga',
        CANCELED: 'Cancelada',
      };
      const status = statusMap[invoice.status] || invoice.status || 'Pendente';

      // 4. Dados da oficina (com fallback)
      const companyName = tenant?.name || process.env.COMPANY_NAME || 'Oficina Mecânica';
      const companyDocument = tenant?.documentNumber || process.env.COMPANY_DOCUMENT || '00.000.000/0001-00';
      const companyPhone = tenant?.phone || process.env.COMPANY_PHONE || '(11) 1234-5678';
      const companyEmail = tenant?.email || process.env.COMPANY_EMAIL || 'contato@oficina.com';
      const logoUrl = tenant?.logoUrl || process.env.LOGO_URL || '';

      // 5. Carregar template (com fallback)
      let templateContent: string;
      const templatePath = path.join(__dirname, 'invoice-pdf.hbs');
      try {
        templateContent = await readFile(templatePath, 'utf-8');
        this.logger.log(`Template carregado de ${templatePath}`);
      } catch (err: any) {
        this.logger.warn(`Template não encontrado em ${templatePath}, usando fallback inline. Erro: ${err.message}`);
        // Fallback inline mais robusto (evita variáveis undefined)
        templateContent = `<!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Fatura #{{invoiceNumber}}</title></head>
        <body>
          <h1>Fatura #{{invoiceNumber}}</h1>
          <p><strong>Cliente:</strong> {{client.name}}</p>
          <p><strong>Veículo:</strong> {{client.vehicle}}</p>
          <p><strong>Placa:</strong> {{client.plate}}</p>
          <p><strong>Total:</strong> R$ {{total}}</p>
          <p><strong>Status:</strong> {{status}}</p>
        </body>
        </html>`;
      }

      const compiledTemplate = Handlebars.compile(templateContent);
      const data = {
        invoiceNumber: invoice.number || 'SEM NÚMERO',
        client: {
          name: client.name || 'Cliente não informado',
          document: client.document || 'Não informado',
          address: client.address || 'Não informado',
          phone: client.phone || 'Não informado',
          vehicle: vehicleDetails,
          plate,
        },
        issueDate,
        dueDate,
        status,
        items,
        subtotal: subtotal.toFixed(2),
        issValue: issTotal.toFixed(2),
        total: total.toFixed(2),
        companyName,
        companyDocument,
        companyPhone,
        companyEmail,
        logoUrl,
      };

      const html = compiledTemplate(data);
      this.logger.debug(`HTML gerado, tamanho: ${html.length}`);

      // 6. Gerar PDF com Puppeteer
      this.logger.log('Obtendo navegador do pool...');
      const browser = await this.browserPool.getBrowser();
      this.logger.log('Navegador obtido, criando página...');
      const page = await browser.newPage();

      // Interceptar requisições para não esperar por imagens/fontes (acelera e evita erros)
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });

      this.logger.log('Definindo conteúdo HTML...');
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });

      this.logger.log('Gerando PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
        timeout: 60000,
      });

      await page.close();
      this.logger.log(`PDF gerado com sucesso, tamanho: ${pdfBuffer.length} bytes`);
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(`Erro ao gerar PDF da fatura ${invoice.id}:`, error.stack);
      throw new InternalServerErrorException('Erro ao gerar PDF da fatura. Verifique os logs.');
    }
  }
}