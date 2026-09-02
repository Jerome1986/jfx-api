import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceCityDto } from './create-service-city.dto';

export class UpdateServiceCityDto extends PartialType(CreateServiceCityDto) {}
