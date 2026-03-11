import { ProductList } from "../components/product-list";
import { AdminLayout } from "../components/AdminLayout";

export default function ProductsPage() {
  return (
    <AdminLayout title="My Products" fullWidth titleHidden>
      <ProductList />
    </AdminLayout>
  );
}
