import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import StorefrontFooter from '../../components/layout/StorefrontFooter';
import { colors, radii, shadows, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { cartApi } from '../cart/cartApi';
import {
  catalogApi,
  CatalogProduct,
  CatalogProductDetail,
  ProductCategoryBreadcrumbItem,
  ProductDetailColor,
  ProductDetailVariant,
} from './catalogApi';
import ProductCard from './ProductCard';

type ProductDetailRouteProp = RouteProp<RootStackParamList, 'ProductDetail'>;
type ProductDetailNavigationProp = StackNavigationProp<RootStackParamList, 'ProductDetail'>;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const fallbackQuantityLimit = 99;

const formatCurrency = (value: number) => {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
};

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const getInitialVariant = (product: CatalogProductDetail) =>
  product.variants.find((variant) => variant._id === product.selectedVariantId) ??
  product.variants.find((variant) => variant.isActive) ??
  product.variants[0];

const getInventoryForSelection = (
  variant?: ProductDetailVariant,
  colorVariantId?: string,
  size?: string,
) => {
  if (!variant || !colorVariantId || !size) {
    return undefined;
  }

  return variant.inventory?.find((item) => {
    return item.colorVariantId === colorVariantId && item.size.trim().toLowerCase() === size.trim().toLowerCase();
  });
};

const getAvailableQuantityForSize = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string | undefined,
  sizeOption: ProductDetailVariant['sizes'][number],
) => {
  const inventory = getInventoryForSelection(variant, colorVariantId, sizeOption.size);

  if (variant && Array.isArray(variant.inventory) && colorVariantId) {
    return Math.max(0, inventory?.availableQuantity ?? 0);
  }

  return Math.max(0, sizeOption.availableQuantity ?? (sizeOption.isAvailable ? fallbackQuantityLimit : 0));
};

const isSizeAvailableForColor = (
  variant: ProductDetailVariant | undefined,
  colorVariantId: string | undefined,
  sizeOption: ProductDetailVariant['sizes'][number],
) => {
  return getAvailableQuantityForSize(variant, colorVariantId, sizeOption) > 0;
};

const getFirstAvailableSize = (variant?: ProductDetailVariant, colorVariantId?: string) =>
  variant?.sizes.find((item) => isSizeAvailableForColor(variant, colorVariantId, item))?.size ??
  variant?.sizes[0]?.size;

const getImageOptions = (product: CatalogProductDetail) =>
  uniqueStrings([
    product.productImage,
    ...product.gallery,
    ...product.variants.flatMap((variant) => variant.colors.map((color) => color.image)),
  ]);

const getBreadcrumbCategories = (product: CatalogProductDetail): ProductCategoryBreadcrumbItem[] => {
  if (product.categoryBreadcrumb?.length) {
    return product.categoryBreadcrumb;
  }

  if (product.category) {
    return [
      {
        _id: product.category._id,
        name: product.category.name,
        gender: product.category.gender,
      },
    ];
  }

  return [];
};

const getPolicyIcon = (value: string): IconName => {
  return value in MaterialCommunityIcons.glyphMap
    ? (value as IconName)
    : 'shield-check-outline';
};

const sourceColorHexMap: Record<string, string> = {
  BEE: '#F5F5DC',
  BSA: '#F5F5DC',
  CAM: '#F36B26',
  CBA: '#1790C8',
  CHI: '#A0A0A0',
  CVT: '#7BBA3C',
  DDL: '#000000',
  DDO: '#E7352B',
  DEN: '#111111',
  DET: '#111111',
  DGH: '#111111',
  DKT: '#E7352B',
  DN1: '#1C1C1C',
  DOD: '#E7352B',
  GAH: '#E7352B',
  GHD: '#CCCCCC',
  GHI: '#CCCCCC',
  HG1: '#F0728F',
  HOG: '#F0728F',
  IDC: '#000000',
  IDG: '#000000',
  IDX: '#000000',
  ITC: '#FFFFFF',
  ITG: '#FFFFFF',
  ITX: '#FFFFFF',
  KEM: '#F5F5DC',
  NAD: '#825D41',
  NAN: '#825D41',
  NAU: '#825D41',
  NAV: '#000080',
  NKT: '#000080',
  NSU: '#825D41',
  REU: '#636B2F',
  TAN: '#CCCCCC',
  TGD: '#FFFFFF',
  THX: '#000080',
  TIK: '#000080',
  TIT: '#000080',
  TKA: '#FFFFFF',
  TKC: '#FFFFFF',
  TKD: '#FFFFFF',
  TKE: '#FFFFFF',
  TKG: '#CCCCCC',
  TKH: '#FFFFFF',
  TKN: '#FFFFFF',
  TKX: '#FFFFFF',
  TMT: '#FFFFFF',
  TNY: '#FFFFFF',
  TRA: '#FFFFFF',
  TRD: '#FFFFFF',
  TRG: '#FFFFFF',
  TTM: '#FFFFFF',
  VAG: '#FED533',
  XAH: '#1790C8',
  XAM: '#CCCCCC',
  XAR: '#7BBA3C',
  XBD: '#1790C8',
  XBI: '#1790C8',
  XCV: '#7BBA3C',
  XDE: '#111111',
  XH1: '#1790C8',
  XLA: '#7BBA3C',
  XLO: '#1790C8',
  XMN: '#67F0E5',
  XN1: '#1790C8',
  XNA: '#CCCCCC',
  XNG: '#67F0E5',
  XTI: '#1790C8',
};

const colorNameHexMap: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /đen|black/i, value: '#111111' },
  { pattern: /trắng|trang|white/i, value: '#FFFFFF' },
  { pattern: /be|beige|kem|cream/i, value: '#E8D8BE' },
  { pattern: /nâu|nau|brown/i, value: '#7A5137' },
  { pattern: /xám|xam|ghi|gray|grey/i, value: '#9EA4AA' },
  { pattern: /navy/i, value: '#1F2A44' },
  { pattern: /xanh jean|xanh dương|xanh biển|blue/i, value: '#4F7EA8' },
  { pattern: /rêu|reu|olive/i, value: '#66724A' },
  { pattern: /xanh/i, value: '#5E8FB4' },
  { pattern: /đỏ|do|red/i, value: '#C62828' },
  { pattern: /hồng|hong|pink/i, value: '#E89AB5' },
  { pattern: /vàng|vang|yellow/i, value: '#F2CF62' },
  { pattern: /cam|orange/i, value: '#F2994A' },
  { pattern: /tím|tim|purple/i, value: '#7B5FA7' },
];

const isHexColor = (value?: string) => Boolean(value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()));

const getRatingDistribution = (product: CatalogProductDetail) => {
  const existing = product.ratingSummary.distribution;
  const totalFromDistribution = existing.reduce((sum, item) => sum + item.count, 0);

  if (totalFromDistribution > 0) {
    return [...existing].sort((a, b) => b.rating - a.rating);
  }

  const roundedRating = Math.max(1, Math.min(5, Math.round(product.averageRating || 5)));

  return ([5, 4, 3, 2, 1] as const).map((rating) => ({
    rating,
    count: product.reviewCount && rating === roundedRating ? product.reviewCount : 0,
    percent: product.reviewCount && rating === roundedRating ? 100 : 0,
  }));
};

const getSwatchColor = (color?: ProductDetailColor) => {
  const colorCode = color?.colorCode?.trim();

  if (isHexColor(colorCode)) {
    return colorCode;
  }

  if (colorCode) {
    const sourceColor = sourceColorHexMap[colorCode.toUpperCase()];
    if (sourceColor) {
      return sourceColor;
    }
  }

  const nameColor = colorNameHexMap.find((item) => item.pattern.test(color?.color ?? ''));
  return nameColor?.value ?? colors.brandPale;
};

const ProductDetailScreen = () => {
  const navigation = useNavigation<ProductDetailNavigationProp>();
  const route = useRoute<ProductDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const { productId } = route.params;
  const [product, setProduct] = React.useState<CatalogProductDetail | null>(null);
  const [recommendations, setRecommendations] = React.useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRecommendationLoading, setIsRecommendationLoading] = React.useState(false);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>();
  const [selectedColorId, setSelectedColorId] = React.useState<string>();
  const [selectedSize, setSelectedSize] = React.useState<string>();
  const [selectedImage, setSelectedImage] = React.useState<string>();
  const [quantity, setQuantity] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState('');

  const initializeSelection = React.useCallback((detail: CatalogProductDetail) => {
    const initialVariant = getInitialVariant(detail);
    const initialColor = initialVariant?.colors[0];

    setSelectedVariantId(initialVariant?._id);
    setSelectedColorId(initialColor?._id);
    setSelectedSize(getFirstAvailableSize(initialVariant, initialColor?._id));
    setSelectedImage(initialColor?.image || detail.gallery[0] || detail.productImage);
    setQuantity(1);
  }, []);

  const loadProduct = React.useCallback(() => {
    let isCurrentRequest = true;

    setIsLoading(true);
    setIsRecommendationLoading(false);
    setError(null);
    setRecommendations([]);

    catalogApi
      .getProductById(productId)
      .then((detail) => {
        if (!isCurrentRequest) return;

        setProduct(detail);
        initializeSelection(detail);
        setIsLoading(false);
        setIsRecommendationLoading(true);

        const recommendationParams = detail.category?._id
          ? { categoryId: detail.category._id, sort: 'newest' as const, page: 1, limit: 6 }
          : { sort: 'newest' as const, page: 1, limit: 6 };

        catalogApi
          .getProducts(recommendationParams)
          .then((response) => {
            if (isCurrentRequest) {
              setRecommendations(response.items.filter((item) => item._id !== detail._id).slice(0, 4));
            }
          })
          .catch(() => {
            if (isCurrentRequest) {
              setRecommendations([]);
            }
          })
          .finally(() => {
            if (isCurrentRequest) {
              setIsRecommendationLoading(false);
            }
          });
      })
      .catch((err: unknown) => {
        if (!isCurrentRequest) return;

        setProduct(null);
        setError(err instanceof Error ? err.message : 'Không tải được chi tiết sản phẩm');
        setIsLoading(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [initializeSelection, productId]);

  React.useEffect(() => loadProduct(), [loadProduct]);

  const selectedVariant = product?.variants.find((variant) => variant._id === selectedVariantId);
  const selectedColor = selectedVariant?.colors.find((color) => color._id === selectedColorId);
  const selectedSizeOption = selectedVariant?.sizes.find((item) => item.size === selectedSize);
  const selectedInventory = getInventoryForSelection(selectedVariant, selectedColorId, selectedSize);
  const selectedAvailableQuantity =
    selectedColorId
      ? selectedInventory?.availableQuantity ?? 0
      : selectedSizeOption?.availableQuantity ?? (selectedSizeOption?.isAvailable ? fallbackQuantityLimit : 0);
  const maxPurchasableQuantity = Math.max(0, selectedAvailableQuantity);
  const canCheckout = Boolean(
    product &&
    selectedVariant?.isActive &&
    selectedColor &&
    selectedSizeOption &&
    isSizeAvailableForColor(selectedVariant, selectedColorId, selectedSizeOption) &&
    maxPurchasableQuantity > 0,
  );
  const isQuantityAtLimit = !canCheckout || quantity >= maxPurchasableQuantity;
  const imageOptions = product ? getImageOptions(product) : [];
  const ratingDistribution = product ? getRatingDistribution(product) : [];

  React.useEffect(() => {
    setQuantity((current) => {
      if (maxPurchasableQuantity <= 0) {
        return 1;
      }

      return Math.max(1, Math.min(maxPurchasableQuantity, current));
    });
  }, [maxPurchasableQuantity]);

  const handleSearchSubmit = () => {
    const keyword = searchTerm.trim();

    if (keyword) {
      navigation.navigate('ProductList', {
        title: `Tìm kiếm: ${keyword}`,
        keyword,
      });
    }
  };

  const handleBreadcrumbCategoryPress = (category: ProductCategoryBreadcrumbItem) => {
    navigation.navigate('ProductList', {
      title: category.name,
      categoryId: category._id,
      gender: category.gender,
    });
  };

  const handleVariantPress = (variant: ProductDetailVariant) => {
    const firstColor = variant.colors[0];

    setSelectedVariantId(variant._id);
    setSelectedColorId(firstColor?._id);
    setSelectedSize(getFirstAvailableSize(variant, firstColor?._id));
    setSelectedImage(firstColor?.image || product?.productImage);
    setQuantity(1);
  };

  const handleColorPress = (color: ProductDetailColor) => {
    setSelectedColorId(color._id);
    setSelectedImage(color.image);
    setSelectedSize((currentSize) => {
      const currentSizeOption = selectedVariant?.sizes.find((item) => item.size === currentSize);

      if (currentSizeOption && isSizeAvailableForColor(selectedVariant, color._id, currentSizeOption)) {
        return currentSize;
      }

      return getFirstAvailableSize(selectedVariant, color._id);
    });
    setQuantity(1);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((current) => {
      if (maxPurchasableQuantity <= 0) {
        return 1;
      }

      return Math.max(1, Math.min(maxPurchasableQuantity, current + delta));
    });
  };

  const handleSelectionAction = async (action: 'cart' | 'buy') => {
    if (!product || !selectedVariant || !selectedColor || !selectedSizeOption) {
      Alert.alert('Chọn sản phẩm', 'Bạn chọn đủ màu, size và số lượng trước nha.');
      return;
    }

    if (!canCheckout) {
      Alert.alert('Tạm hết hàng', 'Biến thể này chưa sẵn sàng để mua.');
      return;
    }

    if (!isAuthenticated || !session?.accessToken) {
      Alert.alert('Cần đăng nhập', 'Bạn đăng nhập để thêm sản phẩm vào giỏ nha.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    try {
      setIsAddingToCart(true);
      await runWithAuth((accessToken) => cartApi.addItem(accessToken, {
        productId: product._id,
        variantId: selectedVariant._id,
        colorVariantId: selectedColor._id,
        size: selectedSizeOption.size,
        quantity,
      }));

      if (action === 'buy') {
        navigation.navigate('Cart');
        return;
      }

      Alert.alert('Đã thêm vào giỏ', `${product.name}\nMàu: ${selectedColor.color}\nSize: ${selectedSizeOption.size}\nSố lượng: ${quantity}`, [
        { text: 'Mua tiếp', style: 'cancel' },
        { text: 'Xem giỏ', onPress: () => navigation.navigate('Cart') },
      ]);
      return;
    } catch (error) {
      Alert.alert(
        'Chưa thêm được giỏ hàng',
        error instanceof Error ? error.message : 'Bạn thử lại sau nha.',
      );
      return;
    } finally {
      setIsAddingToCart(false);
    }

  };

  const renderStars = (rating: number, size = 14) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <MaterialCommunityIcons
          key={star}
          name={rating >= star ? 'star' : 'star-outline'}
          size={size}
          color={colors.goldDark}
        />
      ))}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          accessibilityLabel="Trở về"
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="arrow-left" size={23} color={colors.white} />
        </TouchableOpacity>

        <Text style={styles.headerBrand}>FASHIONISTA</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} activeOpacity={0.82} accessibilityLabel="Yêu thích">
            <MaterialCommunityIcons name="heart-outline" size={22} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.82}
            accessibilityLabel="Giỏ hàng"
          >
            <MaterialCommunityIcons name="shopping-outline" size={22} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate(isAuthenticated ? 'Profile' : 'Login')}
            activeOpacity={0.82}
            accessibilityLabel="Tài khoản"
          >
            <MaterialCommunityIcons name="account-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          placeholder="Bạn muốn tìm gì?"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        <MaterialCommunityIcons name="camera-outline" size={20} color={colors.textMuted} />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader()}
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.centerStateText}>Đang tải chi tiết sản phẩm</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader()}
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={34} color={colors.danger} />
          <Text style={styles.centerStateTitle}>Không tải được sản phẩm</Text>
          <Text style={styles.centerStateText}>{error ?? 'Sản phẩm không tồn tại hoặc đã ngừng bán.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProduct} activeOpacity={0.82}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const breadcrumbCategories = getBreadcrumbCategories(product);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {renderHeader()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 122 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.breadcrumb}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.breadcrumbContent}
          >
            <TouchableOpacity onPress={() => navigation.navigate('Home')} activeOpacity={0.82}>
              <Text style={styles.breadcrumbLink}>Trang chủ</Text>
            </TouchableOpacity>

            {breadcrumbCategories.map((category) => (
              <React.Fragment key={category._id}>
                <Text style={styles.breadcrumbSeparator}>/</Text>
                <TouchableOpacity
                  onPress={() => handleBreadcrumbCategoryPress(category)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.breadcrumbLink}>{category.name}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}

            <Text style={styles.breadcrumbSeparator}>/</Text>
            <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
              {product.name}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.mediaSection}>
          <View style={styles.heroImageWrap}>
            {isRemoteImage(selectedImage) ? (
              <Image source={{ uri: selectedImage!.trim() }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialCommunityIcons name="tshirt-crew-outline" size={54} color={colors.brand} />
              </View>
            )}

            <TouchableOpacity style={styles.favoriteButton} activeOpacity={0.82} accessibilityLabel="Yêu thích">
              <MaterialCommunityIcons name="heart-outline" size={21} color={colors.brand} />
            </TouchableOpacity>
          </View>

          {imageOptions.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailRow}
            >
              {imageOptions.map((image) => {
                const isActive = image === selectedImage;

                return (
                  <TouchableOpacity
                    key={image}
                    style={[styles.thumbnail, isActive && styles.thumbnailActive]}
                    onPress={() => setSelectedImage(image)}
                    activeOpacity={0.82}
                  >
                    {isRemoteImage(image) ? (
                      <Image source={{ uri: image }} style={styles.thumbnailImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.thumbnailPlaceholder} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.productInfo}>
          <View style={styles.productTitleRow}>
            <Text style={styles.productName}>{product.name}</Text>
            {product.isSale ? (
              <View style={styles.saleBadge}>
                <Text style={styles.saleBadgeText}>-{product.discount}%</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.productMeta} numberOfLines={1}>
            {product.brand?.name ?? 'FASHIONISTA'} {product.category ? `• ${product.category.name}` : ''}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.currentPrice}>{formatCurrency(product.finalPrice)}</Text>
            {product.isSale ? (
              <Text style={styles.originalPrice}>{formatCurrency(product.originalPrice)}</Text>
            ) : null}
          </View>

          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="star" size={16} color={colors.goldDark} />
              <Text style={styles.statText}>{product.averageRating.toFixed(1)}</Text>
            </View>
            <View style={styles.statDivider} />
            <Text style={styles.statText}>{product.reviewCount} đánh giá</Text>
            <View style={styles.statDivider} />
            <Text style={styles.statText}>Đã bán {product.soldQuantity}</Text>
          </View>
        </View>

        <View style={styles.selectorSection}>
          {product.variants.length > 1 ? (
            <View style={styles.selectorBlock}>
              <Text style={styles.selectorTitle}>Kiểu dáng</Text>
              <View style={styles.chipWrap}>
                {product.variants.map((variant) => {
                  const isActive = variant._id === selectedVariantId;

                  return (
                    <TouchableOpacity
                      key={variant._id}
                      style={[styles.fitChip, isActive && styles.fitChipActive, !variant.isActive && styles.disabledChip]}
                      onPress={() => handleVariantPress(variant)}
                      disabled={!variant.isActive}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.fitChipText, isActive && styles.fitChipTextActive]} numberOfLines={1}>
                        {variant.fitType?.label ?? 'Mặc định'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.selectorBlock}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Màu sắc</Text>
              {selectedColor ? <Text style={styles.selectorHint}>{selectedColor.color}</Text> : null}
            </View>

            <View style={styles.swatchRow}>
              {selectedVariant?.colors.map((color) => {
                const isActive = color._id === selectedColorId;

                return (
                  <TouchableOpacity
                    key={color._id}
                    style={[styles.swatchButton, isActive && styles.swatchButtonActive]}
                    onPress={() => handleColorPress(color)}
                    activeOpacity={0.82}
                    accessibilityLabel={`Chọn màu ${color.color}`}
                  >
                    <View style={[styles.swatchColor, { backgroundColor: getSwatchColor(color) }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.selectorBlock}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Kích thước</Text>
              <TouchableOpacity onPress={() => Alert.alert('Hướng dẫn chọn size', 'Bảng size sẽ được nối từ category template ở bước tiếp theo.')} activeOpacity={0.82}>
                <Text style={styles.sizeGuide}>Hướng dẫn chọn size</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sizeGrid}>
              {selectedVariant?.sizes.map((sizeOption) => {
                const isActive = sizeOption.size === selectedSize;
                const sizeAvailableQuantity = getAvailableQuantityForSize(selectedVariant, selectedColorId, sizeOption);
                const isAvailable = sizeAvailableQuantity > 0;

                return (
                  <TouchableOpacity
                    key={sizeOption.size}
                    style={[
                      styles.sizeButton,
                      isActive && styles.sizeButtonActive,
                      !isAvailable && styles.disabledChip,
                    ]}
                    onPress={() => setSelectedSize(sizeOption.size)}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.sizeButtonText, isActive && styles.sizeButtonTextActive]}>
                      {sizeOption.size}
                    </Text>
                    <Text style={[styles.sizeStockText, isActive && styles.sizeStockTextActive]} numberOfLines={1}>
                      {isAvailable ? `Còn ${sizeAvailableQuantity}` : 'Hết hàng'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedSizeOption?.measurements.length ? (
            <View style={styles.measurementPanel}>
              <Text style={styles.measurementTitle}>Thông số size {selectedSizeOption.size}</Text>
              <View style={styles.measurementGrid}>
                {selectedSizeOption.measurements.map((measurement) => (
                  <View key={measurement.key} style={styles.measurementItem}>
                    <Text style={styles.measurementLabel} numberOfLines={1}>
                      {measurement.label ?? measurement.key}
                    </Text>
                    <Text style={styles.measurementValue}>
                      {measurement.value}
                      {measurement.unit ? ` ${measurement.unit}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.quantityRow}>
            <Text style={styles.selectorTitle}>Số lượng</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepperButton, quantity === 1 && styles.stepperButtonDisabled]}
                onPress={() => handleQuantityChange(-1)}
                disabled={quantity === 1}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name="minus" size={18} color={quantity === 1 ? colors.textSubtle : colors.text} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={[styles.stepperButton, isQuantityAtLimit && styles.stepperButtonDisabled]}
                onPress={() => handleQuantityChange(1)}
                disabled={isQuantityAtLimit}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name="plus" size={18} color={isQuantityAtLimit ? colors.textSubtle : colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.stockHint}>
            {canCheckout
              ? `Size ${selectedSizeOption?.size}: còn ${maxPurchasableQuantity} sản phẩm`
              : 'Tạm hết hàng cho màu/size này'}
          </Text>
        </View>

        <View style={styles.policyPanel}>
          {product.policies.map((policy) => (
            <View key={`${policy.title}-${policy.icon}`} style={styles.policyItem}>
              <View style={styles.policyIcon}>
                <MaterialCommunityIcons name={getPolicyIcon(policy.icon)} size={18} color={colors.brand} />
              </View>
              <View style={styles.policyCopy}>
                <Text style={styles.policyTitle}>{policy.title}</Text>
                <Text style={styles.policyDescription}>{policy.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.sectionTitle}>Đánh giá của khách hàng</Text>

          <View style={styles.ratingPanel}>
            <View style={styles.ratingScoreBlock}>
              <Text style={styles.ratingScore}>{product.averageRating.toFixed(1)}</Text>
              {renderStars(product.averageRating, 16)}
              <Text style={styles.ratingCount}>{product.reviewCount} đánh giá</Text>
            </View>

            <View style={styles.ratingBars}>
              {ratingDistribution.map((item) => (
                <View key={item.rating} style={styles.ratingBarRow}>
                  <Text style={styles.ratingBarLabel}>{item.rating}</Text>
                  <MaterialCommunityIcons name="star" size={12} color={colors.goldDark} />
                  <View style={styles.ratingTrack}>
                    <View style={[styles.ratingFill, { width: `${Math.min(100, Math.max(0, item.percent))}%` }]} />
                  </View>
                  <Text style={styles.ratingBarCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.experiencePanel}>
            {['Chất lượng', 'Đúng mô tả', 'Màu sắc'].map((label) => (
              <View key={label} style={styles.experienceRow}>
                <Text style={styles.experienceLabel}>{label}</Text>
                {renderStars(product.averageRating, 13)}
              </View>
            ))}
          </View>

          <View style={styles.reviewPlaceholder}>
            <MaterialCommunityIcons name="comment-text-outline" size={24} color={colors.brand} />
            <Text style={styles.reviewPlaceholderTitle}>Review chi tiết đang chờ module đánh giá</Text>
            <Text style={styles.reviewPlaceholderText}>
              Khi backend review sẵn sàng, khu này sẽ hiển thị ảnh thật, nội dung đánh giá và phản hồi của shop.
            </Text>
          </View>
        </View>

        <View style={styles.recommendationSection}>
          <Text style={styles.sectionTitle}>Bạn cũng có thể thích</Text>

          {isRecommendationLoading ? (
            <View style={styles.recommendationState}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.recommendationStateText}>Đang tìm sản phẩm phù hợp</Text>
            </View>
          ) : recommendations.length ? (
            <View style={styles.recommendationGrid}>
              {recommendations.map((item) => (
                <View key={item._id} style={styles.recommendationItem}>
                  <ProductCard
                    product={item}
                    onPress={(nextProduct) => navigation.navigate('ProductDetail', { productId: nextProduct._id })}
                    onCartPress={(nextProduct) => navigation.navigate('ProductDetail', { productId: nextProduct._id })}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.recommendationState}>
              <MaterialCommunityIcons name="hanger" size={24} color={colors.brand} />
              <Text style={styles.recommendationStateText}>Chưa có sản phẩm gợi ý phù hợp</Text>
            </View>
          )}
        </View>

        <StorefrontFooter />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable
          style={[styles.bottomButton, styles.cartCta, (!canCheckout || isAddingToCart) && styles.bottomButtonDisabled]}
          onPress={() => handleSelectionAction('cart')}
          disabled={!canCheckout || isAddingToCart}
        >
          <MaterialCommunityIcons name="cart-plus" size={19} color={canCheckout && !isAddingToCart ? colors.brand : colors.textSubtle} />
          <Text style={[styles.cartCtaText, (!canCheckout || isAddingToCart) && styles.bottomButtonTextDisabled]}>
            {isAddingToCart ? 'Đang thêm...' : 'Thêm vào giỏ'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.bottomButton, styles.buyCta, (!canCheckout || isAddingToCart) && styles.bottomButtonDisabled]}
          onPress={() => handleSelectionAction('buy')}
          disabled={!canCheckout || isAddingToCart}
        >
          <Text style={[styles.buyCtaText, (!canCheckout || isAddingToCart) && styles.bottomButtonTextDisabled]}>Mua ngay</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerActions: {
    minWidth: 96,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  searchRow: {
    minHeight: 36,
    marginTop: 8,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  breadcrumb: {
    minHeight: 31,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breadcrumbContent: {
    minHeight: 31,
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.md,
  },
  breadcrumbLink: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  breadcrumbSeparator: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  breadcrumbCurrent: {
    maxWidth: 220,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  centerStateTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  centerStateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    minHeight: 40,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  mediaSection: {
    backgroundColor: colors.surface,
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 0.82,
    backgroundColor: colors.brandSoft,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  thumbnailRow: {
    minHeight: 78,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  thumbnail: {
    width: 58,
    height: 58,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
  },
  thumbnailActive: {
    borderWidth: 2,
    borderColor: colors.brand,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: colors.brandPale,
  },
  productInfo: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
  },
  saleBadge: {
    minHeight: 24,
    borderRadius: radii.xs,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleBadgeText: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  priceRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  currentPrice: {
    color: colors.brand,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '900',
  },
  originalPrice: {
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 21,
    textDecorationLine: 'line-through',
  },
  quickStats: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 13,
    backgroundColor: colors.borderStrong,
  },
  selectorSection: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  selectorBlock: {
    gap: spacing.sm,
  },
  selectorHeader: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectorTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  selectorHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fitChip: {
    minHeight: 38,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  fitChipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  fitChipTextActive: {
    color: colors.white,
  },
  disabledChip: {
    opacity: 0.45,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  swatchButtonActive: {
    borderWidth: 2,
    borderColor: colors.action,
  },
  swatchColor: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeGuide: {
    color: colors.action,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sizeButton: {
    minWidth: 66,
    minHeight: 48,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  sizeButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  sizeButtonText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  sizeButtonTextActive: {
    color: colors.white,
  },
  sizeStockText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  sizeStockTextActive: {
    color: colors.white,
  },
  measurementPanel: {
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
  },
  measurementTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  measurementItem: {
    minWidth: '30%',
    flexGrow: 1,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  measurementLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  measurementValue: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  quantityRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepper: {
    height: 38,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepperButton: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.brandSoft,
  },
  quantityText: {
    minWidth: 40,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  stockHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  policyPanel: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  policyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCopy: {
    flex: 1,
    minWidth: 0,
  },
  policyTitle: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  policyDescription: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  reviewSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  ratingPanel: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadows.card,
  },
  ratingScoreBlock: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingScore: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingCount: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  ratingBars: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  ratingBarRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingBarLabel: {
    width: 9,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  ratingTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPale,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  ratingBarCount: {
    width: 24,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  experiencePanel: {
    marginTop: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  experienceRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  experienceLabel: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  reviewPlaceholder: {
    marginTop: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
  },
  reviewPlaceholderTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reviewPlaceholderText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  recommendationSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  recommendationItem: {
    width: '47.5%',
  },
  recommendationState: {
    minHeight: 112,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  recommendationStateText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  bottomButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomButtonDisabled: {
    backgroundColor: colors.field,
    borderColor: colors.border,
  },
  cartCta: {
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  buyCta: {
    backgroundColor: colors.brand,
  },
  cartCtaText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  buyCtaText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  bottomButtonTextDisabled: {
    color: colors.textSubtle,
  },
});

export default ProductDetailScreen;
