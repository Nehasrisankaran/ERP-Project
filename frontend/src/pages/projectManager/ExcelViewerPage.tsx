import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { FileSpreadsheet, Search, AlertTriangle } from 'lucide-react';

export default function ExcelViewerPage() {
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: sheetsRes, isLoading: loadingSheets } = useQuery({
    queryKey: ['pmExcelSheets'],
    queryFn: () => projectManagerService.getExcelSheets().then((res) => res.data),
  });

  const sheets = sheetsRes?.sheets || [];

  React.useEffect(() => {
    if (sheets.length > 0 && !selectedSheet) {
      setSelectedSheet(sheets[0]);
    }
  }, [sheets, selectedSheet]);

  const { data: excelDataRes, isLoading: loadingData, error } = useQuery({
    queryKey: ['pmExcelData', selectedSheet],
    queryFn: () => {
      if (!selectedSheet) return Promise.resolve({ columns: [], rows: [] });
      return projectManagerService.getExcelData(selectedSheet).then((res) => res.data);
    },
    enabled: !!selectedSheet,
  });

  const columns = excelDataRes?.columns || [];
  const rows = excelDataRes?.rows || [];

  const filteredRows = rows.filter((r: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(r).some((val) => String(val).toLowerCase().includes(q));
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Excel / SharePoint Viewer</h1>
          <p className="text-sm text-slate-500">Live table representation of cached SharePoint workbook sheets</p>
        </div>
      </div>

      {/* Sheet selector & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-emerald-600" />
          <span className="text-xs font-bold text-slate-500 uppercase">Select Sheet:</span>
          {loadingSheets ? (
            <span className="text-xs text-slate-400">Loading sheets...</span>
          ) : (
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {sheets.map((s: string) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search sheet data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Table Data */}
      {loadingData ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load sheet data.</p>
          <p className="text-xs text-red-600">{(error as any)?.response?.data?.detail || (error as any)?.message}</p>
        </div>
      ) : columns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FileSpreadsheet size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No data available for this sheet</h3>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                <tr>
                  {columns.map((col: string, idx: number) => (
                    <th key={idx} className="py-3 px-4 border-r border-slate-200 whitespace-nowrap">
                      {col || `Col ${idx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {filteredRows.map((row: any, rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                    {columns.map((col: string, cIdx: number) => (
                      <td key={cIdx} className="py-2.5 px-4 border-r border-slate-100 whitespace-nowrap text-slate-800">
                        {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
