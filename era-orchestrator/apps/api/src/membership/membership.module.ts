import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembershipController } from "./membership.controller";

@Module({
  imports: [AuthModule],
  controllers: [MembershipController],
})
export class MembershipModule {}
