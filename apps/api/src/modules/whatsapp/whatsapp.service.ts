import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  generateWhatsAppLink(phone: string, message: string): string {
    if (!phone) {
      throw new BadRequestException('Telefone é obrigatório');
    }

    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanPhone) {
      throw new BadRequestException('Telefone inválido');
    }

    const formattedPhone = cleanPhone.startsWith('55')
      ? cleanPhone
      : `55${cleanPhone}`;

    const encodedMessage = encodeURIComponent(message.trim());

    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }
}