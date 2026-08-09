import React from 'react';
import { Text } from 'react-native';
import ProductSection from '../components/ProductSection';
import type { CatalogProduct } from '../../catalog/catalogApi';

jest.mock('../../catalog/ProductCard', () => {
  const ReactModule = require('react') as typeof React;
  const { Text: NativeText } = require('react-native') as typeof import('react-native');
  return ({ product }: { product: CatalogProduct }) => ReactModule.createElement(NativeText, null, product.name);
});

jest.mock('@expo/vector-icons', () => {
  const ReactModule = require('react') as typeof React;
  return {
    MaterialCommunityIcons: (props: Record<string, unknown>) => ReactModule.createElement('Icon', props),
  };
});

type TestTree = {
  root: { findAllByType: (type: unknown) => Array<{ props: Record<string, any> }> };
  unmount: () => void;
};

const renderer = jest.requireActual('react-test-renderer') as {
  act: (action: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => TestTree;
};

describe('ProductSection background refresh', () => {
  it('keeps the last products visible while refreshing', async () => {
    let tree!: TestTree;
    await renderer.act(async () => {
      tree = renderer.create(
        <ProductSection
          title="Bán chạy"
          products={[{ _id: 'product-a', name: 'Áo đang hiển thị' } as CatalogProduct]}
          isLoading
        />,
      );
    });

    const labels = tree.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels).toContain('Áo đang hiển thị');
    expect(labels).toContain('Đang cập nhật sản phẩm');
    expect(labels).not.toContain('Đang tải sản phẩm');
    await renderer.act(async () => tree.unmount());
  });

  it('keeps the last products visible when a background refresh fails', async () => {
    let tree!: TestTree;
    await renderer.act(async () => {
      tree = renderer.create(
        <ProductSection
          title="Bán chạy"
          products={[{ _id: 'product-a', name: 'Áo dữ liệu gần nhất' } as CatalogProduct]}
          error="Mất kết nối"
        />,
      );
    });

    const labels = tree.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels).toContain('Áo dữ liệu gần nhất');
    expect(labels).toContain('Đang hiển thị dữ liệu gần nhất.');
    expect(labels).not.toContain('Mất kết nối');
    await renderer.act(async () => tree.unmount());
  });
});
