import { PublishStatus } from "../../../generated/prisma/enums";
import { IsEnum } from "class-validator";


export class StatusCase {
  @IsEnum(PublishStatus, {
    message: '状态只能是 DRAFT、PUBLISHED 或 OFFLINE',
  })
  status: PublishStatus
}
