import { Injectable } from "@nestjs/common";
import { ControlPlanePrismaService } from "./control-plane-prisma.service";

/** CP billing uses the same client as control-plane (no tenant extension). */
@Injectable()
export class PrismaService extends ControlPlanePrismaService {}
