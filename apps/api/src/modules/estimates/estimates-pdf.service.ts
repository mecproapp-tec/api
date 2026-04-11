import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

@Injectable()
export class EstimatesPdfService {
  private readonly logger = new Logger(EstimatesPdfService.name);
  private templateCache: HandlebarsTemplateDelegate | null = null;

  constructor() {
    this.logger.log('EstimatesPdfService inicializado');
  }

  private loadTemplate(): HandlebarsTemplateDelegate {
    if (this.templateCache) {
      return this.templateCache;
    }

    try {
      let templatePath: string | null = null;
      const possiblePaths = [
        path.join(__dirname, 'estimates-pdf.hbs'),
        path.join(__dirname, '..', 'estimates', 'estimates-pdf.hbs'),
        path.join(process.cwd(), 'dist', 'modules', 'estimates', 'estimates-pdf.hbs'),
        path.join(process.cwd(), 'src', 'modules', 'estimates', 'estimates-pdf.hbs'),
      ];

      for (const tryPath of possiblePaths) {
        if (fs.existsSync(tryPath)) {
          templatePath = tryPath;
          this.logger.log(`Template encontrado em: ${tryPath}`);
          break;
        }
      }

      if (!templatePath) {
        throw new Error(`Template não encontrado. Procurado em: ${possiblePaths.join(', ')}`);
      }

      const templateHtml = fs.readFileSync(templatePath, 'utf-8');
      this.templateCache = Handlebars.compile(templateHtml);
      return this.templateCache;
    } catch (error) {
      this.logger.error('Erro ao carregar template de orçamento', error);
      throw new InternalServerErrorException('Erro ao carregar template de PDF');
    }
  }

  async generateEstimatePdf(estimate: any): Promise<Buffer> {
    if (!estimate) {
      throw new InternalServerErrorException('Dados inválidos para gerar PDF');
    }

    let browser = null;
    
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
          quantity: quantity,
          unitPrice: price.toFixed(2),
          total: total.toFixed(2),
        };
      });

      const issueDateObj = estimate.date ? new Date(estimate.date) : new Date();
      const validUntilObj = new Date(issueDateObj);
      validUntilObj.setDate(validUntilObj.getDate() + 30);

      const html = compiledTemplate({
        estimateNumber: estimate.id,
        status: estimate.status === 'DRAFT' ? 'RASCUNHO' : estimate.status === 'SENT' ? 'ENVIADO' : 'APROVADO',
        
        client: {
          name: client.name || 'Cliente não informado',
          phone: client.phone || '-',
          vehicle: client.vehicle || '-',
          plate: client.plate || '-',
          document: client.document || '-',
          address: client.address || '-',
        },
        
        items: items,
        
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        
        companyName: tenant.name || 'MecPro',
        companyDocument: tenant.documentNumber || 'CNPJ: --',
        companyPhone: tenant.phone || '(11) 99999-9999',
        companyEmail: tenant.email || 'contato@mecpro.com.br',
        
        issueDate: issueDateObj.toLocaleDateString('pt-BR'),
        validUntil: validUntilObj.toLocaleDateString('pt-BR'),
      });

      this.logger.log(`Gerando PDF para orçamento ${estimate.id} (${items.length} itens)`);

      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
        headless: true,
      });

      const page = await browser.newPage();
      
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px',
        },
      });

      this.logger.log(`PDF gerado com sucesso: ${pdf.length} bytes`);
      return Buffer.from(pdf);
      
    } catch (error) {
      this.logger.error(`Erro ao gerar PDF para orçamento ${estimate.id}`, error);
      throw new InternalServerErrorException(`Erro ao gerar PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}