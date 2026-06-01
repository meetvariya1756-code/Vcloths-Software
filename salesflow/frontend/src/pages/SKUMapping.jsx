import React, { useState, useEffect } from 'react';
import { Shuffle, Plus, Search, Trash2, FileSpreadsheet, Sparkles, HelpCircle } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';
import { formatIndianCurrency, getPlatformBadge } from './Dashboard';

export default function SKUMapping() {
  const [mappings, setMappings] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Form Fields
  const [marketplaceSku, setMarketplaceSku] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [colorVariant, setColorVariant] = useState('');
  const [sizeVariant, setSizeVariant] = useState('');
  const [platform, setPlatform] = useState('meesho');

  // Bulk Fields
  const [csvText, setCsvText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');

  useEffect(() => {
    fetchMappings();
    fetchProducts();
  }, []);

  const fetchMappings = async () => {
    try {
      const response = await api.get('/sku-mappings');
      setMappings(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMappingSubmit = async (e) => {
    e.preventDefault();
    if (!marketplaceSku || !selectedProductId || !platform) {
      alert('Please fill out all required fields');
      return;
    }

    try {
      await api.post('/sku-mappings', {
        marketplace_sku: marketplaceSku,
        product_id: parseInt(selectedProductId),
        color_variant: colorVariant,
        size_variant: sizeVariant,
        platform
      });
      setIsAddModalOpen(false);
      setMarketplaceSku('');
      setSelectedProductId('');
      setColorVariant('');
      setSizeVariant('');
      setPlatform('meesho');
      fetchMappings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create SKU mapping');
    }
  };

  const handleDeleteMapping = async (id) => {
    if (!confirm('Are you sure you want to delete this SKU mapping?')) return;

    try {
      await api.delete(`/sku-mappings/${id}`);
      fetchMappings();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete mapping');
    }
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      alert('CSV data cannot be empty');
      return;
    }

    setBulkStatus('Uploading and parsing mappings...');
    try {
      const response = await api.post('/sku-mappings/bulk', { csvText });
      setBulkStatus(`Successfully imported ${response.data.importedCount} mappings. Failed/Skipped: ${response.data.errorCount}`);
      setCsvText('');
      fetchMappings();
    } catch (err) {
      setBulkStatus('Failed to import CSV mappings: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredMappings = mappings.filter(m => 
    m.marketplace_sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.color_variant && m.color_variant.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="SKU Mapping Engine" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Search and Action Row */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md bg-white border border-slate-200 rounded-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Marketplace SKU, variants, or mapped product..."
              className="w-full pl-10 pr-4 py-2 border-0 bg-transparent text-sm focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded text-xs font-bold transition-all"
            >
              <FileSpreadsheet size={16} />
              Bulk Import CSV
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition-all"
            >
              <Plus size={16} />
              Add SKU Mapping
            </button>
          </div>
        </div>

        {/* SKU mappings table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {filteredMappings.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="py-3.5 px-6">Marketplace SKU</th>
                  <th className="py-3.5 px-4">Sales Platform</th>
                  <th className="py-3.5 px-4">Color Variant</th>
                  <th className="py-3.5 px-4">Size Variant</th>
                  <th className="py-3.5 px-4">Mapped Internal Product Model</th>
                  <th className="py-3.5 px-4 text-right">Base Price (₹)</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-medium">
                      <span className="sku-badge">{m.marketplace_sku}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getPlatformBadge(m.platform)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {m.color_variant || <span className="text-slate-300 font-normal">N/A</span>}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {m.size_variant || <span className="text-slate-300 font-normal">N/A</span>}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{m.product.name}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      {formatIndianCurrency(m.product.base_price)}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleDeleteMapping(m.id)}
                        className="p-1.5 hover:bg-red-50 border border-transparent hover:border-red-100 text-red-400 hover:text-red-600 rounded transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400">
              No active SKU mappings match your criteria. Add mappings to start processing PDF reports automatically.
            </div>
          )}
        </div>

      </div>

      {/* Add SKU Mapping Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="text-md font-bold text-slate-800">Add SKU Mapping</h3>
              <p className="text-xs text-slate-400 font-medium">Map a marketplace listing SKU directly to a product model template</p>
            </div>

            <form onSubmit={handleAddMappingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Marketplace SKU Code</label>
                <input
                  type="text"
                  value={marketplaceSku}
                  onChange={(e) => setMarketplaceSku(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="e.g. MEN-WB-BGY-PC-3"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sales Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                  required
                >
                  <option value="meesho">Meesho (Blue)</option>
                  <option value="flipkart">Flipkart (Orange)</option>
                  <option value="amazon">Amazon (Green)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Connect to Product Model</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                  required
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{(p.base_price / 100).toFixed(0)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Color Variant (Optional)</label>
                  <input
                    type="text"
                    value={colorVariant}
                    onChange={(e) => setColorVariant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    placeholder="e.g. BGY"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Size Variant (Optional)</label>
                  <input
                    type="text"
                    value={sizeVariant}
                    onChange={(e) => setSizeVariant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    placeholder="e.g. XL"
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
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="text-md font-bold text-slate-800">Bulk Import SKU Mappings via CSV</h3>
              <p className="text-xs text-slate-400 font-medium">Add dozens of mappings quickly by copying/pasting raw CSV text</p>
            </div>

            {bulkStatus && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded p-3 font-semibold">
                {bulkStatus}
              </div>
            )}

            <form onSubmit={handleBulkImportSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-[10px] text-slate-500 space-y-1">
                <p className="font-bold uppercase flex items-center gap-1"><HelpCircle size={12} /> Expected Format (including headers):</p>
                <p className="font-mono">marketplace_sku, product_name_or_id, color_variant, size_variant, platform</p>
                <p className="font-mono">MEN-WB-BGY-PC-3, Men WB Boxer PC-3, BGY, L, meesho</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">CSV Content</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full h-44 px-3 py-2 border border-slate-200 rounded text-xs font-mono focus:outline-none focus:border-blue-500"
                  placeholder="Paste CSV rows here..."
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkModalOpen(false);
                    setBulkStatus('');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded"
                >
                  Parse & Import CSV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
