import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBannerDto {
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '标题不能为空' })
  title: string;

  @IsString({ message: '图片地址必须是字符串' })
  @IsNotEmpty({ message: '图片地址不能为空' })
  image: string;

  @IsOptional()
  @IsString({ message: '跳转目标类型必须是字符串' })
  targetType?: string;

  @IsOptional()
  @IsString({ message: '跳转目标必须是字符串' })
  target?: string;

  @IsOptional()
  @IsInt({ message: '排序值必须是整数' })
  @Min(0, { message: '排序值不能小于0' })
  sort?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'OFFLINE'], {
    message: '发布状态只能是DRAFT、PUBLISHED或OFFLINE',
  })
  status?: 'DRAFT' | 'PUBLISHED' | 'OFFLINE';
}
