import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { EstimatesService } from './estimates.service';
import { CreateEstimateDto } from './dto/create-estimate.dto';

interface UserPayload {
  id: number;
  tenantId: string;
  role: string;
  sessionToken: string;
}

@UseGuards(JwtAuthGuard)
@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Get()
  async findAll(@CurrentUser() user: UserPayload) {
    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }
    if (!user.tenantId) {
      throw new BadRequestException('TenantId não encontrado no token');
    }
    try {
      return await this.estimatesService.findAll(user.tenantId);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Erro ao buscar orçamentos');
    }
  }

  @Get('me')
  async getMe(@CurrentUser() user: UserPayload) {
    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }
    return { user, hasTenantId: !!user?.tenantId };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('TenantId não encontrado');
    }
    const estimateId = this.parseId(id);
    try {
      return await this.estimatesService.findOne(estimateId, user.tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Erro ao buscar orçamento');
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateEstimateDto, @CurrentUser() user: UserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('TenantId não encontrado');
    }
    try {
      return await this.estimatesService.create({
        tenantId: user.tenantId,
        clientId: createDto.clientId,
        items: createDto.items,
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Erro ao criar orçamento');
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('TenantId não encontrado');
    }
    const estimateId = this.parseId(id);
    try {
      await this.estimatesService.remove(estimateId, user.tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Erro ao deletar orçamento');
    }
  }

  @Post(':id/send-whatsapp')
  async sendToWhatsApp(
    @Param('id') id: string,
    @Body('phoneNumber') phoneNumber: string,
    @CurrentUser() user: UserPayload,
  ) {
    if (!user?.tenantId) throw new BadRequestException('TenantId não encontrado');
    if (!phoneNumber) throw new BadRequestException('Número de telefone é obrigatório');
    const estimateId = this.parseId(id);
    try {
      return await this.estimatesService.sendToWhatsApp(estimateId, user.tenantId, phoneNumber);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Erro ao enviar WhatsApp');
    }
  }

  @Post(':id/resend-pdf')
  async resendPdf(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    if (!user?.tenantId) throw new BadRequestException('TenantId não encontrado');
    const estimateId = this.parseId(id);
    try {
      return await this.estimatesService.resendPdf(estimateId, user.tenantId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Erro ao regenerar PDF');
    }
  }

  private parseId(id: string): number {
    const numericId = Number(id);
    if (isNaN(numericId)) {
      throw new BadRequestException('ID inválido');
    }
    return numericId;
  }
}