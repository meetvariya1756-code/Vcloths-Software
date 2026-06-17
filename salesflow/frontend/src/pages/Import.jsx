import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, AlertCircle, Play, Sparkles, Trash2 } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';
import { formatIndianCurrency, getPlatformBadge } from './Dashboard';

export default function Import() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [importStatusList, setImportStatusList] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [activeImportId, setActiveImportId] = useState(null);

  // Mapping Modal State
  const [mappingModalSku, setMappingModalSku] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sizeVariant, setSizeVariant] = useState('');
  const [mappingError, setMappingError] = useState('');

  useEffect(() => {
    fetchAccounts();
    fetchProducts();
    fetchImportHistory();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.filter(a => a.is_active));
      if (response.data.length > 0) {
        setSelectedAccount(response.data[0].id.toString());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProductsList(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const response = await api.get('/imports');
      // Set history
      const formatted = response.data.map(h => ({
        id: h.id,
        filename: h.filename,
        accountName: h.account.name,
        platform: h.account.platform,
        records: h.records_extracted,
        status: h.status.toUpperCase(),
        date: new Date(h.import_date).toLocaleDateString('en-IN')
      }));
      setImportStatusList(formatted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!selectedAccount) {
      alert('Please select an account first!');
      return;
    }

    const file = files[0];
    
    // Add temporary uploading status to list
    const tempId = Date.now();
    const newStatusItem = {
      id: tempId,
      filename: file.name,
      accountName: accounts.find(a => a.id.toString() === selectedAccount)?.name || 'Account',
      platform: accounts.find(a => a.id.toString() === selectedAccount)?.platform || 'meesho',
      records: 0,
      status: 'PROCESSING',
      date: new Date().toLocaleDateString('en-IN')
    };
    
    setImportStatusList(prev => [newStatusItem, ...prev]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', selectedAccount);
    formData.append('override_date', selectedDate);

    try {
      const response = await api.post('/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Update list
      setImportStatusList(prev => 
        prev.map(item => item.id === tempId ? {
          ...item,
          id: response.data.importId,
          records: response.data.records.length,
          status: response.data.autoConfirmed ? 'DONE' : (response.data.hasUnmapped ? 'QUEUED' : 'PROCESSING')
        } : item)
      );

      // Load preview if there are unmapped SKUs, otherwise show immediate success!
      if (response.data.autoConfirmed) {
        setPreviewData(null);
        setActiveImportId(null);
        alert('🎉 Success! 100% of SKUs matched. The PDF was automatically processed, confirmed, and saved!');
        fetchImportHistory();
      } else {
        setPreviewData(response.data.records);
        setActiveImportId(response.data.importId);
      }

    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to upload PDF');
      setImportStatusList(prev => prev.filter(item => item.id !== tempId));
    }
  };

  // Create Mapping on the spot
  const handleCreateMappingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setMappingError('Please select a product');
      return;
    }

    const platform = accounts.find(a => a.id.toString() === selectedAccount)?.platform || 'meesho';

    try {
      await api.post('/sku-mappings', {
        marketplace_sku: mappingModalSku,
        product_id: selectedProductId,
        size_variant: sizeVariant,
        platform
      });

      // Recalculate preview records dynamically in-place
      const targetProduct = productsList.find(p => p.id.toString() === selectedProductId);
      const updatedPreview = previewData.map(r => {
        if (r.raw_sku === mappingModalSku) {
          const labels_total = 1; // 1 shipping label/page per transaction
          const revenue = r.quantity * targetProduct.base_price; // pieces sold multiplied by price per piece
          return {
            ...r,
            mapped_product_id: targetProduct.id,
            mapped_product_name: targetProduct.name,
            labels_per_unit: targetProduct.labels_per_unit,
            labels_total,
            price: targetProduct.base_price,
            revenue,
            mapped: true
          };
        }
        return r;
      });

      setPreviewData(updatedPreview);
      
      // Close modal
      setMappingModalSku(null);
      setSelectedProductId('');
      setSizeVariant('');
      setMappingError('');

      // Check if there are any remaining unmapped SKUs
      const remainingUnmapped = updatedPreview.some(r => !r.mapped);
      if (!remainingUnmapped) {
        setImportStatusList(prev => 
          prev.map(item => item.id === activeImportId ? { ...item, status: 'PROCESSING' } : item)
        );
      }

    } catch (err) {
      setMappingError(err.response?.data?.error || 'Failed to create SKU mapping');
    }
  };

  const handleConfirmImport = async () => {
    if (!activeImportId || !previewData) return;

    // Check if there are unmapped
    const hasUnmapped = previewData.some(r => !r.mapped);
    if (hasUnmapped) {
      alert('You must map all SKUs before confirming the import!');
      return;
    }

    try {
      await api.post(`/imports/${activeImportId}/confirm`, { records: previewData });
      
      // Update status list
      setImportStatusList(prev => 
        prev.map(item => item.id === activeImportId ? { ...item, status: 'DONE' } : item)
      );

      alert('Import saved to database successfully!');
      setPreviewData(null);
      setActiveImportId(null);
      fetchImportHistory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save import');
    }
  };

  const handleDeleteImport = async (id) => {
    if (!window.confirm('Are you sure you want to delete this PDF import and all its sales records?')) {
      return;
    }
    try {
      await api.delete(`/imports/${id}`);
      alert('Import deleted successfully!');
      if (activeImportId === id) {
        setPreviewData(null);
        setActiveImportId(null);
      }
      fetchImportHistory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete import');
    }
  };

  const hasUnmappedInPreview = previewData?.some(r => !r.mapped);

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="PDF Import" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Upload Zone & Status list Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Drag & Drop Upload Zone */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold text-slate-800 mb-1">Upload Daily Report PDF</h3>
              <p className="text-xs text-slate-400 font-medium mb-6">Select the platform account and upload files</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Account Name</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 bg-white"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.platform.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Select Report Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>

              <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/10 rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
                <UploadCloud size={32} className="text-slate-400" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Click to upload files</p>
                  <p className="text-xs text-slate-400">PDF reports only</p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Import Processing Queue List */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 lg:col-span-2 shadow-sm flex flex-col justify-between h-[340px]">
            <div>
              <h3 className="text-md font-bold text-slate-800 mb-1">Import Queue & Processing List</h3>
              <p className="text-xs text-slate-400 font-medium mb-4">Live status tracking for uploaded reports</p>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-100 rounded">
              {importStatusList.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Filename</th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3 text-center">Date</th>
                      <th className="py-2.5 px-3 text-center">Records</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importStatusList.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-800 truncate max-w-[200px]">{item.filename}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-600">{item.accountName}</span>
                            <div className="flex">{getPlatformBadge(item.platform)}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-500">{item.date}</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700">{item.records}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'DONE' ? 'bg-green-100 text-green-700 border border-green-200' :
                            item.status === 'QUEUED' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                            item.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700 border border-blue-200 animate-pulse' :
                            'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteImport(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-all inline-flex items-center"
                            title="Delete PDF Import"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Queue is empty. Select an account and upload a report to start.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Preview Table */}
        {previewData && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-md font-bold text-slate-800">Extracted Sales Preview</h3>
                <p className="text-xs text-slate-400 font-medium">Verify SKU matches and packaging label calculations before committing</p>
              </div>

              <div className="flex items-center gap-4">
                {hasUnmappedInPreview ? (
                  <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded text-xs font-semibold">
                    <AlertTriangle size={15} />
                    Unmapped SKUs found! Set mappings before confirming
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded text-xs font-semibold">
                    <CheckCircle size={15} />
                    All SKUs matched successfully
                  </div>
                )}

                <button
                  onClick={handleConfirmImport}
                  disabled={hasUnmappedInPreview}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-200 rounded text-xs font-bold transition-all"
                >
                  <Play size={14} />
                  Confirm & Import
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto border border-slate-100 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Raw SKU (from PDF)</th>
                    <th className="py-3 px-4 text-center">Size</th>

                    <th className="py-3 px-4">Mapped Product Name</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-center">Labels/Unit</th>
                    <th className="py-3 px-4 text-center">Total Labels</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                        !row.mapped ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-500 font-medium">
                        {new Date(row.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className={`sku-badge ${!row.mapped ? 'border-red-300 text-red-700 bg-red-50 font-bold' : ''}`}>
                          {row.raw_sku}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 rounded bg-slate-100 font-semibold text-slate-700 text-[11px] border border-slate-200">
                          {row.size || 'N/A'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {row.mapped ? (
                          <span className="font-semibold text-slate-800">{row.mapped_product_name}</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-600 font-bold">
                            <AlertCircle size={14} />
                            Unmapped SKU
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">{row.quantity}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">{row.labels_per_unit}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600">{row.labels_total}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {row.mapped ? formatIndianCurrency(row.price) : '₹0'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {row.mapped ? formatIndianCurrency(row.revenue) : '₹0'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!row.mapped && (
                          <button
                            onClick={() => setMappingModalSku(row.raw_sku)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-100 hover:bg-red-200 border border-red-200 text-red-700 rounded text-[10px] font-bold transition-all mx-auto"
                          >
                            <Sparkles size={11} />
                            Map Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>

      {/* Dynamic Inline SKU Mapping Modal */}
      {mappingModalSku && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="text-md font-bold text-slate-800">Map Marketplace SKU</h3>
              <p className="text-xs text-slate-400 font-medium">Link this SKU to a registered product model in the inventory</p>
            </div>

            {mappingError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3 font-semibold">
                {mappingError}
              </div>
            )}

            <form onSubmit={handleCreateMappingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Marketplace SKU</label>
                <input
                  type="text"
                  value={mappingModalSku}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Connect to Product Model</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                >
                  <option value="">-- Select Product --</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Base: {formatIndianCurrency(p.base_price)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Size Variant</label>
                <input
                  type="text"
                  value={sizeVariant}
                  onChange={(e) => setSizeVariant(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                  placeholder="e.g. L"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMappingModalSku(null);
                    setMappingError('');
                  }}
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
    </div>
  );
}
