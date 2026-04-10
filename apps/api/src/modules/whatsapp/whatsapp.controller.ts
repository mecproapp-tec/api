import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private whatsappService: WhatsappService) {}

  @Post('link')
  async generateLink(@Body() dto: { phone: string; message: string }) {
    const link = this.whatsappService.generateWhatsAppLink(
      dto.phone,
      dto.message,
    );

    return { link };
  }
}