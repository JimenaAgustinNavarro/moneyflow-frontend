import { z } from 'zod';
import {
  Briefcase,
  Car,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Receipt,
  ShoppingBag,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type {
  CategoryView,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '@/types/categories';

export const CATEGORY_NAME_MAX_LENGTH = 100;
export const CATEGORY_ICON_MAX_LENGTH = 50;
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const CURATED_COLOR_PALETTE: readonly string[] = [
  '#16A34A', // Verde éxito
  '#0D9488', // Teal
  '#2563EB', // Azul primario
  '#9333EA', // Púrpura
  '#EA580C', // Naranja
  '#0284C7', // Celeste
  '#4F46E5', // Índigo
  '#CA8A04', // Amarillo/Dorado
  '#DC2626', // Rojo
  '#059669', // Esmeralda
  '#D946EF', // Fucsia
  '#EC4899', // Rosa
  '#6B7280', // Gris neutro
  '#0F172A', // Slate oscuro
];

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  car: Car,
  dumbbell: Dumbbell,
  film: Film,
  gift: Gift,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  home: Home,
  laptop: Laptop,
  receipt: Receipt,
  'shopping-bag': ShoppingBag,
  'trending-up': TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  zap: Zap,
  tag: Tag,
};

export const CURATED_ICON_CATALOG: readonly { name: string; label: string }[] = [
  { name: 'briefcase', label: 'Trabajo / Salario' },
  { name: 'laptop', label: 'Freelance / Tecnología' },
  { name: 'trending-up', label: 'Inversiones' },
  { name: 'gift', label: 'Regalos' },
  { name: 'wallet', label: 'Billetera / Ingresos' },
  { name: 'utensils', label: 'Alimentación' },
  { name: 'car', label: 'Transporte' },
  { name: 'home', label: 'Vivienda' },
  { name: 'zap', label: 'Servicios' },
  { name: 'heart-pulse', label: 'Salud' },
  { name: 'graduation-cap', label: 'Educación' },
  { name: 'film', label: 'Entretenimiento' },
  { name: 'shopping-bag', label: 'Compras' },
  { name: 'dumbbell', label: 'Gimnasio / Deportes' },
  { name: 'receipt', label: 'Recibos / Gastos' },
  { name: 'tag', label: 'General' },
];

export function getCategoryIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName) {
    return Tag;
  }
  const normalized = iconName.trim().toLowerCase();
  return CATEGORY_ICON_MAP[normalized] ?? Tag;
}

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio.')
    .max(
      CATEGORY_NAME_MAX_LENGTH,
      `El nombre no puede superar los ${CATEGORY_NAME_MAX_LENGTH} caracteres.`,
    ),
  kind: z.enum(['INCOME', 'EXPENSE'], {
    message: 'El tipo debe ser INCOME o EXPENSE.',
  }),
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, 'El color debe tener formato hexadecimal #RRGGBB.')
    .nullable()
    .optional(),
  icon: z
    .string()
    .trim()
    .min(1, 'El ícono debe tener al menos 1 caracter.')
    .max(
      CATEGORY_ICON_MAX_LENGTH,
      `El nombre del ícono no puede superar los ${CATEGORY_ICON_MAX_LENGTH} caracteres.`,
    )
    .nullable()
    .optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function buildCreateCategoryPayload(values: CategoryFormValues): CreateCategoryPayload {
  const trimmedName = values.name.trim();
  const payload: CreateCategoryPayload = {
    name: trimmedName,
    kind: values.kind,
  };

  const normalizedColor = values.color?.trim() || null;
  if (normalizedColor) {
    payload.color = normalizedColor;
  }

  const normalizedIcon = values.icon?.trim() || null;
  if (normalizedIcon) {
    payload.icon = normalizedIcon;
  }

  return payload;
}

export function buildUpdateCategoryPayload(
  initial: Pick<CategoryView, 'name' | 'color' | 'icon'>,
  values: CategoryFormValues,
): UpdateCategoryPayload | null {
  const initialName = initial.name.trim();
  const newName = values.name.trim();

  const initialColor = initial.color?.trim() || null;
  const newColor = values.color?.trim() || null;

  const initialIcon = initial.icon?.trim() || null;
  const newIcon = values.icon?.trim() || null;

  const changes: UpdateCategoryPayload = {};
  let hasChanges = false;

  if (initialName !== newName) {
    changes.name = newName;
    hasChanges = true;
  }

  if (initialColor !== newColor) {
    changes.color = newColor;
    hasChanges = true;
  }

  if (initialIcon !== newIcon) {
    changes.icon = newIcon;
    hasChanges = true;
  }

  return hasChanges ? changes : null;
}
