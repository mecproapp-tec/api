import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionGuard } from '../../auth/guards/session.guard';
import { Public } from '../../auth/public.decorator';

@Controller('contact')
export class ContactController {
  @Public()
  @Post()
  async sendContact(@Body() data: any) {
    return { message: 'Mensagem de contato enviada', data };
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, SessionGuard)
  async getContacts() {
    return { message: 'Lista de contatos' };
  }
}