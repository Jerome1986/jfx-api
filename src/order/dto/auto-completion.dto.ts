import { IsBoolean } from 'class-validator'

export class AutoCompletionDto {
  @IsBoolean({ message: 'paused 必须是布尔值' })
  paused: boolean
}
