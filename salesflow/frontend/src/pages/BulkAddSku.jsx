import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';

export default function BulkAddSku() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/sku-mappings/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult({ success: true, data: response.data });
    } catch (err) {
      console.error(err);
      setUploadResult({ 
        success: false, 
        error: err.response?.data?.error || 'Failed to upload Excel file' 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-10">
      <Header title="Bulk Add SKU" />
      
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Upload Master SKU Excel</h2>
          <p className="text-sm text-slate-500 mb-6">
            Upload an Excel file (.xlsx) containing your master SKU list. The system will automatically detect SKUs, Product Names, Quantity, Color, Size, and Platform to sync mappings instantly.
          </p>

          {!uploadResult?.success ? (
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-all ${
                  file ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                />
                
                {file ? (
                  <>
                    <FileSpreadsheet size={48} className="text-blue-500 mb-4" />
                    <p className="text-sm font-semibold text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                      className="mt-4 text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                    >
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <UploadCloud size={48} className="text-slate-400 mb-4" />
                    <p className="text-sm font-semibold text-slate-700 mb-1">Click or drag Excel file here</p>
                    <p className="text-xs text-slate-500">Supports .xlsx and .xls formats</p>
                  </>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded font-semibold text-white transition-all shadow-sm ${
                    !file || loading 
                      ? 'bg-slate-300 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Process & Map SKUs
                    </>
                  )}
                </button>
              </div>

              {uploadResult?.success === false && (
                <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block mb-1">Import Failed</span>
                    {uploadResult.error}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-lg flex flex-col sm:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-full shadow-sm">
                  <CheckCircle size={32} className="text-emerald-500" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-emerald-800 mb-1">Import Successful!</h3>
                  <p className="text-sm text-emerald-600 font-medium">Your master SKU list has been synced with the database.</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center px-4 py-2 bg-white rounded border border-emerald-100 shadow-sm">
                    <p className="text-2xl font-bold text-emerald-600">{uploadResult.data.parsedCount}</p>
                    <p className="text-xs font-semibold text-emerald-800 uppercase">Mapped</p>
                  </div>
                  <div className="text-center px-4 py-2 bg-white rounded border border-slate-200 shadow-sm">
                    <p className="text-2xl font-bold text-slate-600">{uploadResult.data.skippedCount}</p>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Skipped</p>
                  </div>
                  <div className={`text-center px-4 py-2 bg-white rounded border shadow-sm ${uploadResult.data.errors.length > 0 ? 'border-red-200' : 'border-slate-200'}`}>
                    <p className={`text-2xl font-bold ${uploadResult.data.errors.length > 0 ? 'text-red-500' : 'text-slate-600'}`}>{uploadResult.data.errors.length}</p>
                    <p className={`text-xs font-semibold uppercase ${uploadResult.data.errors.length > 0 ? 'text-red-700' : 'text-slate-500'}`}>Errors</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="text-md font-bold text-slate-800">Successfully Mapped SKUs</h3>
                <button 
                  onClick={resetUpload}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Upload another file
                </button>
              </div>

              <div className="border border-slate-200 rounded bg-white overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                      <th className="py-3 px-4">Marketplace SKU</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4 text-center">Qty</th>
                      <th className="py-3 px-4 text-center">Color</th>
                      <th className="py-3 px-4 text-center">Size</th>
                      <th className="py-3 px-4 text-center">Platform</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.data.mappings.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-medium text-blue-600">{m.marketplace_sku}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{m.product_name}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{m.quantity}</td>
                        <td className="py-3 px-4 text-center text-slate-600">{m.color_variant || '-'}</td>
                        <td className="py-3 px-4 text-center text-slate-600">{m.size_variant || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                            {m.platform}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {uploadResult.data.mappings.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          No SKUs were successfully mapped from this file.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {uploadResult.data.errors && uploadResult.data.errors.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-md font-bold text-red-700 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    Row Errors ({uploadResult.data.errors.length})
                  </h3>
                  <div className="border border-red-200 rounded bg-red-50 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-red-100/50 border-b border-red-200 text-red-700 font-semibold uppercase text-xs">
                        <tr>
                          <th className="py-2 px-4">Row #</th>
                          <th className="py-2 px-4">SKU</th>
                          <th className="py-2 px-4">Error Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.data.errors.map((err, idx) => (
                          <tr key={idx} className="border-b border-red-100">
                            <td className="py-2 px-4 font-medium text-red-800">{err.row}</td>
                            <td className="py-2 px-4 font-mono text-red-800">{err.sku}</td>
                            <td className="py-2 px-4 text-red-600">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
