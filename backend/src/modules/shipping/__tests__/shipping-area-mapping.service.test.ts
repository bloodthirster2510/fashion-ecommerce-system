import { Order, ShippingAreaMapping, User } from '../../../database/models';
import { shippingAreaMappingService } from '../shipping-area-mapping.service';

jest.mock('../../../database/models', () => ({
  Order: {
    updateMany: jest.fn(),
  },
  ShippingAreaMapping: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  User: {
    updateMany: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedMapping = ShippingAreaMapping as jest.Mocked<typeof ShippingAreaMapping>;
const mockedUser = User as jest.Mocked<typeof User>;

describe('shippingAreaMappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a verified admin-managed mapping for a province outside the seed', async () => {
    const managedMapping = {
      provinceCode: '75',
      provinceName: 'Tỉnh Đồng Nai',
      wardCode: '26368',
      wardName: 'Phường Trấn Biên',
      ghnProvinceId: 204,
      ghnProvinceName: 'Đồng Nai',
      ghnDistrictId: 1452,
      ghnDistrictName: 'Biên Hòa',
      ghnWardCode: '480101',
      ghnWardName: 'Trấn Biên',
      confidence: 'manual',
      verifiedAt: new Date('2026-07-29T00:00:00.000Z'),
      note: 'Admin verified',
    };
    const lean = jest.fn().mockResolvedValue(managedMapping);
    const sort = jest.fn().mockReturnValue({ lean });
    mockedMapping.findOne.mockReturnValue({ sort } as never);

    const result = await shippingAreaMappingService.resolveStoredGhnFieldsWithManagedMapping({
      province: 'Tỉnh Đồng Nai',
      provinceCode: '75',
      ward: 'Phường Trấn Biên',
      wardCode: '26368',
    });

    expect(mockedMapping.findOne).toHaveBeenCalledWith({
      provider: 'GHN',
      provinceCode: '75',
      wardCode: '26368',
      status: 'verified',
    });
    expect(result).toMatchObject({
      ghnProvinceId: 204,
      ghnDistrictId: 1452,
      ghnWardCode: '480101',
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: managedMapping.verifiedAt,
      source: 'managed',
    });
  });

  it('imports a verified mapping and backfills matching orders and user addresses', async () => {
    const savedMapping = { _id: 'mapping-1', status: 'verified' };
    mockedMapping.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue(savedMapping),
    } as never);
    mockedOrder.updateMany.mockResolvedValue({ modifiedCount: 2 } as never);
    mockedUser.updateMany.mockResolvedValue({ modifiedCount: 3 } as never);

    const result = await shippingAreaMappingService.upsertMappings({
      actorId: '665000000000000000000001',
      backfill: true,
      mappings: [{
        provinceCode: '75',
        provinceName: 'Tỉnh Đồng Nai',
        wardCode: '26368',
        wardName: 'Phường Trấn Biên',
        ghnProvinceId: 204,
        ghnDistrictId: 1452,
        ghnWardCode: '480101',
        confidence: 'manual',
        status: 'verified',
        verifiedAt: '2026-07-29T00:00:00.000Z',
      }],
    });

    expect(result).toMatchObject({
      importedCount: 1,
      backfilledOrders: 2,
      backfilledUserDocuments: 3,
    });
    expect(mockedOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        'shippingAddress.provinceCode': '75',
        'shippingAddress.wardCode': '26368',
        'shipping.trackingCode': null,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'shippingAddress.ghnDistrictId': 1452,
          'shippingAddress.ghnWardCode': '480101',
          'shippingAddress.ghnMappingStatus': 'mapped',
        }),
      }),
    );
    expect(mockedUser.updateMany).toHaveBeenCalled();
  });

  it('reports production readiness against the complete 2025 ward catalog', async () => {
    mockedMapping.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    } as never);

    const result = await shippingAreaMappingService.getCoverage();

    expect(result).toMatchObject({
      provinceCount: 34,
      wardCount: 3321,
      verifiedWardCount: 12,
      missingWardCount: 3309,
      coveragePercent: 0.36,
      readyForProduction: false,
    });
  });
});
