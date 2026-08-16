import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(private productRepo: ProductRepository) {}

  create(createProductDto: CreateProductDto) {
    return this.productRepo.create(createProductDto);
  }

  findAll() {
    return this.productRepo.findAll();
  }

  findOne(id: number) {
    return this.productRepo.findOne(id);
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return this.productRepo.update(id, updateProductDto);
  }

  remove(id: number) {
    return this.productRepo.remove(id);
  }
}
