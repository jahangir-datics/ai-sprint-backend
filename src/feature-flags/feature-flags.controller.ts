import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { FeatureFlagsService } from './feature-flags.service.js';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto.js';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto.js';
import { ListFeatureFlagsQueryDto } from './dto/list-feature-flags-query.dto.js';
import { EvaluateFlagDto } from './dto/evaluate-flag.dto.js';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  // Evaluation endpoint - any authenticated user (no ADMIN restriction)
  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluate a feature flag for a user' })
  @ApiResponse({ status: 200, description: 'Evaluation complete' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async evaluate(@Body() dto: EvaluateFlagDto) {
    const result = await this.featureFlagsService.evaluate(
      dto.flagKey,
      dto.userId,
      dto.userRoles,
    );
    return {
      data: result,
      message: 'Evaluation complete',
      statusCode: 200,
    };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a feature flag' })
  @ApiResponse({ status: 201, description: 'Feature flag created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Duplicate key' })
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateFeatureFlagDto,
  ) {
    const flag = await this.featureFlagsService.create(dto, user.id);
    return {
      data: flag,
      message: 'Feature flag created',
      statusCode: 201,
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved' })
  async findAll(@Query() query: ListFeatureFlagsQueryDto) {
    return this.featureFlagsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a feature flag by ID' })
  @ApiResponse({ status: 200, description: 'Feature flag retrieved' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.featureFlagsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    const flag = await this.featureFlagsService.update(id, dto, user.id);
    return {
      data: flag,
      message: 'Feature flag updated',
      statusCode: 200,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag deleted' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.featureFlagsService.remove(id);
    return {
      data: result,
      message: 'Feature flag deleted',
      statusCode: 200,
    };
  }
}
