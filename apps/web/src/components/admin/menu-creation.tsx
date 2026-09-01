'use client';

import type { AdminCategory } from '@lanchonete/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { createCategory, createItem } from '@/lib/admin-endpoints';
import { parseReaisToCents } from '@/lib/money';

// Cadastro de categorias e itens (seção 5.5, gerente+). Separado da edição para
// que a tela de gestão diária não fique poluída pelo formulário de criação.
export function MenuCreation({
  categories,
  onChanged,
}: {
  categories: AdminCategory[];
  onChanged: () => void;
}) {
  return (
    <details className="rounded-xl border border-border-subtle bg-surface p-5">
      <summary className="cursor-pointer font-semibold">Cadastrar categoria ou item</summary>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <NewCategoryForm nextOrder={categories.length} onChanged={onChanged} />
        <NewItemForm categories={categories} onChanged={onChanged} />
      </div>
    </details>
  );
}

function NewCategoryForm({ nextOrder, onChanged }: { nextOrder: number; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [order, setOrder] = useState(String(nextOrder));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ name, order }: { name: string; order: number }) => createCategory(name, order),
    onSuccess: () => {
      setName('');
      onChanged();
    },
    onError: () => setError('Não foi possível criar a categoria.'),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = Number(order);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('A ordem precisa ser um número inteiro a partir de zero.');
      return;
    }
    mutation.mutate({ name, order: parsed });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-medium">Nova categoria</h3>

      <Field label="Nome" htmlFor="category-name" required>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Lanches"
        />
      </Field>

      <Field
        label="Ordem de exibição"
        htmlFor="category-order"
        required
        hint="Menor número aparece primeiro no cardápio."
      >
        <Input
          id="category-order"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          inputMode="numeric"
          required
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Criando…' : 'Criar categoria'}
      </Button>
    </form>
  );
}

function NewItemForm({
  categories,
  onChanged,
}: {
  categories: AdminCategory[];
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [photoUrl, setPhotoUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      setName('');
      setDescription('');
      setPrice('');
      setDiscount('0');
      setPhotoUrl('');
      onChanged();
    },
    onError: () => setError('Não foi possível criar o item.'),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const priceCents = parseReaisToCents(price);
    if (priceCents === null || priceCents <= 0) {
      setError('Informe o preço como 12,90 e maior que zero.');
      return;
    }
    const discountPercent = Number(discount);
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setError('O desconto vai de 0 a 100.');
      return;
    }
    if (!categoryId) {
      setError('Escolha a categoria.');
      return;
    }

    mutation.mutate({
      name,
      priceCents,
      discountPercent,
      categoryId,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-medium">Novo item</h3>

      <Field label="Nome" htmlFor="item-name" required>
        <Input
          id="item-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="X-Burger"
        />
      </Field>

      <Field label="Descrição" htmlFor="item-description">
        <Input
          id="item-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          placeholder="Pão, hambúrguer, queijo e salada"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço" htmlFor="item-price" required>
          <Input
            id="item-price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            required
            placeholder="12,90"
          />
        </Field>

        <Field label="Desconto %" htmlFor="item-discount" required>
          <Input
            id="item-discount"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            inputMode="numeric"
            required
          />
        </Field>
      </div>

      <Field label="URL da foto" htmlFor="item-photo" hint="Opcional. Endereço público da imagem.">
        <Input
          id="item-photo"
          type="url"
          value={photoUrl}
          onChange={(event) => setPhotoUrl(event.target.value)}
          placeholder="https://…"
        />
      </Field>

      <Field label="Categoria" htmlFor="item-category" required>
        <Select
          id="item-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
        >
          <option value="">Selecione</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Criando…' : 'Criar item'}
      </Button>
    </form>
  );
}
