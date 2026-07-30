import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { Type, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant = keyof typeof Type;

export type TextProps = RNTextProps & {
  /** Step on the type scale. Defaults to body copy. */
  variant?: TextVariant;
  /** Theme colour token. Defaults to primary text. */
  color?: ThemeColor;
};

/**
 * Typography primitive. Everything user-facing should go through this rather
 * than raw `<Text>`, so the scale in `constants/theme.ts` stays the single
 * source of hierarchy.
 */
export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();

  return <RNText style={[Type[variant] as TextStyle, { color: theme[color] }, style]} {...rest} />;
}
