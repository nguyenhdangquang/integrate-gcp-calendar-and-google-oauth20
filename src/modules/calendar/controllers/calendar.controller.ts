import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@zenith/modules/auth/guards/jwt.guard';
import { PinoLogger } from 'nestjs-pino';
import {
  UpdateCalendarDto,
  CreateEventDto,
  UpdateEventBodyDto,
} from '../dtos/calendar';
import {
  ConnectGoogleCalendarDto,
  DisconnectGoogleCalendarDto,
  ReConnectGoogleCalendarDto,
} from '../dtos/connect';
import { CalendarService } from '../services/calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly logger: PinoLogger,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/connect/google')
  async connectGoogleCalendar(
    @Req() req,
    @Body() body: ConnectGoogleCalendarDto,
  ) {
    const userId = req.user?.customerId || req.user.id;
    return this.calendarService.connectGoogleCalendar(+userId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/disconnect/google')
  async disconnectGoogleCalendar(
    @Req() req,
    @Body() body: DisconnectGoogleCalendarDto,
  ) {
    const userId = req.user?.customerId || req.user.id;
    return this.calendarService.disconnectGoogleCalendar(
      +userId,
      body.calendarId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/reconnect/google')
  async reconnectGoogleCalendar(
    @Req() req,
    @Body() body: ReConnectGoogleCalendarDto,
  ) {
    const userId = req.user?.customerId || req.user.id;
    return this.calendarService.reconnectGoogleCalendar(
      +userId,
      +body.calendarId,
      body.code,
    );
  }

  /**
   * findAll
   */
  @UseGuards(JwtAuthGuard)
  @Get('/listing')
  async findAll(@Req() req) {
    const userId = req.user?.customerId || req.user.id;
    return this.calendarService.findAll(+userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/:calendarId')
  async updateCalendar(
    @Req() req,
    @Param('calendarId') calendarId: string,
    @Body() data: UpdateCalendarDto,
  ) {
    const userId = req.user?.customerId || req.user.id;
    return this.calendarService.updateCalendar(+userId, +calendarId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:calendarId/events')
  async listEvents(@Req() req, @Param('calendarId') calendarId: string) {
    const userId = req.user?.customerId || req.user.id;
    return this.calendarService.listEvents(+userId, +calendarId);
  }

  /**
   * Create Event
   */
  @Post('/:calendarNameUnique/events')
  async createEvent(
    @Body() body: CreateEventDto,
    @Param('calendarNameUnique') calendarNameUnique: string,
  ) {
    const { from, to, title, attendee, usernameUnique } = body;
    return this.calendarService.createEvent(
      calendarNameUnique,
      usernameUnique,
      from,
      to,
      title,
      attendee,
    );
  }

  /**
   * Update Event
   */
  @UseGuards(JwtAuthGuard)
  @Put('/:calendarId/events/:eventId')
  async updateEvent(
    @Req() req,
    @Body() body: UpdateEventBodyDto,
    @Param('calendarId') calendarId: number,
    @Param('eventId') eventId: number,
  ) {
    const userId = req.user?.customerId || req.user.id;
    const { from, to, title, details, provider, gEventId } = body;
    return this.calendarService.updateEvent(
      calendarId,
      eventId,
      gEventId,
      userId,
      from,
      to,
      title,
      details,
      provider,
    );
  }

  @Get('/:calendarNameUnique/events-by-date')
  async eventsByDate(
    @Param('calendarNameUnique') calendarNameUnique: string,
    @Query('range_start') rangeStart: Date,
    @Query('range_end') rangeEnd: Date,
    @Query('user_unique_name') usernameUnique: string,
  ) {
    return this.calendarService.eventsByDate(
      calendarNameUnique,
      usernameUnique,
      rangeStart,
      rangeEnd,
    );
  }
}
