import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateDepartmentOrgDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Optional note for ops (e.g. fnb, clinic). */
  @IsOptional()
  @IsString()
  preset?: string;
}
