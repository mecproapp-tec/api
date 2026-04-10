import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { EstimatesService } from './estimates.service';

@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Post()
  create(@Req() req, @Body() data: any) {
    return this.estimatesService.create(req.user.tenantId, data);
  }

  @Get()
  findAll(@Req() req) {
    return this.estimatesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.estimatesService.findOne(Number(id), req.user.tenantId);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.estimatesService.remove(Number(id), req.user.tenantId);
  }
}