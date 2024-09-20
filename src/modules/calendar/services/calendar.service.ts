import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { ProviderType } from '@prisma/client';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { AuthService } from '@zenith/modules/auth/services/auth.service';
import { PinoLogger } from 'nestjs-pino';
import { CalendarDto, UpdateCalendarDto } from '../dtos/calendar';
import {
  Calendar,
  CalendarEvent,
  EventByDateReponse,
  EventProvider,
} from '../interfaces/calendar.interface';
import { Event, UpdateEvent } from '../interfaces/event.interface';
import { google, calendar_v3 } from 'googleapis';
import authenticationConfig from '@zenith/config/auth.config';
import _ from 'lodash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

@Injectable()
export class CalendarService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private prisma: PrismaService,
    private readonly authService: AuthService,
    @Inject(authenticationConfig.KEY)
    private readonly authConfig: ConfigType<typeof authenticationConfig>,
  ) {}

  async findAll(userId: number): Promise<Calendar[]> {
    const calendars = await this.prisma.calendar.findMany({
      where: {
        userId: userId,
        isDisabled: false,
      },
      include: {
        sourceCalendarVisibility: true,
      },
    });

    return _.map(calendars, (calendar) => {
      return new CalendarDto(calendar);
    });
  }

  async getOrCreateCalendar(
    userId: number,
    providerType: ProviderType,
    socialProfileId: number,
    loginTicket?: TokenPayload,
  ): Promise<Calendar | null> {
    let calendar = await this.prisma.calendar.findFirst({
      where: {
        email: loginTicket?.email,
        providerType: providerType,
        userId: userId,
        authenticatorId: socialProfileId,
      },
    });
    if (calendar == null) {
      const nameFromGG = `${loginTicket?.given_name ?? ''} ${
        loginTicket?.family_name ?? ''
      } calendar`.trim();
      const calendarNameExists = await this.prisma.calendar.findMany({
        where: {
          calendarNameUnique: {
            contains: nameFromGG
              .replace(/[" "]/g, '')
              .trim()
              .toLocaleLowerCase(),
          },
          userId: userId,
        },
      });
      const calendarName =
        calendarNameExists?.length > 0
          ? `${nameFromGG} ${calendarNameExists.length}`
          : nameFromGG;

      calendar = await this.prisma.calendar.create({
        data: {
          email: loginTicket.email,
          providerType: providerType,
          name: calendarName.trim(),
          calendarNameUnique: calendarName
            ?.replace(/[" "]/g, '')
            .trim()
            .toLocaleLowerCase(),
          profilePictureUrl: loginTicket?.picture,
          availableStartTime: dayjs().hour(9).toDate(),
          availableEndTime: dayjs().hour(17).toDate(),
          availableWeekDays: 31, // 0b0011111, Monday -> Friday
          user: {
            connect: {
              id: userId,
            },
          },
          authenticator: {
            connect: {
              id: socialProfileId,
            },
          },
          isDisabled: false,
        },
      });
    } else {
      if (calendar.isDisabled) {
        await this.prisma.calendar.update({
          where: {
            id: calendar.id,
          },
          data: {
            isDisabled: false,
          },
        });
      }
    }
    return new CalendarDto(calendar);
  }

  async connectGoogleCalendar(
    userId: number,
    code: string,
  ): Promise<Calendar | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const { tokenResponse, loginTicket } =
      await this.authService.getGoogleTokenResponse(code);

    const socialProfileData = {
      providerType: ProviderType.google,
      providerUserId: loginTicket.sub,
      accessToken: tokenResponse.tokens.access_token,
      refreshToken: tokenResponse.tokens.refresh_token,
    };
    this.logger.debug(
      socialProfileData,
      'constructed social profile for connecting Google calendar',
    );

    // Get or create social profile
    const socialProfile = await this.prisma.externalAuthenticator.upsert({
      where: {
        userId_providerType_providerUserId: {
          userId: user.id,
          providerType: ProviderType.google,
          providerUserId: loginTicket.sub,
        },
      },
      update: {
        accessToken: tokenResponse.tokens.access_token,
        refreshToken: tokenResponse.tokens.refresh_token,
      },
      create: {
        ...socialProfileData,
        userId: user.id,
      },
    });
    this.logger.debug(
      socialProfile,
      `created social profile for user ${user.email}`,
    );

    // Get or create calendar associated with social profile
    const calendar = await this.getOrCreateCalendar(
      userId,
      ProviderType.google,
      socialProfile.id,
      loginTicket,
    );
    return new CalendarDto(calendar);
  }

  async reconnectGoogleCalendar(
    userId: number,
    calendarId: number,
    code: string,
  ): Promise<Calendar | null> {
    const calendar = await this.prisma.calendar.findUnique({
      where: {
        id: calendarId,
      },
      include: {
        authenticator: true,
      },
    });
    if (!calendar) {
      throw new HttpException(
        { message: `Calendar #${calendarId} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Check ownership of the calendar
    if (calendar.userId != userId) {
      throw new HttpException(
        { message: `Unauthorized to access calendar #${calendarId}` },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { tokenResponse } = await this.authService.getGoogleTokenResponse(
      code,
    );
    // Update Google OAuth refresh_token, access_token
    await this.prisma.externalAuthenticator.update({
      where: {
        id: calendar.authenticator.id,
      },
      data: {
        refreshToken: tokenResponse.tokens.refresh_token,
        accessToken: tokenResponse.tokens.access_token,
        idToken: tokenResponse.tokens.id_token,
      },
    });

    return new CalendarDto(calendar);
  }

  async disconnectGoogleCalendar(userId: number, calendarId: number) {
    try {
      const [calendar] = await Promise.all([
        this.prisma.calendar.findUnique({
          where: {
            id: calendarId,
          },
          select: {
            email: true,
            authenticator: true,
          },
        }),
      ]);
      if (_.isEmpty(calendar)) {
        throw new HttpException(
          { message: `Calendar #${calendarId} not found` },
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.prisma.calendar.update({
        where: {
          id: calendarId,
        },
        data: {
          isDisabled: true,
        },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        return error;
      }
      this.logger.error(
        error,
        `failed disconnect calendar for user #${userId} and calendar #${calendarId}`,
      );
    }
  }

  async updateCalendar(
    userId: number,
    calendarId: number,
    data: UpdateCalendarDto,
  ): Promise<Calendar | null> {
    const calendarName = data?.name;
    const calendar = await this.prisma.calendar.findUnique({
      where: {
        id: calendarId,
      },
    });
    if (!calendar) {
      throw new HttpException(
        { message: `Calendar #${calendarId} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Check ownership of the calendar
    if (calendar.userId != userId) {
      throw new HttpException(
        { message: `Unauthorized to access calendar #${calendarId}` },
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const calendarNameExists = await this.prisma.calendar.findMany({
        where: {
          calendarNameUnique: calendarName
            .replace(/[" "]/g, '')
            .trim()
            .toLocaleLowerCase(),
          userId: userId,
          id: {
            notIn: calendarId,
          },
        },
      });
      if (calendarNameExists?.length > 0) {
        throw new HttpException(
          { message: `Calendar Name #${calendarName} is already exists` },
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.prisma.calendar.update({
        where: {
          id: calendar.id,
        },
        data: {
          name: data.name,
          colour: data.colour,
          profilePictureUrl: data.profilePictureUrl,
          backgroundPictureUrl: data.backgroundPictureUrl,
          logoUrl: data.logoUrl,
          availableStartTime:
            data?.availableStartTime != null
              ? dayjs(data.availableStartTime, 'HH:mm').toDate()
              : calendar.availableStartTime,
          availableEndTime:
            data?.availableEndTime != null
              ? dayjs(data.availableEndTime, 'HH:mm').toDate()
              : calendar.availableEndTime,
          availableWeekDays: data.availableWeekDays,
          calendarNameUnique: calendarName
            .replace(/[" "]/g, '')
            .trim()
            .toLocaleLowerCase(),
        },
      });

      for (const visibility of data.visibilities) {
        if (visibility.calendarId === calendar.id) {
          continue;
        }
        await this.prisma.calendarVisibility.upsert({
          where: {
            sourceId: calendarId,
          },
          create: {
            userId: userId,
            showAs: visibility.showAs,
            sourceId: calendarId,
          },
          update: {
            showAs: visibility.showAs,
          },
        });
      }

      // Remove all calendarVisibility entries if `Show as` is not selected
      if (data.visibilities.length == 0) {
        await this.prisma.calendarVisibility.deleteMany({
          where: {
            sourceId: calendarId,
            userId: userId,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        error,
        `failed update calendar #${calendarId} for user #${userId}`,
      );
      throw error;
    }

    return new CalendarDto(calendar);
  }

  async listEvents(
    userId: number,
    calendarId: number,
  ): Promise<CalendarEvent[] | null> {
    const calendar = await this.prisma.calendar.findUnique({
      where: {
        id: calendarId,
      },
      include: {
        authenticator: true,
      },
    });
    if (!calendar) {
      throw new HttpException(
        { message: `Calendar #${calendarId} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Check ownership of the calendar
    if (calendar.userId != userId) {
      throw new HttpException(
        { message: `Unauthorized to access calendar #${calendarId}` },
        HttpStatus.UNAUTHORIZED,
      );
    }
    let gEvents: CalendarEvent[] = [];
    let zenithGGevents: CalendarEvent[] = [];
    if (!calendar.isDisabled) {
      // Init Google OAuth2 Client
      const oauth2Client = new google.auth.OAuth2(
        this.authConfig.googleClientId,
        this.authConfig.googleClientSecret,
        this.authConfig.googleCallbackUrl,
      );
      oauth2Client.forceRefreshOnFailure = true;
      oauth2Client.setCredentials({
        access_token: calendar.authenticator.accessToken,
        refresh_token: calendar.authenticator.refreshToken,
      });
      const gCalendar: calendar_v3.Calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client,
      });
      try {
        // List all events from Google
        const res = await gCalendar.events.list({
          calendarId: 'primary',
          timeMin: dayjs.utc().subtract(30, 'days').format(),
          timeMax: dayjs.utc().add(30, 'days').format(),
          singleEvents: true,
        });

        gEvents = _.chain(res.data.items)
          .filter(
            (item) =>
              !_.has(item?.extendedProperties?.private, 'zenithEventId'),
          )
          .map((item) => {
            const startTime = _.get(
              item,
              'start.dateTime',
              dayjs.utc().format(),
            );
            const endTime = _.get(item, 'end.dateTime', dayjs.utc().format());
            const creatorEmail = _.get(item, 'creator.email', '');
            const creatorDisplayName = _.get(item, 'creator.displayName', '');
            const createdById = _.get(item, 'creator.id', '');
            return {
              id: item.id,
              gEventId: item.id,
              createdAt: item.created,
              updatedAt: item.updated,
              provider: EventProvider.GOOGLE,
              from: startTime,
              to: endTime,
              title: item.summary,
              details: item.description,
              creatorEmail: creatorEmail,
              creatorDisplayName: creatorDisplayName,
              createdById: createdById,
              eventLink: item.htmlLink,
              metadata: item,
              calendar: calendar,
            };
          })
          .value();

        zenithGGevents = _.chain(res.data.items)
          .filter((item) =>
            _.has(item?.extendedProperties?.private, 'zenithEventId'),
          )
          .map((item) => {
            const startTime = _.get(
              item,
              'start.dateTime',
              dayjs.utc().format(),
            );
            const endTime = _.get(item, 'end.dateTime', dayjs.utc().format());
            const creatorEmail = _.get(item, 'creator.email', '');
            const creatorDisplayName = _.get(item, 'creator.displayName', '');
            const createdById = _.get(item, 'creator.id', '');
            return {
              id: item.id,
              zenithEventId: item?.extendedProperties?.private?.zenithEventId,
              createdAt: item.created,
              updatedAt: item.updated,
              provider: EventProvider.GOOGLE,
              from: startTime,
              to: endTime,
              title: item.summary,
              details: item.description,
              creatorEmail: creatorEmail,
              creatorDisplayName: creatorDisplayName,
              createdById: createdById,
              eventLink: item.htmlLink,
              metadata: item,
              calendar: calendar,
            };
          })
          .value();
      } catch (error) {
        if (_.includes(error.message, 'invalid_grant')) {
          throw new HttpException(
            {
              message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendarId}`,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        // If the error is other than refresh token expired, we'll still process Zenith events as normal
        this.logger.error(
          error,
          `failed to list Google Events for calendar #${calendarId}`,
        );
      }
    }

    // List all events from Zenith
    const attendedZenithEvents = await this.prisma.eventAttendee.findMany({
      where: {
        userId: userId,
      },
      include: {
        event: true,
      },
    });

    const createdZenithEvents = await this.prisma.event.findMany({
      where: {
        createdById: userId,
      },
      include: {
        attendees: true,
      },
    });

    const zenithEvents: CalendarEvent[] = [
      ...createdZenithEvents,
      ...attendedZenithEvents.map((item) => {
        return item.event;
      }),
    ].map((item: Event) => {
      const eventFound = _.find(zenithGGevents, {
        zenithEventId: item?.id.toString(),
      });
      return {
        id: item.id,
        gEventId: eventFound?.id ?? '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        provider: EventProvider.ZENITH,
        from: item.from,
        to: item.to,
        details: item.details,
        title: item.title,
        createdById: item.createdById,
        eventLink: item.eventLink,
        calendar: calendar,
        attendees: item?.attendees ?? [],
      };
    });

    return [...gEvents, ...zenithEvents];
  }

  async updateCalendarBackground(
    calendarId: number,
    backgroundPictureUrl: string,
  ): Promise<Calendar> {
    const calendar = await this.prisma.calendar.update({
      where: {
        id: calendarId,
      },
      data: {
        backgroundPictureUrl: backgroundPictureUrl,
      },
    });
    return new CalendarDto(calendar);
  }

  async createEvent(
    calendarNameUnique: string,
    usernameUnique: string,
    from: Date,
    to: Date,
    title: string,
    attendee: string,
  ): Promise<Event> {
    const userFound = await this.prisma.user.findFirst({
      where: {
        usernameUnique: usernameUnique,
      },
    });
    if (!userFound) {
      throw new HttpException(
        { message: `User #${usernameUnique} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    const calendar = await this.prisma.calendar.findFirst({
      where: {
        calendarNameUnique: calendarNameUnique,
        userId: userFound.id,
      },
      include: {
        authenticator: true,
        sourceCalendarVisibility: true,
      },
    });
    if (!calendar) {
      throw new HttpException(
        { message: `Calendar #${calendarNameUnique} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    const event = await this.prisma.event.create({
      data: {
        calendarId: calendar?.id,
        createdById: calendar?.userId,
        from,
        to,
        title,
      },
    });

    if (event && attendee) {
      await this.prisma.eventAttendee.create({
        data: {
          eventId: event.id,
          email: attendee,
        },
      });
    }
    if (!calendar?.isDisabled) {
      // Init Google OAuth2 Client
      const oauth2Client = new google.auth.OAuth2(
        this.authConfig.googleClientId,
        this.authConfig.googleClientSecret,
        this.authConfig.googleCallbackUrl,
      );
      oauth2Client.forceRefreshOnFailure = true;
      oauth2Client.setCredentials({
        access_token: calendar.authenticator.accessToken,
        refresh_token: calendar.authenticator.refreshToken,
      });
      const gCalendar: calendar_v3.Calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client,
      });

      const ggEvent = {
        start: {
          dateTime: dayjs(from).format(),
        },
        end: {
          dateTime: dayjs(to).format(),
        },
        extendedProperties: {
          private: {
            zenithEventId: `${event.id}`,
            zenithCalendarId: `${calendar.id}`,
          },
        },
        summary: title,
        attendee: [
          {
            displayName: attendee,
            email: attendee,
          },
        ],
      };
      try {
        await gCalendar.events.insert({
          calendarId: 'primary',
          requestBody: ggEvent,
        });
      } catch (error) {
        if (_.includes(error.message, 'invalid_grant')) {
          throw new HttpException(
            {
              message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendar?.id}`,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        // If the error is other than refresh token expired, we'll still process Zenith events as normal
        this.logger.error(
          error,
          `failed to sync up event for #${calendar?.id}`,
        );
      }

      // Sync blocked event to remaining calendars
      if (calendar.sourceCalendarVisibility != null) {
        await this.createGGBlockedEvents(
          oauth2Client,
          calendar,
          event,
          ggEvent,
        );
      }
    }
    return event;
  }

  async updateEvent(
    calendarId: number,
    eventId: number,
    gEventId: string,
    userId: number,
    from: Date,
    to: Date,
    title: string,
    details: string,
    provider: string,
  ): Promise<UpdateEvent> {
    const calendar = await this.prisma.calendar.findUnique({
      where: {
        id: calendarId,
      },
      include: {
        authenticator: true,
      },
    });
    if (!calendar) {
      throw new HttpException(
        { message: `Calendar #${calendarId} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Check ownership of the calendar
    if (calendar.userId != userId) {
      throw new HttpException(
        { message: `Unauthorized to access calendar #${calendarId}` },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Init Google OAuth2 Client
    const oauth2Client = new google.auth.OAuth2(
      this.authConfig.googleClientId,
      this.authConfig.googleClientSecret,
      this.authConfig.googleCallbackUrl,
    );
    oauth2Client.forceRefreshOnFailure = true;
    oauth2Client.setCredentials({
      access_token: calendar.authenticator.accessToken,
      refresh_token: calendar.authenticator.refreshToken,
    });
    const gCalendar: calendar_v3.Calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client,
    });

    const gEventsFound = await gCalendar.events.get({
      calendarId: 'primary',
      eventId: gEventId,
    });

    if (!calendar?.isDisabled) {
      if (provider === EventProvider.GOOGLE) {
        const ggEvent = {
          start: {
            dateTime: dayjs(from).format(),
          },
          end: {
            dateTime: dayjs(to).format(),
          },
          summary: title ?? gEventsFound?.data?.summary ?? '',
          description: details ?? gEventsFound?.data?.description ?? '',
        };
        try {
          await gCalendar.events.update({
            calendarId: 'primary',
            requestBody: ggEvent,
            eventId: gEventId,
          });
        } catch (error) {
          if (_.includes(error.message, 'invalid_grant')) {
            throw new HttpException(
              {
                message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendarId}`,
              },
              HttpStatus.UNAUTHORIZED,
            );
          }
          // If the error is other than refresh token expired, we'll still process Zenith events as normal
          this.logger.error(
            error,
            `failed to sync up event for #${calendarId} with event #${gEventId}`,
          );
          throw error;
        }
      }
    }

    let updateEvent = null;
    if (provider === EventProvider.ZENITH) {
      const event = await this.prisma.event.findUnique({
        where: {
          id: eventId,
        },
      });
      if (!event) {
        throw new HttpException(
          { message: `Event #${eventId} not found` },
          HttpStatus.BAD_REQUEST,
        );
      }
      updateEvent = await this.prisma.event.update({
        where: {
          id: eventId,
        },
        data: {
          from,
          to,
          title,
          details,
        },
      });
      if (!calendar?.isDisabled) {
        const ggEvent = {
          start: {
            dateTime: dayjs(from).format(),
          },
          end: {
            dateTime: dayjs(to).format(),
          },
          summary: gEventsFound?.data?.summary ?? '',
          description: gEventsFound?.data?.description ?? '',
          extendedProperties: {
            private: {
              zenithEventId: `${eventId}`,
              zenithCalendarId: `${calendar.id}`,
            },
          },
        };

        try {
          await gCalendar.events.update({
            calendarId: 'primary',
            requestBody: ggEvent,
            eventId: gEventId,
          });
        } catch (error) {
          if (_.includes(error.message, 'invalid_grant')) {
            throw new HttpException(
              {
                message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendarId}`,
              },
              HttpStatus.UNAUTHORIZED,
            );
          }
          // If the error is other than refresh token expired, we'll still process Zenith events as normal
          this.logger.error(
            error,
            `failed to sync up event for #${calendarId} with event #${gEventId}`,
          );
          throw error;
        }

        // Update event in linked GG calendars
        await this.updateGGBlockedEvents(
          oauth2Client,
          calendar,
          event,
          gEventsFound,
        );
      }
    }

    return updateEvent;
  }

  async eventsByDate(
    calendarNameUnique: string,
    usernameUnique: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<EventByDateReponse | null> {
    const userFound = await this.prisma.user.findFirst({
      where: {
        usernameUnique: usernameUnique,
      },
    });

    const calendar = await this.prisma.calendar.findFirst({
      where: {
        calendarNameUnique: calendarNameUnique,
        userId: userFound?.id,
      },
      include: {
        authenticator: true,
      },
    });

    const calendarFindByUserExclusiveMainCalendar =
      await this.prisma.calendar.findMany({
        where: {
          userId: userFound?.id,
          calendarNameUnique: {
            notIn: calendarNameUnique,
          },
        },
        include: {
          authenticator: true,
        },
      });

    if (!calendar) {
      throw new HttpException(
        { message: `Calendar #${calendarNameUnique} not found` },
        HttpStatus.BAD_REQUEST,
      );
    }
    let gEvents: CalendarEvent[] = [];
    let zenithGGevents: CalendarEvent[] = [];
    let eventFromOtherCalendar: CalendarEvent[] = [];
    if (!calendar?.isDisabled) {
      // Init Google OAuth2 Client
      const oauth2Client = new google.auth.OAuth2(
        this.authConfig.googleClientId,
        this.authConfig.googleClientSecret,
        this.authConfig.googleCallbackUrl,
      );
      oauth2Client.forceRefreshOnFailure = true;
      oauth2Client.setCredentials({
        access_token: calendar.authenticator.accessToken,
        refresh_token: calendar.authenticator.refreshToken,
      });
      const gCalendar: calendar_v3.Calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client,
      });

      try {
        // List all events from Google
        const res = await gCalendar.events.list({
          calendarId: 'primary',
          timeMin: dayjs(rangeStart).utc().format(),
          timeMax: dayjs(rangeEnd).utc().format(),
          singleEvents: true,
        });

        gEvents = _.chain(res.data.items)
          .filter(
            (item) =>
              !_.has(item?.extendedProperties?.private, 'zenithEventId'),
          )
          .map((item) => {
            const startTime = _.get(item, 'start.dateTime', '');
            const endTime = _.get(item, 'end.dateTime', '');
            const dateStart = _.get(item, 'start.date', '');
            const isBlockMtgDate = !startTime && !endTime && dateStart;
            const creatorEmail = _.get(item, 'creator.email', '');
            const creatorDisplayName = _.get(item, 'creator.displayName', '');
            const createdById = _.get(item, 'creator.id', '');
            return {
              id: item.id,
              gEventId: item.id,
              createdAt: item.created,
              updatedAt: item.updated,
              provider: EventProvider.GOOGLE,
              from: isBlockMtgDate ? isBlockMtgDate : startTime,
              to: isBlockMtgDate ? isBlockMtgDate : endTime,
              title: item.summary,
              details: item.description,
              creatorEmail: creatorEmail,
              creatorDisplayName: creatorDisplayName,
              createdById: createdById,
              eventLink: item.htmlLink,
              metadata: item,
              calendar: calendar,
              isBlockWholeDayFromGG: isBlockMtgDate,
            };
          })
          .value();

        zenithGGevents = _.chain(res.data.items)
          .filter((item) =>
            _.has(item?.extendedProperties?.private, 'zenithEventId'),
          )
          .map((item) => {
            const startTime = _.get(
              item,
              'start.dateTime',
              dayjs.utc().format(),
            );
            const endTime = _.get(item, 'end.dateTime', dayjs.utc().format());
            const creatorEmail = _.get(item, 'creator.email', '');
            const creatorDisplayName = _.get(item, 'creator.displayName', '');
            const createdById = _.get(item, 'creator.id', '');
            return {
              id: item.id,
              zenithEventId: item?.extendedProperties?.private?.zenithEventId,
              createdAt: item.created,
              updatedAt: item.updated,
              provider: EventProvider.GOOGLE,
              from: startTime,
              to: endTime,
              title: item.summary,
              details: item.description,
              creatorEmail: creatorEmail,
              creatorDisplayName: creatorDisplayName,
              createdById: createdById,
              eventLink: item.htmlLink,
              metadata: item,
              calendar: calendar,
            };
          })
          .value();

        if (calendarFindByUserExclusiveMainCalendar?.length > 0) {
          await Promise.all(
            calendarFindByUserExclusiveMainCalendar.map(
              async (calendarOther: any) => {
                oauth2Client.setCredentials({
                  access_token: calendarOther.authenticator.accessToken,
                  refresh_token: calendarOther.authenticator.refreshToken,
                });
                const gCalendarOther: calendar_v3.Calendar = google.calendar({
                  version: 'v3',
                  auth: oauth2Client,
                });
                try {
                  const res = await gCalendarOther.events.list({
                    calendarId: 'primary',
                    timeMin: dayjs(rangeStart).utc().format(),
                    timeMax: dayjs(rangeEnd).utc().format(),
                    singleEvents: true,
                  });
                  const listEventFromCalendarOther = _.chain(res.data.items)
                    .filter(
                      (item) =>
                        !_.has(
                          item?.extendedProperties?.private,
                          'zenithEventId',
                        ),
                    )
                    .map((item) => {
                      const startTime = _.get(
                        item,
                        'start.dateTime',
                        dayjs.utc().format(),
                      );
                      const endTime = _.get(
                        item,
                        'end.dateTime',
                        dayjs.utc().format(),
                      );
                      const creatorEmail = _.get(item, 'creator.email', '');
                      const creatorDisplayName = _.get(
                        item,
                        'creator.displayName',
                        '',
                      );
                      const createdById = _.get(item, 'creator.id', '');
                      return {
                        id: item.id,
                        gEventId: item.id,
                        createdAt: item.created,
                        updatedAt: item.updated,
                        provider: EventProvider.GOOGLE,
                        from: startTime,
                        to: endTime,
                        title: item.summary,
                        details: item.description,
                        creatorEmail: creatorEmail,
                        creatorDisplayName: creatorDisplayName,
                        createdById: createdById,
                        eventLink: item.htmlLink,
                        metadata: item,
                        calendar: calendar,
                      };
                    })
                    .value();
                  if (listEventFromCalendarOther?.length > 0) {
                    eventFromOtherCalendar = [
                      ...listEventFromCalendarOther,
                      ...eventFromOtherCalendar,
                    ];
                  }
                } catch (error) {
                  this.logger.error(
                    error,
                    `failed to list Google Events for calendar #${calendarOther?.id}`,
                  );
                }
              },
            ),
          );
        }
      } catch (error) {
        if (_.includes(error.message, 'invalid_grant')) {
          throw new HttpException(
            {
              message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendar?.id}`,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        // If the error is other than refresh token expired, we'll still process Zenith events as normal
        this.logger.error(
          error,
          `failed to list Google Events for calendar #${calendar?.id}`,
        );
      }
    }

    // List all events from Zenith
    const attendedZenithEvents = await this.prisma.eventAttendee.findMany({
      where: {
        userId: calendar.userId,
      },
      include: {
        event: true,
      },
    });

    const createdZenithEvents = await this.prisma.event.findMany({
      where: {
        createdById: calendar.userId,
        from: {
          gte: dayjs(rangeStart).format(),
        },
        to: {
          lte: dayjs(rangeEnd).format(),
        },
      },
      include: {
        attendees: true,
      },
    });

    const zenithEvents: CalendarEvent[] = [
      ...createdZenithEvents,
      ...attendedZenithEvents.map((item) => {
        return item.event;
      }),
    ].map((item: Event) => {
      const eventFound = _.find(zenithGGevents, {
        zenithEventId: item?.id.toString(),
      });

      return {
        id: item.id,
        gEventId: eventFound?.id ?? '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        provider: EventProvider.ZENITH,
        from: item.from,
        to: item.to,
        details: item.details,
        createdById: item.createdById,
        eventLink: item.eventLink,
        calendar: calendar,
        attendees: item?.attendees ?? [],
      };
    });
    const user = await this.prisma.user.findUnique({
      where: {
        id: calendar.userId,
      },
    });

    const userInfo = _.omit(user, [
      'password',
      'confirmationToken',
      'confirmationTokenSentAt',
      'recoverySentAt',
      'recoveryToken',
      'resetPassToken',
      'resetPassTokenSentAt',
    ]);
    return {
      userInfo: userInfo ?? null,
      events: [...gEvents, ...zenithEvents, ...eventFromOtherCalendar],
    };
  }

  async createGGBlockedEvents(
    oauth2Client: OAuth2Client,
    calendar: Calendar,
    event: Event,
    ggEvent: any,
  ) {
    this.logger.info(`Syncing blocked event for calendar #${calendar.id}`);
    const connectedCalendars = await this.prisma.calendar.findMany({
      where: {
        userId: calendar.userId,
        NOT: {
          id: calendar.id,
        },
      },
      include: {
        authenticator: true,
      },
    });

    const blockedGGEvents = {};
    for (const aCalendar of connectedCalendars) {
      oauth2Client.setCredentials({
        access_token: aCalendar.authenticator.accessToken,
        refresh_token: aCalendar.authenticator.refreshToken,
      });
      this.logger.info(
        `Syncing blocked event for calendar #${calendar.id} to GG calendar ${aCalendar.email}`,
      );
      const updatedGgEvent = _.cloneDeep(ggEvent);
      _.set(
        updatedGgEvent,
        'summary',
        calendar?.sourceCalendarVisibility?.showAs || 'Blocked',
      );

      const gCalendar: calendar_v3.Calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client,
      });

      try {
        const gEvent = await gCalendar.events.insert({
          calendarId: 'primary',
          requestBody: updatedGgEvent,
        });
        _.set(blockedGGEvents, aCalendar.id, gEvent?.data?.id);
      } catch (error) {
        if (_.includes(error.message, 'invalid_grant')) {
          throw new HttpException(
            {
              message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendar?.id}`,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        // If the error is other than refresh token expired, we'll still process Zenith events as normal
        this.logger.error(
          error,
          `failed to sync up blocked event to ${aCalendar.email} for #${calendar?.id}`,
        );
      }
    }

    // Update event metadata
    await this.prisma.event.update({
      where: {
        id: +event.id,
      },
      data: {
        metadata: {
          linkedGGEvents: blockedGGEvents,
        },
      },
    });
  }

  async updateGGBlockedEvents(
    oauth2Client: OAuth2Client,
    calendar: Calendar,
    event: Event,
    ggEvent: any,
  ) {
    this.logger.info(`Updating block event for calendar #${calendar.id}`);
    const connectedCalendars = await this.prisma.calendar.findMany({
      where: {
        userId: calendar.userId,
        NOT: {
          id: calendar.id,
        },
      },
      include: {
        authenticator: true,
      },
    });

    for (const aCalendar of connectedCalendars) {
      const linkedGGEvent = _.get(
        event,
        `metadata.linkedGGEvents.${aCalendar.id}`,
      );
      if (_.isNil(linkedGGEvent)) {
        continue;
      }

      oauth2Client.setCredentials({
        access_token: aCalendar.authenticator.accessToken,
        refresh_token: aCalendar.authenticator.refreshToken,
      });
      this.logger.info(
        `Syncing block event for calendar #${calendar.id} to GG calendar ${aCalendar.email}`,
      );
      const updatedGgEvent = _.cloneDeep(ggEvent);
      _.set(
        updatedGgEvent,
        'summary',
        calendar?.sourceCalendarVisibility?.showAs || 'Blocked',
      );

      const gCalendar: calendar_v3.Calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client,
      });

      try {
        await gCalendar.events.update({
          calendarId: 'primary',
          requestBody: updatedGgEvent,
        });
      } catch (error) {
        if (_.includes(error.message, 'invalid_grant')) {
          throw new HttpException(
            {
              message: `Google OAuth refresh token expired. Need to reconnect calendar #${calendar?.id}`,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        // If the error is other than refresh token expired, we'll still process Zenith events as normal
        this.logger.error(
          error,
          `failed to update blocked event to ${aCalendar.email} for #${calendar?.id}`,
        );
      }
    }
  }
}
