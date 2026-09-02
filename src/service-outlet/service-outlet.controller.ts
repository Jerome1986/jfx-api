// 文件说明：服务网点控制器，负责接收和处理服务网点相关 HTTP 请求。
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import { CreateServiceOutletDto } from './dto/create-service-outlet.dto'
import { QueryServiceOutletDto } from './dto/query-service-outlet.dto'
import { UpdateServiceOutletDto } from './dto/update-service-outlet.dto'
import { QueryServiceOutletByCityDto } from './dto/query-service-outlet-by-city.dto'
import { ServiceOutletService } from './service-outlet.service'

@Controller('service-outlet')
export class ServiceOutletController {
  constructor(private readonly serviceOutletService: ServiceOutletService) { }

  // 新增服务网点
  @Post()
  create(@Body() dto: CreateServiceOutletDto) {
    return this.serviceOutletService.create(dto)
  }

  // 分页查询服务网点列表，支持关键字、城市ID、区县和状态筛选
  @Get()
  findAll(@Query() query: QueryServiceOutletDto) {
    return this.serviceOutletService.findAll(query)
  }

  // 小程序端根据城市 ID 获取已启用的服务网点
  @Get('by-city')
  findByCity(@Query() query: QueryServiceOutletByCityDto) {
    return this.serviceOutletService.findByCity(+query.cityId)
  }

  // 根据 ID 查询服务网点详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceOutletService.findOne(id)
  }

  // 根据 ID 更新服务网点信息
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceOutletDto) {
    return this.serviceOutletService.update(id, dto)
  }

  // 根据 ID 删除服务网点
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceOutletService.remove(id)
  }
}
