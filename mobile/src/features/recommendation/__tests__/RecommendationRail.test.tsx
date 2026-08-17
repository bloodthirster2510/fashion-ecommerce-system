import React from 'react';
import { Text, View } from 'react-native';
import RecommendationRail from '../RecommendationRail';
import type { RecommendationItem } from '../recommendationApi';

type MockProductCardProps = {
  product: RecommendationItem['product'];
  featured?: boolean;
};

const mockProductCard = jest.fn(({ product }: MockProductCardProps) => (
  <Text>{product.name}</Text>
));

jest.mock('../../catalog/ProductCard', () => (props: MockProductCardProps) => (
  mockProductCard(props)
));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

type TestTree = {
  root: { findAllByType: (type: unknown) => Array<{ props: Record<string, any> }> };
  unmount: () => void;
};

const renderer = jest.requireActual('react-test-renderer') as {
  act: (action: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => TestTree;
};

const recommendationItem = (index: number): RecommendationItem => ({
  product: {
    _id: `product-${index}`,
    name: `Sản phẩm ${index}`,
  } as RecommendationItem['product'],
  score: 1,
  rank: index,
  reason: '',
  reasonCodes: ['popular'],
  merchandisingSource: index === 1 ? 'admin_pinned' : 'algorithm',
});

describe('RecommendationRail grid', () => {
  it('renders ten recommendations as the same two-column product cards', async () => {
    const items = Array.from({ length: 10 }, (_, index) => recommendationItem(index + 1));
    let tree!: TestTree;

    await renderer.act(async () => {
      tree = renderer.create(
        <RecommendationRail
          title="Dành cho bạn"
          items={items}
          onProductPress={jest.fn()}
        />,
      );
    });

    const gridItems = tree.root.findAllByType(View).filter(
      (node) => node.props.style?.width === '47.5%',
    );

    expect(mockProductCard).toHaveBeenCalledTimes(10);
    expect(gridItems).toHaveLength(10);
    expect(mockProductCard.mock.calls[0][0].featured).toBe(true);

    await renderer.act(async () => tree.unmount());
  });
});
