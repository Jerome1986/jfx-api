import { Injectable } from '@nestjs/common';
import { CreateCaseCategoryDto } from './dto/create-case-category.dto';
import { UpdateCaseCategoryDto } from './dto/update-case-category.dto';

@Injectable()
export class CaseCategoryService {
  create(createCaseCategoryDto: CreateCaseCategoryDto) {
    return 'This action adds a new caseCategory';
  }

  findAll() {
    return `This action returns all caseCategory`;
  }

  update(id: number, updateCaseCategoryDto: UpdateCaseCategoryDto) {
    return `This action updates a #${id} caseCategory`;
  }

  remove(id: number) {
    return `This action removes a #${id} caseCategory`;
  }
}
