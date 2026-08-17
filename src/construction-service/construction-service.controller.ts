import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ConstructionServiceService } from './construction-service.service'
import { CreateConstructionServiceDto } from './dto/create-construction-service.dto'
import { QueryConstructionServiceDto } from './dto/query-construction-service.dto'
import { UpdateConstructionServiceDto } from './dto/update-construction-service.dto'

@Controller('construction-service')
export class ConstructionServiceController {
  constructor(
    private readonly constructionServiceService: ConstructionServiceService,
  ) {}

  // 新增施工服务
  @Post()
  create(@Body() createDto: CreateConstructionServiceDto) {
    return this.constructionServiceService.create(createDto)
  }

  // 分页查询施工服务列表
  @Get()
  findAll(@Query() query: QueryConstructionServiceDto) {
    return this.constructionServiceService.findAll(query)
  }

  // 查询施工服务详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.constructionServiceService.findOne(id)
  }

  // 更新施工服务
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateConstructionServiceDto,
  ) {
    return this.constructionServiceService.update(id, updateDto)
  }

  // 逻辑停用施工服务
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.constructionServiceService.remove(id)
  }
}
