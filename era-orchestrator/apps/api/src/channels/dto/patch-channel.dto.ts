import { IsBoolean, IsIn, IsOptional } from "class-validator";

export class PatchChannelDto {
  @IsBoolean()
  enabled!: boolean;

  /** SuperAdmin only: reset managedBy to PLATFORM after acceptor override. */
  @IsOptional()
  @IsIn(["PLATFORM", "ACCEPTOR"])
  managedBy?: "PLATFORM" | "ACCEPTOR";
}
