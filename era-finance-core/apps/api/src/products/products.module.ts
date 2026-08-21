import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PriceListsController } from "./price-lists.controller";
import { PriceListsService } from "./price-lists.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { InternalProductsController } from "./internal-products.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController, PriceListsController, InternalProductsController],
  providers: [ProductsService, PriceListsService],
  exports: [ProductsService, PriceListsService],
})
export class ProductsModule {}
