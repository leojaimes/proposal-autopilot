export type ColumnDataType = 'string' | 'number' | 'enum' | 'boolean' | 'date' | 'custom';

export type NumberOperator = 'EQUALS' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN';
export type StringOperator = 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'EQUALS' | 'NOT_CONTAINS';

export interface ColumnFilterCriteria {
  columnKey: string;
  selectedValues?: Set<any>; // Checkboxes seleccionados para multi-select
  stringOperator?: StringOperator;
  stringValue?: string;
  numberOperator?: NumberOperator;
  numberValue?: number;
  numberValueTo?: number; // Para operador BETWEEN
}

export interface DistinctValueOption {
  value: any;
  label: string;
  count: number;
  checked: boolean;
}

export interface ExcelColumnDef<T = any> {
  key: string;
  header: string;
  type: ColumnDataType;
  sortable?: boolean;
  filterable?: boolean;
  width?: string; // ej: '90px', '280px', 'min-w-[140px]'
  align?: 'left' | 'center' | 'right';
  valueGetter?: (row: T) => any;
  valueFormatter?: (value: any, row: T) => string;
}

export interface TableSortState {
  columnKey: string;
  direction: 'ASC' | 'DESC' | null;
}

export interface ActiveFilterChip {
  columnKey: string;
  header: string;
  displaySummary: string;
}
