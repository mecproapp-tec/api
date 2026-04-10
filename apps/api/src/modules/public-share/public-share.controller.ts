import { Controller, Get, Param } from '@nestjs/common';
import { PublicShareService } from './public-share.service';

@Controller('public')
export class PublicShareController {
  constructor(private service: PublicShareService) {}

  @Get('share/:token')
  async get(@Param('token') token: string) {
    return this.service.getPublicData(token);
  }
}