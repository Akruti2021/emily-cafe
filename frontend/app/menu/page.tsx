'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  RefreshCw,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../src/api/client';

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  taxRate: number | string;
  status?: 'active' | 'inactive';
};

type MenuCategory = {
  id: string;
  name: string;
  sortOrder?: number;
  status?: 'active' | 'inactive';
  items: MenuItem[];
};

type MenuResponse = {
  categories: MenuCategory[];
};

type RestaurantSummary = {
  id: string;
  name: string;
  status: string;
};

type CategoryForm = {
  name: string;
  sortOrder: string;
  status: 'active' | 'inactive';
};

type ItemForm = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  taxRate: string;
  status: 'active' | 'inactive';
};

const emptyCategory: CategoryForm = {
  name: '',
  sortOrder: '0',
  status: 'active',
};

const emptyItem: ItemForm = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  taxRate: '0',
  status: 'active',
};

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

export default function MenuPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [restaurantId, setRestaurantId] = useState('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);

  const [itemDialog, setItemDialog] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItem);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Resolve the active restaurant after authentication is ready.
  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    async function resolveRestaurant() {
      const storedId = window.localStorage.getItem('active_restaurant_id');

      if (storedId) {
        setRestaurantId(storedId);
        return;
      }

      setLoadingMenu(true);
      setError('');

      try {
        const response = await api.get<RestaurantSummary[]>('/org/restaurants');

        const restaurant = response.data.find(
          (item) => item.status === 'active',
        );

        if (cancelled) return;

        if (!restaurant) {
          setError('No active restaurant was found for your account.');
          setLoadingMenu(false);
          return;
        }

        window.localStorage.setItem(
          'active_restaurant_id',
          restaurant.id,
        );

        setRestaurantId(restaurant.id);
      } catch (err) {
        if (cancelled) return;

        setError(getErrorMessage(err));
        setLoadingMenu(false);
      }
    }

    void resolveRestaurant();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const loadMenu = useCallback(async () => {
    if (!restaurantId) {
      setLoadingMenu(false);
      return;
    }

    setLoadingMenu(true);
    setError('');

    try {
      const response = await api.get<MenuResponse>(
        `/menu/${encodeURIComponent(restaurantId)}/manage`,
      );

      setCategories(response.data.categories ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingMenu(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (restaurantId) {
      void loadMenu();
    }
  }, [restaurantId, loadMenu]);

  function openNewCategory() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategory);
    setError('');
    setNotice('');
    setCategoryDialog(true);
  }

  function openEditCategory(category: MenuCategory) {
    setEditingCategoryId(category.id);

    setCategoryForm({
      name: category.name,
      sortOrder: String(category.sortOrder ?? 0),
      status: category.status ?? 'active',
    });

    setError('');
    setNotice('');
    setCategoryDialog(true);
  }

  function openNewItem(categoryId = '') {
    setEditingItemId(null);

    setItemForm({
      ...emptyItem,
      categoryId: categoryId || categories[0]?.id || '',
    });

    setError('');
    setNotice('');
    setItemDialog(true);
  }

  function openEditItem(item: MenuItem, categoryId: string) {
    setEditingItemId(item.id);

    setItemForm({
      categoryId,
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      taxRate: String(item.taxRate),
      status: item.status ?? 'active',
    });

    setError('');
    setNotice('');
    setItemDialog(true);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        name: categoryForm.name.trim(),
        sortOrder: Number(categoryForm.sortOrder),
        status: categoryForm.status,
      };

      if (editingCategoryId) {
        await api.patch(
          `/menu/${encodeURIComponent(restaurantId)}/categories/${encodeURIComponent(editingCategoryId)}`,
          payload,
        );
      } else {
        await api.post(
          `/menu/${encodeURIComponent(restaurantId)}/categories`,
          payload,
        );
      }

      setCategoryDialog(false);

      setNotice(
        editingCategoryId ? 'Category updated.' : 'Category created.',
      );

      await loadMenu();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        categoryId: itemForm.categoryId,
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        basePrice: Number(itemForm.price),
        taxRate: Number(itemForm.taxRate),
        status: itemForm.status,
      };

      if (editingItemId) {
        await api.patch(
          `/menu/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(editingItemId)}`,
          payload,
        );
      } else {
        await api.post(
          `/menu/${encodeURIComponent(restaurantId)}/items`,
          payload,
        );
      }

      setItemDialog(false);

      setNotice(
        editingItemId ? 'Menu item updated.' : 'Menu item created.',
      );

      await loadMenu();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleItemStatus(item: MenuItem) {
    if (!restaurantId) return;

    const nextStatus =
      item.status === 'inactive' ? 'active' : 'inactive';

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.patch(
        `/menu/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(item.id)}`,
        { status: nextStatus },
      );

      setNotice(`${item.name} marked ${nextStatus}.`);

      await loadMenu();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryStatus(category: MenuCategory) {
    if (!restaurantId) return;

    const nextStatus =
      category.status === 'inactive' ? 'active' : 'inactive';

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.patch(
        `/menu/${encodeURIComponent(restaurantId)}/categories/${encodeURIComponent(category.id)}`,
        { status: nextStatus },
      );

      setNotice(`${category.name} marked ${nextStatus}.`);

      await loadMenu();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf7f2]">
        <LoaderCircle className="h-6 w-6 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] px-4 py-6 text-stone-800 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="mt-1 rounded-xl border border-stone-200 bg-white p-2.5 hover:bg-stone-50"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>
              <p className="mb-1 text-sm font-medium text-blue-600">
                Emily Cafe
              </p>

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Menu Management
              </h1>

              <p className="mt-1 text-sm text-stone-500">
                Manage categories, menu items, pricing and availability.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadMenu()}
              disabled={loadingMenu || !restaurantId}
              className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`}
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingMenu ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openNewCategory}
              disabled={!restaurantId || saving}
              className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`}
            >
              <Plus className="h-4 w-4" />
              Add category
            </button>

            <button
              type="button"
              onClick={() => openNewItem()}
              disabled={!restaurantId || categories.length === 0 || saving}
              className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
            >
              <Plus className="h-4 w-4" />
              Add menu item
            </button>
          </div>
        </header>

        {!restaurantId && !loadingMenu && (
          <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            No active restaurant is selected. If you have already completed
            restaurant onboarding, check the error message below or try
            refreshing the page.
          </section>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <UtensilsCrossed className="h-5 w-5" />
            </div>

            <p className="text-sm text-stone-500">Categories</p>
            <p className="mt-1 text-2xl font-semibold">{categories.length}</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <p className="text-sm text-stone-500">Menu items</p>

            <p className="mt-1 text-2xl font-semibold">
              {categories.reduce(
                (total, category) => total + category.items.length,
                0,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>

            <p className="text-sm text-stone-500">Active items</p>

            <p className="mt-1 text-2xl font-semibold">
              {categories.reduce(
                (total, category) =>
                  total +
                  category.items.filter(
                    (item) => item.status !== 'inactive',
                  ).length,
                0,
              )}
            </p>
          </div>
        </section>

        {loadingMenu ? (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <LoaderCircle className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-3 text-sm text-stone-500">
              Loading menu…
            </span>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
            <UtensilsCrossed className="mx-auto mb-4 h-10 w-10 text-stone-400" />

            <h2 className="text-lg font-semibold">Your menu is empty</h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
              Create a category first, such as Starters, Main Course or Drinks.
              Then add items to it.
            </p>

            <button
              type="button"
              onClick={openNewCategory}
              disabled={!restaurantId}
              className={`${buttonClass} mt-5 bg-blue-600 text-white hover:bg-blue-700`}
            >
              <Plus className="h-4 w-4" />
              Create first category
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {categories.map((category) => (
              <section
                key={category.id}
                className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        {category.name}
                      </h2>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          category.status === 'inactive'
                            ? 'bg-stone-200 text-stone-600'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {category.status ?? 'active'}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-stone-500">
                      {category.items.length}{' '}
                      {category.items.length === 1 ? 'item' : 'items'}
                      {category.sortOrder !== undefined
                        ? ` · Sort order ${category.sortOrder}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditCategory(category)}
                      disabled={saving}
                      className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-100`}
                    >
                      Edit category
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleCategoryStatus(category)}
                      disabled={saving}
                      className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-100`}
                    >
                      {category.status === 'inactive' ? 'Activate' : 'Deactivate'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openNewItem(category.id)}
                      disabled={saving || category.status === 'inactive'}
                      className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                    >
                      <Plus className="h-4 w-4" />
                      Add item
                    </button>
                  </div>
                </div>

                {category.items.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-stone-500">
                    No items in this category yet.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{item.name}</h3>

                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                item.status === 'inactive'
                                  ? 'bg-stone-100 text-stone-500'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {item.status ?? 'active'}
                            </span>
                          </div>

                          {item.description && (
                            <p className="mt-1 max-w-2xl text-sm text-stone-500">
                              {item.description}
                            </p>
                          )}

                          <p className="mt-2 text-sm text-stone-500">
                            Tax rate: {Number(item.taxRate)}%
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          <span className="text-lg font-semibold">
                            ₹{Number(item.price).toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={() => openEditItem(item, category.id)}
                            disabled={saving}
                            className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void toggleItemStatus(item)}
                            disabled={saving}
                            className={`${buttonClass} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`}
                          >
                            {item.status === 'inactive' ? 'Activate' : 'Deactivate'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {categoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <form
            onSubmit={saveCategory}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingCategoryId ? 'Edit category' : 'New category'}
              </h2>

              <button
                type="button"
                onClick={() => setCategoryDialog(false)}
                className="rounded-lg p-2 hover:bg-stone-100"
                aria-label="Close category form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium">
              Category name
            </label>

            <input
              className={inputClass}
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm({
                  ...categoryForm,
                  name: event.target.value,
                })
              }
              maxLength={100}
              required
              placeholder="e.g. Starters"
            />

            <label className="mb-2 mt-4 block text-sm font-medium">
              Sort order
            </label>

            <input
              className={inputClass}
              type="number"
              min="0"
              step="1"
              value={categoryForm.sortOrder}
              onChange={(event) =>
                setCategoryForm({
                  ...categoryForm,
                  sortOrder: event.target.value,
                })
              }
              required
            />

            {editingCategoryId && (
              <>
                <label className="mb-2 mt-4 block text-sm font-medium">
                  Status
                </label>

                <select
                  className={inputClass}
                  value={categoryForm.status}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      status: event.target.value as CategoryForm['status'],
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCategoryDialog(false)}
                className={`${buttonClass} border border-stone-200 text-stone-700`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
              >
                {saving
                  ? 'Saving…'
                  : editingCategoryId
                    ? 'Save changes'
                    : 'Create category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {itemDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/40 p-4">
          <form
            onSubmit={saveItem}
            className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingItemId ? 'Edit menu item' : 'New menu item'}
              </h2>

              <button
                type="button"
                onClick={() => setItemDialog(false)}
                className="rounded-lg p-2 hover:bg-stone-100"
                aria-label="Close item form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium">
              Category
            </label>

            <select
              className={inputClass}
              value={itemForm.categoryId}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  categoryId: event.target.value,
                })
              }
              required
            >
              <option value="">Choose a category</option>

              {categories
                .filter(
                  (category) =>
                    category.status !== 'inactive' ||
                    category.id === itemForm.categoryId,
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>

            <label className="mb-2 mt-4 block text-sm font-medium">
              Item name
            </label>

            <input
              className={inputClass}
              value={itemForm.name}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  name: event.target.value,
                })
              }
              maxLength={180}
              required
              placeholder="e.g. Paneer Tikka"
            />

            <label className="mb-2 mt-4 block text-sm font-medium">
              Description (optional)
            </label>

            <textarea
              className={inputClass}
              value={itemForm.description}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  description: event.target.value,
                })
              }
              rows={3}
              placeholder="Describe the dish"
            />

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Price (₹)
                </label>

                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.price}
                  onChange={(event) =>
                    setItemForm({
                      ...itemForm,
                      price: event.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Tax rate (%)
                </label>

                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={itemForm.taxRate}
                  onChange={(event) =>
                    setItemForm({
                      ...itemForm,
                      taxRate: event.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            {editingItemId && (
              <>
                <label className="mb-2 mt-4 block text-sm font-medium">
                  Status
                </label>

                <select
                  className={inputClass}
                  value={itemForm.status}
                  onChange={(event) =>
                    setItemForm({
                      ...itemForm,
                      status: event.target.value as ItemForm['status'],
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemDialog(false)}
                className={`${buttonClass} border border-stone-200 text-stone-700`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
              >
                {saving
                  ? 'Saving…'
                  : editingItemId
                    ? 'Save changes'
                    : 'Create menu item'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
