import {
  Baby,
  BookOpen,
  Bot,
  Bus,
  CarTaxiFront,
  Coffee,
  Dumbbell,
  Film,
  Flower2,
  Fuel,
  Gamepad2,
  GraduationCap,
  Hammer,
  Laptop,
  Package,
  PawPrint,
  Pill,
  Plane,
  Shirt,
  ShoppingCart,
  Sparkle,
  Sparkles,
  Stethoscope,
  Store,
  Zap,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  ShoppingCart,
  Laptop,
  Fuel,
  Shirt,
  Coffee,
  Sparkles,
  Baby,
  Hammer,
  Pill,
  Stethoscope,
  Zap,
  PawPrint,
  Bus,
  Package,
  CarTaxiFront,
  Film,
  BookOpen,
  GraduationCap,
  Plane,
  Flower2,
  Store,
  Gamepad2,
  Dumbbell,
  Bot,
  Sparkle,
};

interface CategoryIconProps extends LucideProps {
  iconName: string;
}

export function CategoryIcon({ iconName, ...props }: CategoryIconProps) {
  const Icon = ICON_MAP[iconName] ?? Sparkle;
  return <Icon {...props} />;
}
