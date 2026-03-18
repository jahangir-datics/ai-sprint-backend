import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ActivityService } from './activity.service.js';
import { QueryActivityDto } from './dto/query-activity.dto.js';

@ApiTags('Activity Feed')
@ApiBearerAuth()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user activity feed' })
  @ApiResponse({ status: 200, description: 'Activity feed fetched' })
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() query: QueryActivityDto,
  ) {
    const result = await this.activityService.findAll(user.id, query);
    return {
      data: result,
      message: 'Activity feed fetched successfully',
      statusCode: 200,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific activity entry' })
  @ApiResponse({ status: 200, description: 'Activity entry fetched' })
  @ApiResponse({ status: 404, description: 'Activity not found' })
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const activity = await this.activityService.findOne(user.id, id);
    return {
      data: activity,
      message: 'Activity entry fetched successfully',
      statusCode: 200,
    };
  }
}
