// 文件说明：收藏业务服务的单元测试。
jest.mock('./favorite.repository', () => ({
  FavoriteRepository: class FavoriteRepository {},
}))

import { FavoriteRepository } from './favorite.repository'
import { FavoriteService } from './favorite.service'

describe('FavoriteService', () => {
  let service: FavoriteService
  let repository: jest.Mocked<FavoriteRepository>

  beforeEach(() => {
    repository = {
      findByUserAndCase: jest.fn(),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      getUserFavorites: jest.fn(),
    } as unknown as jest.Mocked<FavoriteRepository>
    service = new FavoriteService(repository)
  })

  it('根据用户ID获取收藏列表', async () => {
    const favorites = [
      {
        id: 1,
        userId: 8,
        caseId: 3,
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        case: { id: 3, title: '现代简约案例' },
      },
    ]
    repository.getUserFavorites.mockResolvedValue(favorites as never)

    await expect(service.getUserFavorites(8)).resolves.toEqual(favorites)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.getUserFavorites).toHaveBeenCalledWith(8)
  })
})
