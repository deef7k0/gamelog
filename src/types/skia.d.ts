declare module '@shopify/react-native-skia' {
  import type { ComponentType, ReactNode } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface SkImage {
    width(): number;
    height(): number;
  }

  export function useImage(
    source: string | number | null | undefined
  ): SkImage | null;

  export interface CanvasProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    pointerEvents?: 'none' | 'box-none' | 'box-only' | 'auto';
  }

  export const Canvas: ComponentType<CanvasProps>;

  export interface BlurProps {
    blur: any;
    mode?: 'clamp' | 'repeat' | 'mirror' | 'decal';
  }

  export const Blur: ComponentType<BlurProps>;

  export interface GroupProps {
    children?: ReactNode;
    transform?: any;
    opacity?: any;
  }

  export const Group: ComponentType<GroupProps>;

  export interface ImageProps {
    image: SkImage | null;
    x?: number;
    y?: number;
    width: number;
    height: number;
    fit?: 'cover' | 'contain' | 'fill' | 'fitWidth' | 'fitHeight' | 'none' | 'scaleDown';
    children?: ReactNode;
  }

  export const Image: ComponentType<ImageProps>;
}
