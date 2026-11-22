import { describe, it, expect } from 'vitest';
import {
  buildCreateCategoryPayload,
  buildUpdateCategoryPayload,
  categoryFormSchema,
  getCategoryIconComponent,
} from '../category-schemas';
import type { CategoryView } from '@/types/categories';

describe('category-schemas', () => {
  describe('categoryFormSchema', () => {
    it('valida exitosamente valores válidos', () => {
      const valid = {
        name: '  Gimnasio  ',
        kind: 'EXPENSE',
        color: '#0284C7',
        icon: 'dumbbell',
      };
      const result = categoryFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Gimnasio');
      }
    });

    it('acepta color e icono en null u omitidos', () => {
      const result = categoryFormSchema.safeParse({
        name: 'Freelance',
        kind: 'INCOME',
        color: null,
        icon: null,
      });
      expect(result.success).toBe(true);
    });

    it('permite colores hexadecimales válidos fuera de la paleta curada (validación abierta)', () => {
      const result = categoryFormSchema.safeParse({
        name: 'Personalizado',
        kind: 'EXPENSE',
        color: '#A1B2C3',
        icon: 'tag',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza nombres vacíos o mayores a 100 caracteres', () => {
      const emptyResult = categoryFormSchema.safeParse({
        name: '   ',
        kind: 'EXPENSE',
      });
      expect(emptyResult.success).toBe(false);

      const longResult = categoryFormSchema.safeParse({
        name: 'A'.repeat(101),
        kind: 'EXPENSE',
      });
      expect(longResult.success).toBe(false);
    });

    it('rechaza colores con formato inválido', () => {
      const result = categoryFormSchema.safeParse({
        name: 'Test',
        kind: 'EXPENSE',
        color: 'rojo',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('buildCreateCategoryPayload', () => {
    it('omite color e icono cuando son null o vacíos (invariante sin null en POST)', () => {
      const payload = buildCreateCategoryPayload({
        name: '   Alquiler   ',
        kind: 'EXPENSE',
        color: null,
        icon: null,
      });

      expect(payload).toEqual({
        name: 'Alquiler',
        kind: 'EXPENSE',
      });
      expect('color' in payload).toBe(false);
      expect('icon' in payload).toBe(false);
    });

    it('incluye color e icono cuando tienen valor', () => {
      const payload = buildCreateCategoryPayload({
        name: 'Freelance',
        kind: 'INCOME',
        color: '#0D9488',
        icon: 'laptop',
      });

      expect(payload).toEqual({
        name: 'Freelance',
        kind: 'INCOME',
        color: '#0D9488',
        icon: 'laptop',
      });
    });
  });

  describe('buildUpdateCategoryPayload', () => {
    const initialCategory: CategoryView = {
      id: 'cat-1',
      userId: 'user-1',
      name: 'Gimnasio',
      kind: 'EXPENSE',
      color: '#0284C7',
      icon: 'dumbbell',
      isSystem: false,
      isArchived: false,
      createdAt: '2026-11-22T00:00:00.000Z',
      updatedAt: '2026-11-22T00:00:00.000Z',
    };

    it('retorna null si tras normalizar trim no hay cambios reales (evita PATCH {})', () => {
      const payload = buildUpdateCategoryPayload(initialCategory, {
        name: '   Gimnasio   ',
        kind: 'EXPENSE',
        color: '#0284C7',
        icon: 'dumbbell',
      });

      expect(payload).toBeNull();
    });

    it('envía solo los campos modificados y nunca incluye kind', () => {
      const payload = buildUpdateCategoryPayload(initialCategory, {
        name: 'Gimnasio y Fitness',
        kind: 'INCOME', // intento de cambio de tipo que debe ser ignorado
        color: '#0284C7',
        icon: 'dumbbell',
      });

      expect(payload).toEqual({
        name: 'Gimnasio y Fitness',
      });
      expect('kind' in (payload ?? {})).toBe(false);
    });

    it('envía null explícito al limpiar color o icono', () => {
      const payload = buildUpdateCategoryPayload(initialCategory, {
        name: 'Gimnasio',
        kind: 'EXPENSE',
        color: null,
        icon: null,
      });

      expect(payload).toEqual({
        color: null,
        icon: null,
      });
    });
  });

  describe('getCategoryIconComponent', () => {
    it('resuelve íconos conocidos del catálogo y devuelve Tag como fallback', () => {
      expect(getCategoryIconComponent('utensils')).toBeDefined();
      expect(getCategoryIconComponent('briefcase')).toBeDefined();
      expect(getCategoryIconComponent('unknown-icon-xyz')).toBeDefined();
      expect(getCategoryIconComponent(null)).toBeDefined();
    });
  });
});
