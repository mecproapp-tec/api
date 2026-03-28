import dayjs = require('dayjs');
import utc = require('dayjs/plugin/utc');
import timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

const BRAZIL_TZ = 'America/Sao_Paulo';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Converte a string do frontend para UTC, assumindo que ela representa
   * um horário no fuso do Brasil (America/Sao_Paulo).
   */
  private convertToUTC(dateString: string): Date {
    const local = dayjs(dateString, { local: true });
    if (!local.isValid()) {
      throw new BadRequestException('Data inválida');
    }
    const brazilTime = local.tz(BRAZIL_TZ);
    return brazilTime.utc().toDate();
  }

  /**
   * Converte data do banco (UTC) para string no fuso Brasil.
   */
  private convertToBrazil(date: Date): string {
    return dayjs(date).tz(BRAZIL_TZ).format();
  }

  /**
   * Verifica se a data (no fuso Brasil) é futura.
   */
  private isFuture(dateString: string): boolean {
    const local = dayjs(dateString, { local: true });
    const brazilTime = local.tz(BRAZIL_TZ);
    const nowBrazil = dayjs().tz(BRAZIL_TZ);
    return brazilTime.isAfter(nowBrazil);
  }

  async create(
    tenantId: string,
    data: { clientId: number; date: string; comment?: string },
  ) {
    if (!this.isFuture(data.date)) {
      throw new BadRequestException('Não é possível agendar no passado');
    }

    const appointmentDate = this.convertToUTC(data.date);

    const appointment = await this.prisma.appointment.create({
      data: {
        clientId: data.clientId,
        tenantId,
        date: appointmentDate,
        comment: data.comment,
      },
      include: { client: true },
    });

    return {
      ...appointment,
      date: this.convertToBrazil(appointment.date),
    };
  }

  async findAll(tenantId: string, userRole?: string) {
    const where: any = {};
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: { client: true },
      orderBy: { date: 'desc' },
    });

    return appointments.map((app) => ({
      ...app,
      date: this.convertToBrazil(app.date),
    }));
  }

  async findOne(id: number, tenantId: string, userRole?: string) {
    const where: any = { id };
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }

    const appointment = await this.prisma.appointment.findFirst({
      where,
      include: { client: true },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return {
      ...appointment,
      date: this.convertToBrazil(appointment.date),
    };
  }

  async update(
    id: number,
    tenantId: string,
    data: { clientId: number; date: string; comment?: string },
    userRole?: string,
  ) {
    await this.findOne(id, tenantId, userRole);

    if (!this.isFuture(data.date)) {
      throw new BadRequestException('Não é possível agendar no passado');
    }

    const appointmentDate = this.convertToUTC(data.date);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        clientId: data.clientId,
        date: appointmentDate,
        comment: data.comment,
      },
      include: { client: true },
    });

    return {
      ...updated,
      date: this.convertToBrazil(updated.date),
    };
  }

  async remove(id: number, tenantId: string, userRole?: string) {
    await this.findOne(id, tenantId, userRole);
    await this.prisma.appointment.delete({ where: { id } });
    return { message: 'Agendamento removido com sucesso' };
  }
}