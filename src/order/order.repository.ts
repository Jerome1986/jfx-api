import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class OrderRepository {
  constructor(private prisma: PrismaService) { }
}