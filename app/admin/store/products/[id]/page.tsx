import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { isValidId } from '@/lib/security';
import { centsToInput } from '@/lib/store/format';
import ProductForm from '../ProductForm';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) redirect('/members');
  const { id } = await params;
  if (!isValidId(id)) notFound();
  const [p, categories] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.productCategory.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  return (
    <ProductForm id={p.id} categories={categories} initial={{
      name: p.name, slug: p.slug, description: p.description, price: centsToInput(p.priceCents), compareAt: centsToInput(p.compareAtCents),
      categoryId: p.categoryId ?? '', stock: String(p.stock), sku: p.sku ?? '', weightGrams: p.weightGrams ? String(p.weightGrams) : '',
      tags: p.tags.join(', '), isActive: p.isActive, isFeatured: p.isFeatured, images: p.images,
    }} />
  );
}
