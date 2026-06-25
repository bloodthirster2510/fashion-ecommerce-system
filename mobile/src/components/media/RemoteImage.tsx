import React from 'react';
import { Image as ExpoImage, ImageProps } from 'expo-image';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { colors } from '../../theme';

type RemoteImageProps = {
  uri: string;
  style?: ImageProps['style'];
  recyclingKey?: string;
  resizeMode?: ImageProps['contentFit'];
  transition?: number;
};

const fallbackStyle = StyleSheet.absoluteFillObject;

export const RemoteImage = React.memo(function RemoteImage({
  uri,
  style,
  recyclingKey,
  resizeMode = 'cover',
  transition = 200,
}: RemoteImageProps) {
  if (!uri) {
    return <View style={[fallbackStyle, style as unknown as View['props']['style']]} />;
  }

  return (
    <ExpoImage
      source={uri}
      style={style}
      recyclingKey={recyclingKey ?? uri}
      contentFit={resizeMode}
      transition={transition}
      cachePolicy="memory-disk"
      placeholder={undefined}
    />
  );
});

export const RemoteImageWithSpinner = React.memo(function RemoteImageWithSpinner({
  uri,
  style,
  recyclingKey,
  resizeMode = 'cover',
}: RemoteImageProps) {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
  }, [uri]);

  return (
    <View style={[fallbackStyle, style as unknown as View['props']['style']]}>
      <ExpoImage
        source={uri}
        style={StyleSheet.absoluteFillObject}
        recyclingKey={recyclingKey ?? uri}
        contentFit={resizeMode}
        transition={200}
        cachePolicy="memory-disk"
        onLoad={() => setLoaded(true)}
      />
      {!loaded ? <ActivityIndicator style={StyleSheet.absoluteFillObject} color={colors.brand} /> : null}
    </View>
  );
});