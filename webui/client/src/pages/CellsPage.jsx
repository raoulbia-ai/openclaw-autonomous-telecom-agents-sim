import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
} from '@tanstack/react-table';
import { get } from '../lib/api';
import { cellStatus, STATUS_BG, STATUS_LABEL } from '../lib/status';

const STATUS_ORDER = { 'cross-zone': 0, outlier: 1, elevated: 2, normal: 3 };

export default function CellsPage() {
  const [topology, setTopology]     = useState(null);
  const [performance, setPerf]      = useState(null);
  const [signals, setSignals]       = useState(null);
  const [alarms, setAlarms]         = useState(null);
  const [filter, setFilter]         = useState('all');
  const [sorting, setSorting]       = useState([{ id: 'status', desc: false }]);
  const [globalFilter, setGlobal]   = useState('');
  const [tick, setTick]             = useState(0);

  useEffect(() => {
    Promise.all([
      get('/api/topology').catch(() => null),
      get('/api/performance').catch(() => null),
      get('/api/signals').catch(() => null),
      get('/api/alarms').catch(() => null),
    ]).then(([t, p, s, a]) => {
      setTopology(t); setPerf(p); setSignals(s); setAlarms(a);
    });
  }, [tick]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const rows = useMemo(() => {
    if (!topology) return [];
    return topology.cells.map(cell => {
      const status = cellStatus(cell.id, performance, signals);
      const allPerf = [...(performance?.outliers ?? []), ...(performance?.elevated ?? []), ...(performance?.normal ?? [])];
      const perfEntry = allPerf.find(c => c.cellId === cell.id);
      const cellAlarms = alarms?.alarms?.filter(a => a.managedObjectInstance === cell.id) ?? [];
      return {
        shortId: `NRCellDU-${cell.id.split('NRCellDU=')[1]}`,
        fullId: cell.id,
        site: cell.site,
        status,
        statusOrder: STATUS_ORDER[status],
        dlThp: perfEntry?.counters?.dlThpCell ?? null,
        errorRate: perfEntry?.counters?.errorRate ?? null,
        availability: perfEntry?.counters?.cellAvailTime ?? null,
        alarmCount: cellAlarms.length,
      };
    });
  }, [topology, performance, signals, alarms]);

  const filtered = useMemo(() =>
    filter === 'all' ? rows : rows.filter(r => r.status === filter),
  [rows, filter]);

  const columns = useMemo(() => [
    {
      accessorKey: 'shortId',
      header: 'Cell',
      cell: info => <span className="font-mono text-slate-200 text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'site',
      header: 'Site',
      cell: info => <span className="text-slate-400 text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'statusOrder',
      header: 'Status',
      cell: info => {
        const status = info.row.original.status;
        return (
          <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BG[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        );
      },
    },
    {
      accessorKey: 'dlThp',
      header: 'DL Throughput',
      cell: info => {
        const v = info.getValue();
        const low = v != null && v < 25;
        return <span className={`text-sm ${low ? 'text-red-400' : 'text-slate-300'}`}>{v != null ? `${v} Mbps` : '—'}</span>;
      },
    },
    {
      accessorKey: 'errorRate',
      header: 'Error Rate',
      cell: info => {
        const v = info.getValue();
        const high = v != null && v > 2;
        return <span className={`text-sm ${high ? 'text-orange-400' : 'text-slate-300'}`}>{v != null ? `${v}%` : '—'}</span>;
      },
    },
    {
      accessorKey: 'availability',
      header: 'Availability',
      cell: info => {
        const v = info.getValue();
        const low = v != null && v < 95;
        return <span className={`text-sm ${low ? 'text-yellow-400' : 'text-slate-300'}`}>{v != null ? `${v}%` : '—'}</span>;
      },
    },
    {
      accessorKey: 'alarmCount',
      header: 'Alarms',
      cell: info => {
        const v = info.getValue();
        return <span className={`text-sm ${v > 0 ? 'text-red-400 font-medium' : 'text-slate-500'}`}>{v}</span>;
      },
    },
  ], []);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobal,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const FILTERS = ['all', 'cross-zone', 'outlier', 'elevated', 'normal'];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-100">Cells</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                filter === f
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <input
          value={globalFilter}
          onChange={e => setGlobal(e.target.value)}
          placeholder="Search…"
          className="ml-auto px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors w-48"
        />
      </div>

      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 border-b border-slate-700">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-200 transition-colors"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted()] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-slate-800 transition-colors hover:bg-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/30' : ''}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">No data yet — run a collection cycle.</div>
        )}
      </div>
    </div>
  );
}
