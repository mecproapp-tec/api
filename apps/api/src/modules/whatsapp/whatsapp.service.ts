import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  generateWhatsAppLink(phone: string, message: string): string {
    if (!phone) {
      throw new Error('Phone is required');
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const formattedPhone = cleanPhone.startsWith('55')
      ? cleanPhone
      : `55${cleanPhone}`;

    const encodedMessage = encodeURIComponent(message.trim());

    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }
}