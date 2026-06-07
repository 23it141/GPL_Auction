import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

const ReportsPage: React.FC = () => {
  const { addToast } = useSocket();
  const [activeReport, setActiveReport] = useState<'sold' | 'unsold' | 'squads' | 'spending'>('sold');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/${activeReport}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
      addToast('error', 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  // Excel Export Handler
  const handleExportExcel = () => {
    if (data.length === 0) {
      addToast('warning', 'No data available to export');
      return;
    }

    let sheetData: any[] = [];
    let fileName = `GPL_Auction_${activeReport}_Report`;

    if (activeReport === 'sold') {
      sheetData = data.map((p, idx) => ({
        'S.No': idx + 1,
        'Player Name': p.playerName,
        'Age': p.age,
        'Role': p.role,
        'Category': p.category,
        'Base Price (pts)': p.basePrice,
        'Sold Price (pts)': p.soldPrice,
        'Sold To (Team)': p.soldTo?.teamName || 'N/A',
        'Sold To (Code)': p.soldTo?.teamCode || 'N/A',
      }));
    } else if (activeReport === 'unsold') {
      sheetData = data.map((p, idx) => ({
        'S.No': idx + 1,
        'Player Name': p.playerName,
        'Age': p.age,
        'Role': p.role,
        'Category': p.category,
        'Base Price (pts)': p.basePrice,
      }));
    } else if (activeReport === 'spending') {
      sheetData = data.map((t, idx) => ({
        'S.No': idx + 1,
        'Team Name': t.teamName,
        'Team Code': t.teamCode,
        'Initial Purse (pts)': t.initialPurse,
        'Remaining Purse (pts)': t.remainingPurse,
        'Spent Amount (pts)': t.spentAmount,
        'Squad Size': t.squadSize,
        'Spending (%)': t.spendingPercentage.toFixed(2),
      }));
    } else if (activeReport === 'squads') {
      // Flatten squads for a clean tabular layout in Excel
      data.forEach((team) => {
        team.players.forEach((p: any, idx: number) => {
          sheetData.push({
            'Team': team.teamName,
            'Team Code': team.teamCode,
            'S.No': idx + 1,
            'Player Name': p.playerName,
            'Role': p.role,
            'Age': p.age,
            'Base Price (pts)': p.basePrice,
            'Sold Price (pts)': p.soldPrice,
          });
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    addToast('success', 'Excel report downloaded!');
  };

  // PDF Export Handler using jsPDF
  const handleExportPdf = () => {
    if (data.length === 0) {
      addToast('warning', 'No data available to export');
      return;
    }

    const doc = new jsPDF();
    const title = `GPL Mega Auction - ${activeReport.toUpperCase()} REPORT`;
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    doc.line(14, 28, 196, 28);

    let yPosition = 36;

    if (activeReport === 'sold') {
      doc.setFont('Helvetica', 'bold');
      doc.text(['S.No', 'Player Name', 'Role', 'Category', 'Sold Price', 'Team'], 14, yPosition);
      doc.setFont('Helvetica', 'normal');
      doc.line(14, yPosition + 2, 196, yPosition + 2);
      
      yPosition += 8;
      data.forEach((p, idx) => {
        if (yPosition > 280) { doc.addPage(); yPosition = 20; }
        doc.text([
          `${idx + 1}`,
          `${p.playerName}`,
          `${p.role}`,
          `${p.category}`,
          `${formatPrice(p.soldPrice)}`,
          `${p.soldTo?.teamCode}`
        ], 14, yPosition);
        yPosition += 8;
      });
    } else if (activeReport === 'unsold') {
      doc.setFont('Helvetica', 'bold');
      doc.text(['S.No', 'Player Name', 'Role', 'Category', 'Base Price'], 14, yPosition);
      doc.setFont('Helvetica', 'normal');
      doc.line(14, yPosition + 2, 196, yPosition + 2);
      
      yPosition += 8;
      data.forEach((p, idx) => {
        if (yPosition > 280) { doc.addPage(); yPosition = 20; }
        doc.text([
          `${idx + 1}`,
          `${p.playerName}`,
          `${p.role}`,
          `${p.category}`,
          `${formatPrice(p.basePrice)}`
        ], 14, yPosition);
        yPosition += 8;
      });
    } else if (activeReport === 'spending') {
      doc.setFont('Helvetica', 'bold');
      doc.text(['Team Code', 'Team Name', 'Initial Purse', 'Remaining Purse', 'Spent Amount'], 14, yPosition);
      doc.setFont('Helvetica', 'normal');
      doc.line(14, yPosition + 2, 196, yPosition + 2);
      
      yPosition += 8;
      data.forEach((t) => {
        if (yPosition > 280) { doc.addPage(); yPosition = 20; }
        doc.text([
          `${t.teamCode}`,
          `${t.teamName.slice(0, 15)}`,
          `${formatPrice(t.initialPurse)}`,
          `${formatPrice(t.remainingPurse)}`,
          `${formatPrice(t.spentAmount)}`
        ], 14, yPosition);
        yPosition += 8;
      });
    } else if (activeReport === 'squads') {
      data.forEach((team) => {
        if (yPosition > 250) { doc.addPage(); yPosition = 20; }
        doc.setFont('Helvetica', 'bold');
        doc.text(`${team.teamName} (${team.teamCode}) - Squad Size: ${team.squadSize}`, 14, yPosition);
        doc.setFont('Helvetica', 'normal');
        yPosition += 6;
        
        team.players.forEach((p: any, idx: number) => {
          if (yPosition > 280) { doc.addPage(); yPosition = 20; doc.setFont('Helvetica', 'normal'); }
          doc.text(`  ${idx + 1}. ${p.playerName} (${p.role}) - Sold: ${formatPrice(p.soldPrice)}`, 14, yPosition);
          yPosition += 6;
        });
        yPosition += 6;
      });
    }

    doc.save(`GPL_Auction_${activeReport}_Report.pdf`);
    addToast('success', 'PDF report downloaded!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans">
            Auction Reports
          </h1>
          <p className="text-slate-500 text-xs font-semibold">
            Generate audited statements, review squads, and export data worksheets.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-premium transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Export
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-premium transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            PDF Export
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex border-b border-slate-200 gap-1.5 overflow-x-auto shrink-0 pb-1">
        {[
          { id: 'sold', label: 'Sold Players' },
          { id: 'unsold', label: 'Unsold Players' },
          { id: 'spending', label: 'Purse Spending' },
          { id: 'squads', label: 'Team Squads' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeReport === tab.id
                ? 'border-brand-blue text-brand-blue bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Data Render Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-premium overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 font-semibold gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-brand-blue" />
            <span className="text-xs">Generating report data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-medium text-sm">
            No report entries recorded in this category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeReport === 'sold' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Base Price</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Sold Price</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Purchased By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">{p.playerName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{p.role}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-semibold">{p.category}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{formatPrice(p.basePrice)}</td>
                      <td className="px-6 py-4 text-sm text-brand-green font-extrabold">{formatPrice(p.soldPrice)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {p.soldTo?.teamName} ({p.soldTo?.teamCode})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'unsold' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Base Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">{p.playerName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{p.role}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-semibold">{p.category}</td>
                      <td className="px-6 py-4 text-sm text-rose-500 font-extrabold">{formatPrice(p.basePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'spending' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Initial Purse</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Purse</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Purse Spent</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Spent (%)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Squad Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((t) => (
                    <tr key={t.teamId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">{t.teamName}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">{t.teamCode}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{formatPrice(t.initialPurse)}</td>
                      <td className="px-6 py-4 text-sm text-brand-blue font-bold">{formatPrice(t.remainingPurse)}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-bold">{formatPrice(t.spentAmount)}</td>
                      <td className="px-6 py-4 text-sm text-brand-orange font-extrabold">{t.spendingPercentage.toFixed(1)}%</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-semibold">{t.squadSize}/18</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'squads' && (
              <div className="p-6 space-y-6 divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                {data.map((team) => (
                  <div key={team.teamId} className="pt-4 first:pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-extrabold text-slate-800">{team.teamName} ({team.teamCode})</h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Captain: {team.captainName} &bull; Spent: {formatPrice(team.initialPurse || 100000000 - team.remainingPurse)}</p>
                      </div>
                      <span className="text-xs font-bold bg-blue-50 text-brand-blue px-2.5 py-1 rounded-xl">
                        Purse Remaining: {formatPrice(team.remainingPurse)}
                      </span>
                    </div>

                    {team.players.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium pl-2 italic">No players purchased yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {team.players.map((p: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{p.playerName}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{p.role}</p>
                            </div>
                            <span className="text-xs font-black text-brand-green">{formatPrice(p.soldPrice)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
