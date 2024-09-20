import {
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PinoLogger } from 'nestjs-pino';
import { AppService } from './app.service';
import { UploadResponseDto } from './common/dtos/upload.dto';
import { JwtAuthGuard } from './modules/auth/guards/jwt.guard';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req,
    @UploadedFile() file: any,
  ): Promise<UploadResponseDto> {
    this.logger.info(
      `User ${req.user.id} uploaded file: ${file?.originalname}`,
    );
    const data = {
      originalName: file?.originalname,
      fileName: file.filename,
      url: file.linkUrl,
    };
    return data;
  }
}
