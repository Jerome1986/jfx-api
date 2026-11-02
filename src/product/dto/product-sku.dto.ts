import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { Transform } from 'class-transformer'

export class ProductSkuDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price: number

  @IsInt()
  @Min(0)
  @Max(2147483647)
  stock: number

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number
}
