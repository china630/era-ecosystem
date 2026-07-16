import { IsNotEmpty, IsString, Matches } from "class-validator";

export class GenerateStatReportDto {
  @IsString()
  @IsNotEmpty()
  definitionCode!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{4}(-Q[1-4]|-\d{2})?|\d{4})$/, {
    message: "period must be YYYY, YYYY-MM, or YYYY-Qn",
  })
  period!: string;
}
