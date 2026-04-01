import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Tag,
  FileSpreadsheet,
} from "lucide-react";
import api from "../../configs/api";
import {
  Btn,
  Modal,
  InputField,
  SelectField,
  LoadingSpinner,
} from "../../components/ui";
import Breadcrumb from "../../components/Breadcrumb";
import { formatCurrency } from "../../lib/utils";
import { downloadExcel } from "../../lib/export";
import CategorySuggestion from "../../components/CategorySuggestion";

function ProductForm({ initial, categories, locations, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    sku: initial?.sku || "",
    category_id: initial?.category_id || "",
    unit_of_measure: initial?.unit_of_measure || "unit",
    cost_price: initial?.cost_price || "",
    reorder_point: initial?.reorder_point || "",
    initial_stock: "",
    location_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!initial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField
          label="Product Name *"
          placeholder="e.g. Office Desk"
          value={form.name}
          onChange={f("name")}
          required
          className="sm:col-span-2"
        />
        <InputField
          label="SKU / Code *"
          placeholder="e.g. DESK001"
          value={form.sku}
          onChange={f("sku")}
          required
          disabled={isEdit}
        />
        <SelectField
          label="Category"
          value={form.category_id}
          onChange={f("category_id")}
        >
          <option value="">No Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Unit of Measure"
          value={form.unit_of_measure}
          onChange={f("unit_of_measure")}
        >
          <option value="unit">Unit</option>
          <option value="kg">Kilogram (kg)</option>
          <option value="g">Gram (g)</option>
          <option value="L">Litre (L)</option>
          <option value="m">Metre (m)</option>
          <option value="box">Box</option>
          <option value="pcs">Pieces</option>
          <option value="dozen">Dozen</option>
        </SelectField>
        <InputField
          label="Cost Price (₹)"
          type="number"
          placeholder="0.00"
          value={form.cost_price}
          onChange={f("cost_price")}
          min="0"
          step="0.01"
        />
        <InputField
          label="Reorder Point"
          type="number"
          placeholder="Alert when stock ≤ this"
          value={form.reorder_point}
          onChange={f("reorder_point")}
          min="0"
        />
        {!isEdit && (
          <>
            <InputField
              label="Initial Stock (optional)"
              type="number"
              placeholder="Starting quantity"
              value={form.initial_stock}
              onChange={f("initial_stock")}
              min="0"
            />
            <SelectField
              label="Initial Location"
              value={form.location_id}
              onChange={f("location_id")}
            >
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          </>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  );
}

function CategoryModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/api/products/categories", { name });
      onCreated(res.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <InputField
        label="Category Name"
        placeholder="e.g. Furniture"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <CategorySuggestion
        name={formData.name}
        sku={formData.sku}
        currentCategory={formData.category}
        onSelect={(cat) => setFormData((f) => ({ ...f, category: cat }))}
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const tableRef = useRef(null);

  const fetchAll = async (q = "") => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.search = q;
      if (filterCat) params.category_id = filterCat;
      if (filterLocation) params.location_id = filterLocation;
      else if (filterWarehouse) params.warehouse_id = filterWarehouse;
      const [pRes, cRes, lRes, whRes, allLocRes] = await Promise.all([
        api.get("/api/products/", { params }),
        api.get("/api/products/categories"),
        api.get("/api/locations/"),
        api.get("/api/warehouses/"),
        api.get("/api/locations/"),
      ]);
      setProducts(pRes.data);
      setCategories(cRes.data);
      setLocations(lRes.data);
      setWarehouses(whRes.data);
      setAllLocations(allLocRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(search);
  }, [search, filterCat, filterLocation, filterWarehouse]);

  useEffect(() => {
    if (!loading && tableRef.current) {
      gsap.fromTo(
        tableRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
      );
    }
  }, [loading]);

  const handleCreate = async (data) => {
    await api.post("/api/products/", {
      ...data,
      cost_price: parseFloat(data.cost_price) || 0,
      reorder_point: parseFloat(data.reorder_point) || 0,
      initial_stock: parseFloat(data.initial_stock) || 0,
      location_id: data.location_id ? parseInt(data.location_id) : null,
      category_id: data.category_id ? parseInt(data.category_id) : null,
    });
    setModalOpen(false);
    fetchAll(search);
  };

  const handleUpdate = async (data) => {
    await api.put(`/api/products/${editing.id}`, {
      ...data,
      cost_price: parseFloat(data.cost_price) || 0,
      reorder_point: parseFloat(data.reorder_point) || 0,
      category_id: data.category_id ? parseInt(data.category_id) : null,
    });
    setEditing(null);
    fetchAll(search);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    await api.delete(`/api/products/${id}`);
    fetchAll(search);
  };

  const handleExport = () => {
    const headers = [
      "Name",
      "SKU",
      "Category",
      "Unit",
      "Cost Price",
      "On Hand",
      "Free to Use",
      "Status",
    ];
    const rows = products.map((p) => [
      p.name,
      p.sku,
      p.category_name || "",
      p.unit_of_measure,
      p.cost_price,
      p.on_hand,
      p.free_to_use,
      p.on_hand === 0
        ? "Out of Stock"
        : p.on_hand <= p.reorder_point && p.reorder_point > 0
          ? "Low Stock"
          : "In Stock",
    ]);
    downloadExcel("products_report", headers, rows, "Products");
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header - matching Dashboard style */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white mb-1">
            Products
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Manage your product catalog and inventory
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setCatModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <Tag size={16} /> New Category
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <FileSpreadsheet size={16} /> Export
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition"
          >
            <Plus size={16} /> New Product
          </button>
        </div>
      </div>

      {/* Filters - matching ProjectDetail tabs style */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterWarehouse}
          onChange={(e) => {
            setFilterWarehouse(e.target.value);
            setFilterLocation("");
          }}
          className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Locations</option>
          {(filterWarehouse
            ? allLocations.filter(
                (l) => l.warehouse_id === parseInt(filterWarehouse),
              )
            : allLocations
          ).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.warehouse_code})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div ref={tableRef}>
          {/* Stats row - matching ProjectDetail info cards */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between p-4 py-2.5 rounded">
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Total Products
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {products.length}
                </div>
              </div>
              <Package className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between p-4 py-2.5 rounded">
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Categories
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {categories.length}
                </div>
              </div>
              <Tag className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Package size={28} className="text-zinc-400" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                No products found
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
                Create your first product to start managing inventory.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-5 flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition"
              >
                <Plus size={15} /> Create Product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Product
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      SKU
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      UOM
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Cost Price
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      On Hand
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Free to Use
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Stock Status
                    </th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const isOut = p.on_hand === 0;
                    const isLow =
                      !isOut &&
                      p.on_hand <= p.reorder_point &&
                      p.reorder_point > 0;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors cursor-pointer
                          ${
                            isOut
                              ? "bg-red-50/50 dark:bg-red-500/5 hover:bg-red-100/50 dark:hover:bg-red-500/10"
                              : isLow
                                ? "bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-100/50 dark:hover:bg-amber-500/10"
                                : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          }`}
                        onClick={() => navigate(`/products/${p.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                              <Package size={16} className="text-zinc-400" />
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {p.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs font-medium px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                            {p.sku}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">
                          {p.category_name || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs capitalize">
                          {p.unit_of_measure}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-zinc-700 dark:text-zinc-300">
                          {formatCurrency(p.cost_price)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                          {p.on_hand}
                        </td>
                        <td className="px-5 py-3.5 text-right text-zinc-500 dark:text-zinc-400">
                          {p.free_to_use}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {isOut ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td
                          className="px-5 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setEditing(p)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Product"
      >
        <ProductForm
          categories={categories}
          locations={locations}
          onSave={handleCreate}
          onClose={() => setModalOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Product"
      >
        {editing && (
          <ProductForm
            initial={editing}
            categories={categories}
            locations={locations}
            onSave={handleUpdate}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="New Category"
      >
        <CategoryModal
          onClose={() => setCatModalOpen(false)}
          onCreated={(cat) => {
            setCategories((c) => [...c, cat]);
            setCatModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
