import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Get('*')
  async getFile(
    @Param() params: any,
    @Res() res: Response,
  ) {
    try {
      const key = Object.values(params).join('/');

      const file = await this.storageService.getFile(key);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      });

      return res.send(file);
    } catch (error) {
      throw new NotFoundException('Arquivo não encontrado');
    }
  }
}