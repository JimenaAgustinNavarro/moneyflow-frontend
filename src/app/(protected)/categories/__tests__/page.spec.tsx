import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CategoriesPage from '../page';
import { categoriesApi } from '@/lib/categories-api';
import { ApiError } from '@/lib/api-client';
import type {
  CategoryResponse,
  CategoryView,
  ListCategoriesResponse,
  ArchiveCategoryResponse,
  UnarchiveCategoryResponse,
} from '@/types/categories';

vi.mock('@/lib/categories-api', () => ({
  categoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
  },
}));

const mockSystemIncome: CategoryView = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: null,
  name: 'Salario',
  kind: 'INCOME',
  color: '#16A34A',
  icon: 'briefcase',
  isSystem: true,
  isArchived: false,
  createdAt: '2026-11-22T08:00:00.000Z',
  updatedAt: '2026-11-22T08:00:00.000Z',
};

const mockCustomExpense: CategoryView = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: 'user-1',
  name: 'Gimnasio',
  kind: 'EXPENSE',
  color: '#0284C7',
  icon: 'dumbbell',
  isSystem: false,
  isArchived: false,
  createdAt: '2026-11-22T10:00:00.000Z',
  updatedAt: '2026-11-22T10:00:00.000Z',
};

const mockCustomArchived: CategoryView = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: 'user-1',
  name: 'Cursos Antiguos',
  kind: 'EXPENSE',
  color: '#CA8A04',
  icon: 'graduation-cap',
  isSystem: false,
  isArchived: true,
  createdAt: '2026-11-22T09:00:00.000Z',
  updatedAt: '2026-11-22T09:00:00.000Z',
};

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza listado inicial diferenciando categorías de sistema y personalizadas', async () => {
    const listResponse: ListCategoriesResponse = {
      categories: [mockSystemIncome, mockCustomExpense],
    };
    vi.mocked(categoriesApi.list).mockResolvedValueOnce(listResponse);

    render(<CategoriesPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Salario')).toBeInTheDocument();
      expect(screen.getByText('Gimnasio')).toBeInTheDocument();
    });

    // Categoría de sistema: muestra badge 'Sistema' y no tiene botones de editar ni archivar
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar categoría Salario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivar categoría Salario' })).not.toBeInTheDocument();

    // Categoría personalizada activa: tiene botones de editar y archivar
    expect(screen.getByRole('button', { name: 'Editar categoría Gimnasio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archivar categoría Gimnasio' })).toBeInTheDocument();
  });

  it('filtra por tipo (INCOME, EXPENSE) y checkbox de archivadas', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: [mockSystemIncome, mockCustomExpense],
    });

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Salario')).toBeInTheDocument();
    });

    // Filtrar por Ingresos
    const incomeFilter = screen.getByRole('button', { name: 'Ingresos' });
    fireEvent.click(incomeFilter);

    await waitFor(() => {
      expect(categoriesApi.list).toHaveBeenCalledWith({
        kind: 'INCOME',
        includeArchived: false,
      });
    });

    // Activar mostrar archivadas
    const archivedCheckbox = screen.getByLabelText('Mostrar archivadas');
    fireEvent.click(archivedCheckbox);

    await waitFor(() => {
      expect(categoriesApi.list).toHaveBeenCalledWith({
        kind: 'INCOME',
        includeArchived: true,
      });
    });
  });

  it('muestra estado de error y permite reintentar', async () => {
    vi.mocked(categoriesApi.list)
      .mockRejectedValueOnce(new ApiError(500, 'InternalError', 'Fallo del servidor'))
      .mockResolvedValueOnce({ categories: [mockSystemIncome] });

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar las categorías')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Salario')).toBeInTheDocument();
    });
  });

  it('crea una nueva categoría omitiendo color/icon si no se eligen y maneja 409 Conflict', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue({ categories: [] });
    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('No se encontraron categorías')).toBeInTheDocument();
    });

    // Abrir modal
    fireEvent.click(screen.getAllByRole('button', { name: /Nueva categoría|Crear categoría/i })[0]);

    const modal = screen.getByRole('dialog', { name: 'Nueva categoría' });
    expect(modal).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Nombre de la categoría');
    fireEvent.change(nameInput, { target: { value: 'Inversiones Cripto' } });

    // Simular 409 Conflict en creación
    vi.mocked(categoriesApi.create).mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'Ya existe una categoría activa con el nombre "Inversiones Cripto".'),
    );

    const submitBtn = within(modal).getByRole('button', { name: 'Crear categoría' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Ya existe una categoría activa con el nombre "Inversiones Cripto".'),
      ).toBeInTheDocument();
    });

    // El modal NO se cierra y conserva lo escrito
    expect(screen.getByRole('dialog', { name: 'Nueva categoría' })).toBeInTheDocument();
    expect(nameInput).toHaveValue('Inversiones Cripto');

    // Ahora simular creación exitosa
    const createdResponse: CategoryResponse = {
      category: {
        id: 'new-cat-1',
        userId: 'user-1',
        name: 'Inversiones Cripto',
        kind: 'EXPENSE',
        color: null,
        icon: null,
        isSystem: false,
        isArchived: false,
        createdAt: '2026-11-22T12:00:00.000Z',
        updatedAt: '2026-11-22T12:00:00.000Z',
      },
    };
    vi.mocked(categoriesApi.create).mockResolvedValueOnce(createdResponse);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categoriesApi.create).toHaveBeenCalledWith({
        name: 'Inversiones Cripto',
        kind: 'EXPENSE',
      });
      expect(screen.queryByRole('dialog', { name: 'Nueva categoría' })).not.toBeInTheDocument();
    });
  });

  it('edita una categoría propia activa, bloquea PATCH {} y maneja limpieza de color a null', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: [mockCustomExpense],
    });

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Gimnasio')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar categoría Gimnasio' }));

    const modal = screen.getByRole('dialog', { name: 'Editar categoría' });
    expect(modal).toBeInTheDocument();

    // El botón Guardar cambios debe estar deshabilitado al inicio porque no hay cambios
    const saveBtn = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(saveBtn).toBeDisabled();

    // Limpiar color existente -> debe habilitar guardar
    const clearColorBtn = screen.getByText('Limpiar color');
    fireEvent.click(clearColorBtn);
    expect(saveBtn).not.toBeDisabled();

    // Simular guardado exitoso
    const updatedResponse: CategoryResponse = {
      category: {
        ...mockCustomExpense,
        color: null,
      },
    };
    vi.mocked(categoriesApi.update).mockResolvedValueOnce(updatedResponse);

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(categoriesApi.update).toHaveBeenCalledWith(mockCustomExpense.id, {
        color: null,
      });
      expect(screen.queryByRole('dialog', { name: 'Editar categoría' })).not.toBeInTheDocument();
    });
  });

  it('archiva una categoría propia mostrando modal de confirmación con aviso de preservación', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: [mockCustomExpense],
    });

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Gimnasio')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archivar categoría Gimnasio' }));

    const modal = screen.getByRole('dialog', { name: 'Archivar categoría' });
    expect(modal).toBeInTheDocument();
    expect(
      screen.getByText(/El historial de transacciones existentes se conservará intacto/i),
    ).toBeInTheDocument();

    const archiveResponse: ArchiveCategoryResponse = {
      id: mockCustomExpense.id,
      isArchived: true,
      message: 'Category archived successfully.',
    };
    vi.mocked(categoriesApi.archive).mockResolvedValueOnce(archiveResponse);

    const confirmBtn = screen.getByRole('button', { name: 'Confirmar archivado' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(categoriesApi.archive).toHaveBeenCalledWith(mockCustomExpense.id);
      expect(screen.queryByRole('dialog', { name: 'Archivar categoría' })).not.toBeInTheDocument();
    });
  });

  it('desarchiva una categoría con protección anti-doble clic y maneja 409 Conflict', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: [mockCustomArchived],
    });

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Cursos Antiguos')).toBeInTheDocument();
    });

    const unarchiveBtn = screen.getByRole('button', {
      name: 'Desarchivar categoría Cursos Antiguos',
    });

    // Simular fallo con 409 Conflict
    vi.mocked(categoriesApi.unarchive).mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'Ya existe una categoría activa con el nombre "Cursos Antiguos".'),
    );

    fireEvent.click(unarchiveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Operación no completada/i)).toBeInTheDocument();
      expect(
        screen.getByText('Ya existe una categoría activa con el nombre "Cursos Antiguos".'),
      ).toBeInTheDocument();
    });

    // Ahora simular éxito
    const unarchiveRes: UnarchiveCategoryResponse = {
      id: mockCustomArchived.id,
      isArchived: false,
      message: 'Category unarchived successfully.',
    };
    vi.mocked(categoriesApi.unarchive).mockResolvedValueOnce(unarchiveRes);

    fireEvent.click(unarchiveBtn);

    await waitFor(() => {
      expect(categoriesApi.unarchive).toHaveBeenCalledWith(mockCustomArchived.id);
    });
  });

  it('cierra modales al presionar la tecla Escape', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue({ categories: [] });
    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('No se encontraron categorías')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Nueva categoría|Crear categoría/i })[0]);
    expect(screen.getByRole('dialog', { name: 'Nueva categoría' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Nueva categoría' })).not.toBeInTheDocument();
  });
});
