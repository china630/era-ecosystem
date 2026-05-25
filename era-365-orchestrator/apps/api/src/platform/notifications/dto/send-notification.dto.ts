import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  NotificationChannel,
  NotificationMessageClass,
} from "@era365/database";

export class SendNotificationDto {
  @IsString()
  @MaxLength(128)
  templateKey!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsEnum(NotificationMessageClass)
  messageClass!: NotificationMessageClass;

  @IsString()
  @MaxLength(256)
  recipient!: string;

  @IsString()
  @MaxLength(64)
  sourceEntityType!: string;

  @IsString()
  @MaxLength(128)
  sourceEntityId!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
