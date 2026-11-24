import { Platform, type ViewStyle } from 'react-native';

/**
 * FindMyHome design tokens.
 * Warm greige canvas, off-white surfaces, one near-black ink for emphasis.
 * Status colours are muted so the interface reads as a formal record, not a game.
 */
export const colors = {
  bg: '#E9E7E3', // app canvas
  card: '#F6F5F2', // primary surface
  raised: '#FFFFFF', // inputs, nested surfaces
  field: '#EFEDE9', // subtle fills, empty blocks
  text: '#1F1E1C', // primary ink
  muted: '#8A8782', // secondary text
  faint: '#B9B6B0', // tertiary text, placeholders
  border: '#E0DDD8',
  hairline: '#ECEAE6',
  primary: '#262523', // buttons, active states, accent bars
  primaryText: '#FFFFFF',
  hatch: '#CFCBC4', // hatched / partial blocks

  ok: '#3F6B4E',
  okSoft: '#E3EBE4',
  warn: '#8A6420',
  warnSoft: '#F1E9DA',
  danger: '#9A3B2E',
  dangerSoft: '#F3E3DF',
  info: '#3E4F66',
  infoSoft: '#E3E7ED',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };

/** Space to leave at the bottom of tab screens so content clears the floating tab bar. */
export const TAB_BAR_CLEARANCE = 110;

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#3A3630', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 1 },
  default: { shadowColor: '#3A3630', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
}) as ViewStyle;

export const strongShadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
  default: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
}) as ViewStyle;
