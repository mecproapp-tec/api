import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class BrowserPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private browser: puppeteer.Browser | null = null;
  private isLaunching = false;

  async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser) return this.browser;

    if (this.isLaunching) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return this.getBrowser();
    }

    this.isLaunching = true;

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });

      this.logger.log('Browser launched');
      return this.browser;
    } catch (error) {
      this.logger.error('Erro ao iniciar Puppeteer', error);
      throw error;
    } finally {
      this.isLaunching = false;
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Browser closed');
    }
  }
}