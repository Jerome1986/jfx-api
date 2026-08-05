// src/prisma/prisma.servive.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  // 使用的数据库类型的驱动程序适配器
  // 针对 MySQL、MsSQL、AzureSQL：npm install @prisma/adapter-mariadb
  constructor() {
    const adapter = new PrismaMariaDb({
      host: 'localhost',
      port: 3306,
      user: 'jfx',
      password: '123456',
      database: 'jfx'
    });
    super({ adapter });
  }

  async onModuleInit() {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}