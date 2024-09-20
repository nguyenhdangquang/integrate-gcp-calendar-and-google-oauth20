import { IsOptional } from 'class-validator';

export class UploadResponseDto {
  readonly originalName: string;

  readonly fileName: string;

  @IsOptional()
  readonly url: string;
}
