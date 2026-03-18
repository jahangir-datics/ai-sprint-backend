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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhookEventsService } from './webhook-events.service.js';
import { CreateWebhookDto } from './dto/create-webhook.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { ListWebhooksQueryDto } from './dto/list-webhooks-query.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { TestWebhookDto } from './dto/test-webhook.dto.js';
import {
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_EVENT_DESCRIPTIONS,
} from './webhook-event-types.js';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly webhookEventsService: WebhookEventsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWebhookDto,
  ) {
    const webhook = await this.webhooksService.create(user.id, dto);
    return {
      data: webhook,
      message: 'Webhook created successfully',
      statusCode: 201,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List current user webhooks' })
  @ApiResponse({ status: 200, description: 'Webhooks retrieved' })
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() query: ListWebhooksQueryDto,
  ) {
    return this.webhooksService.findAll(user.id, query);
  }

  // Static route must come before :id
  @Get('event-types')
  @ApiOperation({ summary: 'List supported webhook event types' })
  @ApiResponse({ status: 200, description: 'Event types retrieved' })
  getEventTypes() {
    const items = WEBHOOK_EVENT_TYPES.map((key) => ({
      key,
      description: WEBHOOK_EVENT_DESCRIPTIONS[key],
    }));
    return { items };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific webhook' })
  @ApiResponse({ status: 200, description: 'Webhook retrieved' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooksService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook configuration' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    const webhook = await this.webhooksService.update(user.id, id, dto);
    return {
      data: webhook,
      message: 'Webhook updated successfully',
      statusCode: 200,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.webhooksService.remove(user.id, id);
    return {
      data: result,
      message: 'Webhook deleted successfully',
      statusCode: 200,
    };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook activated' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async activate(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.webhooksService.activate(user.id, id);
    return {
      data: result,
      message: 'Webhook activated',
      statusCode: 200,
    };
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deactivated' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async deactivate(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.webhooksService.deactivate(user.id, id);
    return {
      data: result,
      message: 'Webhook deactivated',
      statusCode: 200,
    };
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a test delivery' })
  @ApiResponse({ status: 200, description: 'Test event queued' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async testDelivery(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestWebhookDto,
  ) {
    // Verify ownership first
    await this.webhooksService.findOne(user.id, id);
    const result = await this.webhookEventsService.createTestEvent(
      id,
      dto.eventType,
    );
    return {
      data: result,
      message: 'Test event queued',
      statusCode: 200,
    };
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List events for a webhook' })
  @ApiResponse({ status: 200, description: 'Events retrieved' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async listEvents(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.webhookEventsService.findByWebhook(user.id, id, query);
  }

  @Get(':id/events/:eventId')
  @ApiOperation({ summary: 'Get a single webhook event' })
  @ApiResponse({ status: 200, description: 'Event retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEvent(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.webhookEventsService.findOne(user.id, id, eventId);
  }

  @Get(':id/events/:eventId/deliveries')
  @ApiOperation({ summary: 'Get delivery attempts for an event' })
  @ApiResponse({ status: 200, description: 'Deliveries retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getDeliveries(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.webhookEventsService.getDeliveries(user.id, id, eventId);
  }

  @Post(':id/events/:eventId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually retry a failed event' })
  @ApiResponse({ status: 200, description: 'Event queued for retry' })
  @ApiResponse({ status: 400, description: 'Event is not in failed state' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async retryEvent(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    const result = await this.webhookEventsService.retry(user.id, id, eventId);
    return {
      data: result,
      message: 'Event queued for retry',
      statusCode: 200,
    };
  }
}
