import { Module } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
import { FavoriteRepository } from './favorite.repository';

@Module({
  controllers: [FavoriteController],
  providers: [FavoriteService, FavoriteRepository],
})
export class FavoriteModule {}
