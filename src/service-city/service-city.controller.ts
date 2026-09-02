import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import { CreateServiceCityDto } from './dto/create-service-city.dto'
import { QueryServiceCityDto } from './dto/query-service-city.dto'
import { UpdateServiceCityDto } from './dto/update-service-city.dto'
import { ServiceCityService } from './service-city.service'

@Controller('service-city')
export class ServiceCityController {
  constructor(private readonly serviceCityService: ServiceCityService) { }

  // 新增服务城市并由后端自动生成行政区划代码。
  @Post()
  create(@Body() dto: CreateServiceCityDto) {
    return this.serviceCityService.create(dto)
  }

  // 分页查询城市列表并支持关键字和状态筛选。
  @Get()
  findAll(@Query() query: QueryServiceCityDto) {
    return this.serviceCityService.findAll(query)
  }

  // 查询供小程序使用的全部启用城市。
  @Get('enabled')
  findEnabled() {
    return this.serviceCityService.findEnabled()
  }

  // 根据主键 ID 查询城市详情。
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCityService.findOne(id)
  }

  // 根据主键 ID 更新城市信息。
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceCityDto) {
    return this.serviceCityService.update(id, dto)
  }

  // 根据主键 ID 删除未关联服务网点的城市。
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceCityService.remove(id)
  }
}
