import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionGuard } from '../../auth/guards/session.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

interface UserPayload {
  id: number;
  tenantId: string;
  role: string;
  sessionToken: string;
}

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, SessionGuard)
export class WhatsappController {
  @Post('send-link')
  async generateWhatsAppLink(
    @Body() body: { phoneNumber: string; message: string },
    @CurrentUser() user: UserPayload,
  ) {
    const cleanPhone = body.phoneNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(body.message);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
    
    return {
      success: true,
      whatsappUrl,
      message: 'Clique no link para enviar pelo WhatsApp',
      tenantId: user.tenantId,
    };
  }
}