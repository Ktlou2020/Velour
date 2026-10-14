import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import ProductForm from '../ProductForm';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  if (!(await requireAdmin())) redirect('/members');
  const categories = await db.productCategory.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
  return (
    <ProductForm categories={categories} initial={{
      name: '', slug: '', description: '', price: '', compareAt: '', categoryId: '', stock: '0', sku: '', weightGrams: '', tags: '', isActive: true, isFeatured: false, images: [],
    }} />
  );
}
