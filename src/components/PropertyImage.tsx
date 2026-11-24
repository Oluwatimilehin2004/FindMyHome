import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

/** Property cover photo; falls back to a neutral placeholder when there is no photo yet. */
export function PropertyImage({
  uri,
  height = 170,
  rounded = radius.md,
  style,
}: {
  uri: string | null | undefined;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!uri && !failed;
  return (
    <View style={[{ height, borderRadius: rounded, overflow: 'hidden', backgroundColor: colors.field }, style]}>
      {showPhoto ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient
          colors={['#DCD8D1', '#E6E3DE', '#EFEDE9']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="business-outline" size={Math.min(56, height * 0.4)} color="rgba(31,30,28,0.2)" />
        </LinearGradient>
      )}
    </View>
  );
}
