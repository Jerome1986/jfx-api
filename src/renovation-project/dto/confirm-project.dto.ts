import { IsInt, Max, Min } from 'class-validator'

export class ConfirmProjectDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quoteVersion: number
}
