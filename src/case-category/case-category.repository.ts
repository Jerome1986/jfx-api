import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class caseCategoryRepository {
  constructor(private prisma: PrismaService) { }

  // 新增分类
  create() {

  }
}