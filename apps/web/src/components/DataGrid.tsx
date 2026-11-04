import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type RowClickedEvent,
} from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

const bhavaiGridTheme = themeQuartz.withParams({
  fontFamily: 'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: 13,
  foregroundColor: '#173b3b',
  backgroundColor: '#ffffff',
  headerBackgroundColor: '#f6f8f3',
  headerTextColor: '#173c3d',
  headerFontWeight: 650,
  borderColor: 'rgba(23, 60, 61, 0.12)',
  rowHoverColor: '#e7f1e9',
  selectedRowBackgroundColor: '#dbe8d8',
  accentColor: '#00696e',
  checkboxCheckedBackgroundColor: '#00696e',
  inputFocusBorder: { color: '#00696e' },
  wrapperBorderRadius: 14,
});

export function DataGrid<T extends object>({
  rows,
  columns,
  height = 430,
  emptyText = 'No rows yet. Real records will appear here as they happen.',
  onRowClicked,
  loading = false,
}: {
  rows: T[];
  columns: ColDef<T>[];
  height?: number;
  emptyText?: string;
  onRowClicked?: (row: T) => void;
  loading?: boolean;
}) {
  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      flex: 1,
      minWidth: 96,
      suppressHeaderMenuButton: false,
    }),
    [],
  );

  const handleRowClicked = (event: RowClickedEvent<T>) => {
    if (event.data && onRowClicked) onRowClicked(event.data);
  };

  return (
    <div
      className="ag-theme-bhavai w-full overflow-hidden rounded-2xl border border-forest/10 bg-white"
      style={{ height }}
    >
      <AgGridReact<T>
        theme={bhavaiGridTheme}
        rowData={loading ? [] : rows}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        loading={loading}
        rowHeight={44}
        headerHeight={42}
        animateRows
        pagination={rows.length > 15}
        paginationPageSize={15}
        paginationPageSizeSelector={[15, 30, 50]}
        overlayNoRowsTemplate={`<span style="color:rgba(23,59,59,0.6);font-size:13px">${emptyText}</span>`}
        onRowClicked={handleRowClicked}
        rowStyle={onRowClicked ? { cursor: 'pointer' } : undefined}
        suppressCellFocus
      />
    </div>
  );
}
