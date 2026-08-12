import {
  Home,
  Utensils,
  Car,
  Zap,
  HeartPulse,
  PartyPopper,
  Wallet,
  ShoppingCart,
  Plane,
  Dog,
  Baby,
  Dumbbell,
  GraduationCap,
  Gift,
  Smartphone,
  Shirt,
  Coffee,
  Bus,
  Scissors,
  Book,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  zap: Zap,
  "heart-pulse": HeartPulse,
  party: PartyPopper,
  wallet: Wallet,
  cart: ShoppingCart,
  plane: Plane,
  dog: Dog,
  baby: Baby,
  gym: Dumbbell,
  school: GraduationCap,
  gift: Gift,
  phone: Smartphone,
  shirt: Shirt,
  coffee: Coffee,
  bus: Bus,
  scissors: Scissors,
  book: Book,
};

export const ICON_KEYS = Object.keys(ICONS);

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Wallet;
}
