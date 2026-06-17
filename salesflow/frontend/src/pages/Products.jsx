import React, { useState, useEffect } from 'react';
import { PackageOpen, Plus, Search, ChevronDown, ChevronUp, Trash2, Edit2, Sparkles, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import Header from '../components/Header';
import { formatIndianCurrency, getPlatformBadge } from './Dashboard';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [expandedProductDetails, setExpandedProductDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [labelsPerUnit, setLabelsPerUnit] = useState('1');
  const [basePrice, setBasePrice] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpandProduct = async (id) => {
    if (expandedProductId === id) {
      setExpandedProductId(null);
      setExpandedProductDetails(null);
      return;
    }

    setExpandedProductId(id);
    setLoadingDetails(true);
    try {
      const response = await api.get(`/products/${id}`);
      setExpandedProductDetails(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!name || !category || !basePrice) {
      alert('Please fill out all required fields');
      return;
    }

    try {
      // Multiply basePrice (rupees) by 100 to save in paisa
      const basePricePaisa = Math.round(parseFloat(basePrice) * 100);
      await api.post('/products', {
        name,
        category,
        labels_per_unit: parseInt(labelsPerUnit),
        base_price: basePricePaisa
      });
      setIsAddModalOpen(false);
      setName('');
      setCategory('');
      setLabelsPerUnit('1');
      setBasePrice('');
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create product');
    }
  };

  const handleEditProductSubmit = async (e) => {
    e.preventDefault();
    if (!name || !category || !basePrice) {
      alert('Please fill out all required fields');
      return;
    }

    try {
      const basePricePaisa = Math.round(parseFloat(basePrice) * 100);
      await api.put(`/products/${activeProduct.id}`, {
        name,
        category,
        labels_per_unit: parseInt(labelsPerUnit),
        base_price: basePricePaisa
      });
      setIsEditModalOpen(false);
      setName('');
      setCategory('');
      setLabelsPerUnit('1');
      setBasePrice('');
      setActiveProduct(null);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product? All its SKU mappings and custom pricing will be lost!')) return;

    try {
      await api.delete(`/products/${id}`);
      if (expandedProductId === id) {
        setExpandedProductId(null);
        setExpandedProductDetails(null);
      }
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const openEditModal = (p) => {
    setActiveProduct(p);
    setName(p.name);
    setCategory(p.category);
    setLabelsPerUnit(p.labels_per_unit.toString());
    setBasePrice((p.base_price / 100).toString());
    setIsEditModalOpen(true);
  };

  // Filtering
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="Products & SKU Catalog" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Search and Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md bg-white border border-slate-200 rounded-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by model name or category..."
              className="w-full pl-10 pr-4 py-2 border-0 bg-transparent text-sm focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition-all"
          >
            <Plus size={16} />
            Add New Product
          </button>
        </div>

        {/* Products Table list */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <th className="py-3.5 px-6">Product Model</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Labels/Unit</th>
                <th className="py-3.5 px-4 text-right">Base Price (₹)</th>
                <th className="py-3.5 px-4 text-center">SKUs Mapped</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <React.Fragment key={p.id}>
                  
                  {/* Standard row */}
                  <tr 
                    onClick={() => handleExpandProduct(p.id)}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-all ${
                      expandedProductId === p.id ? 'bg-blue-50/10' : ''
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {expandedProductId === p.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-600">{p.category}</td>
                    <td className="py-4 px-4 text-center font-bold text-slate-700">{p.labels_per_unit}</td>
                    <td className="py-4 px-4 text-right font-bold text-emerald-600">{formatIndianCurrency(p.base_price)}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {p._count?.sku_mappings || 0} SKUs
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-slate-500 hover:text-slate-800 rounded transition-all"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 hover:bg-red-50 border border-transparent hover:border-red-100 text-red-400 hover:text-red-600 rounded transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>

                  {/* Expand row */}
                  {expandedProductId === p.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50/50 p-6 border-b border-slate-200">
                        {loadingDetails ? (
                          <div className="py-6 text-center text-xs text-slate-400 font-semibold animate-pulse">
                            Loading Product Analytics...
                          </div>
                        ) : expandedProductDetails ? (
                          <div className="space-y-6">
                            
                            {/* Stat Highlights Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Today's Qty Sold</span>
                                <h4 className="text-lg font-extrabold text-slate-800">{expandedProductDetails.stats.today.quantity} pcs</h4>
                              </div>
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">This Month's Qty</span>
                                <h4 className="text-lg font-extrabold text-slate-800">{expandedProductDetails.stats.month.quantity} pcs</h4>
                              </div>
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">This Month's Revenue</span>
                                <h4 className="text-lg font-extrabold text-emerald-600">{formatIndianCurrency(expandedProductDetails.stats.month.revenue)}</h4>
                              </div>
                            </div>

                            {/* Charts & Mapped SKUs Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              
                              {/* SKU Mapping list */}
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight mb-3">Marketplace SKU Mappings</h4>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {expandedProductDetails.product.sku_mappings.length > 0 ? (
                                    expandedProductDetails.product.sku_mappings.map(mapping => (
                                        <div key={mapping.id} className="flex items-center justify-between p-2 border border-slate-100 rounded text-xs">
                                          <span className="sku-badge">{mapping.marketplace_sku}</span>
                                          <div className="flex items-center gap-2">
                                            {getPlatformBadge(mapping.platform)}
                                          </div>
                                        </div>
                                    ))
                                  ) : (
                                    <div className="text-slate-400 text-xs py-4 text-center">No SKUs mapped yet</div>
                                  )}
                                </div>
                              </div>

                              {/* Account-wise breakdown */}
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight mb-3">Account Sales Distribution</h4>
                                <div className="h-44 w-full">
                                  {expandedProductDetails.stats.accounts.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={expandedProductDetails.stats.accounts}>
                                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                                        <YAxis tick={{ fontSize: 9 }} />
                                        <Tooltip />
                                        <Bar dataKey="quantity" fill="#16a34a" radius={[2, 2, 0, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">No account sales history</div>
                                  )}
                                </div>
                              </div>

                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-red-400">Failed to load analytics details</div>
                        )}
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="text-md font-bold text-slate-800">Add New Product</h3>
              <p className="text-xs text-slate-400 font-medium">Create a new product template to connect marketplace SKUs</p>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Product Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Men WB Boxer PC-3"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Innerwear, Apparel"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Labels / Unit</label>
                  <input
                    type="number"
                    min="1"
                    value={labelsPerUnit}
                    onChange={(e) => setLabelsPerUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Base Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 165"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="text-md font-bold text-slate-800">Edit Product Model</h3>
              <p className="text-xs text-slate-400 font-medium">Update the model template info</p>
            </div>

            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Product Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Labels / Unit</label>
                  <input
                    type="number"
                    min="1"
                    value={labelsPerUnit}
                    onChange={(e) => setLabelsPerUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Base Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setActiveProduct(null);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
