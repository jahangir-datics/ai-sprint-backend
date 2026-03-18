import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AuditService } from './audit.service.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Audit logs fetched' })
  async findAll(@Query() query: QueryAuditLogsDto) {
    const result = await this.auditService.findAll(query);
    return {
      data: result,
      message: 'Audit logs fetched successfully',
      statusCode: 200,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log detail' })
  @ApiResponse({ status: 200, description: 'Audit log fetched' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const log = await this.auditService.findOne(id);
    return {
      data: log,
      message: 'Audit log fetched successfully',
      statusCode: 200,
    };
  }
}
