import { Order, ShippingAreaMapping, User } from '../../../database/models';
import { shippingAreaMappingService } from '../shipping-area-mapping.service';
import { GHNService } from '../ghn.service';

jest.mock('../../../database/models', () => ({
  Order: {
    updateMany: jest.fn(),
  },
  ShippingAreaMapping: {
    bulkWrite: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  User: {
    updateMany: jest.fn(),
  },
}));

jest.mock('../ghn.service', () => ({
  GHNService: {
    getProvinces: jest.fn(),
    getDistricts: jest.fn(),
    getWards: jest.fn(),
  },
}));

const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedMapping = ShippingAreaMapping as jest.Mocked<typeof ShippingAreaMapping>;
const mockedUser = User as jest.Mocked<typeof User>;
const mockedGhnService = GHNService as jest.Mocked<typeof GHNService>;

describe('shippingAreaMappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGhnService.getProvinces.mockResolvedValue({
      data: [{ ProvinceID: 204 }, { ProvinceID: 220 }],
    } as never);
    mockedGhnService.getDistricts.mockResolvedValue({
      data: [{ DistrictID: 1452 }, { DistrictID: 1572 }],
    } as never);
    mockedGhnService.getWards.mockResolvedValue({
      data: [{ WardCode: '480101' }, { WardCode: '550108' }],
    } as never);
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
      status: 'verified',
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
    mockedMapping.bulkWrite.mockResolvedValue({} as never);
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
    expect(mockedMapping.bulkWrite).toHaveBeenCalledTimes(1);
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

  it('lets a managed verified mapping override seed and stored explicit fields', async () => {
    const managedMapping = {
      provinceCode: '01',
      provinceName: 'Thành phố Hà Nội',
      wardCode: '00004',
      wardName: 'Phường Ba Đình',
      ghnProvinceId: 201,
      ghnDistrictId: 9999,
      ghnWardCode: 'OVERRIDE',
      confidence: 'exact',
      status: 'verified',
      verifiedAt: new Date('2026-08-08T00:00:00.000Z'),
    };
    mockedMapping.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(managedMapping),
      }),
    } as never);

    const result = await shippingAreaMappingService.resolveStoredGhnFieldsWithManagedMapping({
      province: 'Thành phố Hà Nội',
      provinceCode: '01',
      ward: 'Phường Ba Đình',
      wardCode: '00004',
      ghnDistrictId: 1484,
      ghnWardCode: '1A0107',
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      ghnDistrictId: 9999,
      ghnWardCode: 'OVERRIDE',
      source: 'managed',
    });
  });

  it('uses disabled managed mapping as a tombstone over seed and stored fields', async () => {
    mockedMapping.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          status: 'disabled',
          confidence: 'manual',
        }),
      }),
    } as never);

    const result = await shippingAreaMappingService.resolveStoredGhnFieldsWithManagedMapping({
      provinceCode: 1,
      wardCode: 4,
      ghnDistrictId: 1484,
      ghnWardCode: '1A0107',
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      ghnDistrictId: null,
      ghnWardCode: null,
      ghnMappingStatus: 'missing',
      source: 'managed',
    });
    expect(mockedMapping.findOne).toHaveBeenCalledWith({
      provider: 'GHN',
      provinceCode: '01',
      wardCode: '00004',
    });
  });

  it('does not trust legacy auto-verified explicit fields without provenance', () => {
    const result = shippingAreaMappingService.resolveStoredGhnFields({
      provinceCode: '75',
      wardCode: '26368',
      ghnDistrictId: 1452,
      ghnWardCode: '480101',
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      ghnMappingStatus: 'manual',
      ghnMappingVerifiedAt: null,
      source: 'explicit',
    });
  });

  it('trusts explicit fields carrying admin verification provenance', () => {
    const verifiedAt = '2026-08-08T00:00:00.000Z';
    const result = shippingAreaMappingService.resolveStoredGhnFields({
      provinceCode: '75',
      wardCode: '26368',
      ghnDistrictId: 1452,
      ghnWardCode: '480101',
      ghnMappingStatus: 'mapped',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: verifiedAt,
      ghnMappingVerificationSource: 'admin',
    });

    expect(result).toMatchObject({
      ghnDistrictId: 1452,
      ghnWardCode: '480101',
      ghnMappingStatus: 'mapped',
      ghnMappingVerifiedAt: new Date(verifiedAt),
      ghnMappingVerificationSource: 'admin',
      source: 'explicit',
    });
  });

  it('does not treat a manual representative seed as production verified', () => {
    const result = shippingAreaMappingService.resolveStoredGhnFields({
      provinceCode: '01',
      wardCode: '00004',
    });

    expect(result).toMatchObject({
      ghnMappingStatus: 'manual',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: null,
      source: 'mapping',
    });
  });

  it('defaults imported mappings to pending without validation or backfill', async () => {
    mockedMapping.bulkWrite.mockResolvedValue({} as never);

    const result = await shippingAreaMappingService.upsertMappings({
      backfill: true,
      mappings: [{
        provinceCode: '75',
        provinceName: 'Tỉnh Đồng Nai',
        wardCode: '26368',
        wardName: 'Phường Trấn Biên',
        ghnProvinceId: 204,
        ghnDistrictId: 1452,
        ghnWardCode: '480101',
      }],
    });

    expect(result.items[0]).toMatchObject({ status: 'pending', verifiedAt: null });
    expect(mockedGhnService.getProvinces).not.toHaveBeenCalled();
    expect(mockedOrder.updateMany).not.toHaveBeenCalled();
    expect(mockedUser.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid verified hierarchy before writing or backfilling', async () => {
    mockedGhnService.getWards.mockResolvedValue({ data: [] } as never);

    await expect(shippingAreaMappingService.upsertMappings({
      backfill: true,
      mappings: [{
        provinceCode: '75',
        provinceName: 'Tỉnh Đồng Nai',
        wardCode: '26368',
        wardName: 'Phường Trấn Biên',
        ghnProvinceId: 204,
        ghnDistrictId: 1452,
        ghnWardCode: 'INVALID',
        status: 'verified',
      }],
    })).rejects.toThrow('ward INVALID không thuộc district 1452');

    expect(mockedMapping.bulkWrite).not.toHaveBeenCalled();
    expect(mockedOrder.updateMany).not.toHaveBeenCalled();
  });

  it('reports retryable backfill failures after a successful bulk import', async () => {
    mockedMapping.bulkWrite.mockResolvedValue({} as never);
    mockedOrder.updateMany.mockRejectedValue(new Error('orders unavailable'));
    mockedUser.updateMany.mockResolvedValue({ modifiedCount: 0 } as never);

    const result = await shippingAreaMappingService.upsertMappings({
      backfill: true,
      mappings: [{
        provinceCode: '75',
        provinceName: 'Tỉnh Đồng Nai',
        wardCode: '26368',
        wardName: 'Phường Trấn Biên',
        ghnProvinceId: 204,
        ghnDistrictId: 1452,
        ghnWardCode: '480101',
        status: 'verified',
      }],
    });

    expect(result).toMatchObject({
      importedCount: 1,
      backfillFailedCount: 1,
      backfillFailures: [{
        provinceCode: '75',
        wardCode: '26368',
        message: 'orders unavailable',
      }],
    });
  });

  it('validates hierarchy before changing a pending mapping to verified', async () => {
    const currentMapping = {
      provinceCode: '75',
      provinceName: 'Tỉnh Đồng Nai',
      wardCode: '26368',
      wardName: 'Phường Trấn Biên',
      ghnProvinceId: 204,
      ghnDistrictId: 1452,
      ghnWardCode: 'INVALID',
      confidence: 'manual',
      status: 'pending',
    };
    mockedMapping.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(currentMapping),
    } as never);
    mockedGhnService.getWards.mockResolvedValue({ data: [] } as never);

    await expect(shippingAreaMappingService.reviewMapping({
      id: '665000000000000000000001',
      status: 'verified',
      backfill: false,
    })).rejects.toThrow('ward INVALID không thuộc district 1452');

    expect(mockedMapping.findByIdAndUpdate).not.toHaveBeenCalled();
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
      verifiedWardCount: 10,
      productionReadyWardCount: 10,
      pendingWardCount: 2,
      missingWardCount: 3311,
      coveragePercent: 0.3,
      productionReadyCoveragePercent: 0.3,
      readyForProduction: false,
    });
  });

  it('removes a disabled managed override from effective seed coverage', async () => {
    mockedMapping.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          provinceCode: '92',
          wardCode: '31120',
          status: 'disabled',
          confidence: 'exact',
        }]),
      }),
    } as never);

    const result = await shippingAreaMappingService.getCoverage();

    expect(result).toMatchObject({
      verifiedWardCount: 9,
      productionReadyWardCount: 9,
      disabledWardCount: 1,
      readyForProduction: false,
    });
  });
});
