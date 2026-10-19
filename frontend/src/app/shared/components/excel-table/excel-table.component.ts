import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  ContentChild,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ExcelColumnDef,
  ColumnFilterCriteria,
  TableSortState,
  ActiveFilterChip,
} from './excel-table.models';
import { ExcelColumnPopoverComponent } from './excel-column-popover.component';

@Component({
  selector: 'app-excel-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ExcelColumnPopoverComponent],
  templateUrl: './excel-table.component.html',
  styleUrls: ['./excel-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExcelDataTableComponent<T extends Record<string, any> = any> {
  // Inputs
  public readonly data = input.required<T[]>();
  public readonly columns = input.required<ExcelColumnDef<T>[]>();
  public readonly enableGlobalSearch = input<boolean>(true);
  public readonly enableExportCsv = input<boolean>(true);
  public readonly emptyMessage = input<string>(
    'No se encontraron registros que coincidan con los filtros aplicados.'
  );

  // Template para celdas personalizadas
  @ContentChild('cellTemplate') public cellTemplate?: TemplateRef<any>;

  // Outputs
  public readonly exportCsv = output<T[]>();

  // Estados Reactivos con Signals
  public readonly globalSearch = signal<string>('');
  public readonly filterModel = signal<Map<string, ColumnFilterCriteria>>(new Map());
  public readonly sortState = signal<TableSortState>({ columnKey: '', direction: null });
  public readonly openPopoverKey = signal<string | null>(null);

  // Cinta de Chips de Filtros Activos (Breadcrumb Ribbon)
  public readonly activeFilterChips = computed<ActiveFilterChip[]>(() => {
    const filters = this.filterModel();
    const cols = this.columns();
    const chips: ActiveFilterChip[] = [];

    filters.forEach((criteria, key) => {
      const col = cols.find((c) => c.key === key);
      const header = col ? col.header : key;

      let summary = '';
      if (criteria.selectedValues !== undefined) {
        if (criteria.selectedValues.size === 0) {
          summary = '(Ninguno seleccionado)';
        } else if (criteria.selectedValues.size <= 2) {
          summary = Array.from(criteria.selectedValues).join(', ');
        } else {
          const valuesArr = Array.from(criteria.selectedValues);
          summary = `${valuesArr[0]}, ${valuesArr[1]} (+${valuesArr.length - 2})`;
        }
      } else if (criteria.numberOperator && criteria.numberValue !== undefined) {
        const opSymbols: Record<string, string> = {
          GTE: '≥',
          GT: '>',
          LTE: '≤',
          LT: '<',
          EQUALS: '=',
          BETWEEN: 'entre',
        };
        const sym = opSymbols[criteria.numberOperator] || criteria.numberOperator;
        summary = criteria.numberOperator === 'BETWEEN'
          ? `${sym} ${criteria.numberValue} y ${criteria.numberValueTo}`
          : `${sym} ${criteria.numberValue}`;
      } else if (criteria.stringOperator && criteria.stringValue) {
        summary = `"${criteria.stringValue}"`;
      }

      if (summary) {
        chips.push({
          columnKey: key,
          header,
          displaySummary: summary,
        });
      }
    });

    return chips;
  });

  // Valores únicos cacheados por columna para no recrear arrays en cada ciclo
  public readonly allColumnValues = computed<Record<string, any[]>>(() => {
    const list = this.data();
    const cols = this.columns();
    const map: Record<string, any[]> = {};

    for (const col of cols) {
      map[col.key] = list.map((row) => this.getCellValue(row, col));
    }

    return map;
  });

  // Datos filtrados y ordenados (60 FPS memoizado con computed)
  public readonly processedData = computed<T[]>(() => {
    let list = this.data();
    const search = this.globalSearch().trim().toLowerCase();
    const filters = this.filterModel();
    const sort = this.sortState();
    const cols = this.columns();

    // 1. Búsqueda Global
    if (search) {
      list = list.filter((row) => {
        return cols.some((col) => {
          const val = this.getCellValue(row, col);
          return val !== null && val !== undefined && String(val).toLowerCase().includes(search);
        });
      });
    }

    // 2. Filtros Estilo Excel por Columna
    if (filters.size > 0) {
      list = list.filter((row) => {
        for (const [key, criteria] of filters.entries()) {
          const col = cols.find((c) => c.key === key);
          if (!col) continue;

          const cellVal = this.getCellValue(row, col);

          // Filtro por Multi-select
          if (criteria.selectedValues !== undefined) {
            if (criteria.selectedValues.size === 0) {
              return false; // Si se deseleccionaron todos, no coincide ninguna fila
            }
            const normalized = cellVal === null || cellVal === undefined || cellVal === '' ? '(Vacío)' : cellVal;
            if (!criteria.selectedValues.has(normalized)) {
              return false;
            }
          }

          // Filtro Numérico
          if (criteria.numberOperator && criteria.numberValue !== undefined) {
            const num = Number(cellVal);
            if (isNaN(num)) return false;

            switch (criteria.numberOperator) {
              case 'GTE':
                if (num < criteria.numberValue) return false;
                break;
              case 'GT':
                if (num <= criteria.numberValue) return false;
                break;
              case 'LTE':
                if (num > criteria.numberValue) return false;
                break;
              case 'LT':
                if (num >= criteria.numberValue) return false;
                break;
              case 'EQUALS':
                if (num !== criteria.numberValue) return false;
                break;
              case 'BETWEEN':
                if (num < criteria.numberValue || (criteria.numberValueTo !== undefined && num > criteria.numberValueTo)) {
                  return false;
                }
                break;
            }
          }

          // Filtro de Texto
          if (criteria.stringOperator && criteria.stringValue) {
            const str = String(cellVal || '').toLowerCase();
            const target = criteria.stringValue.toLowerCase();

            switch (criteria.stringOperator) {
              case 'CONTAINS':
                if (!str.includes(target)) return false;
                break;
              case 'STARTS_WITH':
                if (!str.startsWith(target)) return false;
                break;
              case 'ENDS_WITH':
                if (!str.endsWith(target)) return false;
                break;
              case 'EQUALS':
                if (str !== target) return false;
                break;
              case 'NOT_CONTAINS':
                if (str.includes(target)) return false;
                break;
            }
          }
        }
        return true;
      });
    }

    // 3. Ordenamiento
    if (sort.columnKey && sort.direction) {
      const col = cols.find((c) => c.key === sort.columnKey);
      list = [...list].sort((a, b) => {
        const valA = col ? this.getCellValue(a, col) : a[sort.columnKey];
        const valB = col ? this.getCellValue(b, col) : b[sort.columnKey];

        let result = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          result = valA - valB;
        } else {
          result = String(valA ?? '').localeCompare(String(valB ?? ''));
        }

        return sort.direction === 'DESC' ? -result : result;
      });
    }

    return list;
  });

  public getCellValue(row: T, col: ExcelColumnDef<T>): any {
    if (col.valueGetter) {
      return col.valueGetter(row);
    }
    return row[col.key];
  }

  public getRawValuesForColumn(colKey: string): any[] {
    const col = this.columns().find((c) => c.key === colKey);
    if (!col) return [];
    return this.data().map((row) => this.getCellValue(row, col));
  }

  public togglePopover(colKey: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openPopoverKey() === colKey) {
      this.openPopoverKey.set(null);
    } else {
      this.openPopoverKey.set(colKey);
    }
  }

  public closePopover(): void {
    this.openPopoverKey.set(null);
  }

  public onApplyFilter(criteria: ColumnFilterCriteria): void {
    const nextMap = new Map(this.filterModel());
    nextMap.set(criteria.columnKey, criteria);
    this.filterModel.set(nextMap);
  }

  public onClearFilter(columnKey: string): void {
    const nextMap = new Map(this.filterModel());
    nextMap.delete(columnKey);
    this.filterModel.set(nextMap);
  }

  public clearAllFilters(): void {
    this.filterModel.set(new Map());
    this.globalSearch.set('');
    this.sortState.set({ columnKey: '', direction: null });
  }

  public onSortChange(sort: TableSortState): void {
    this.sortState.set(sort);
  }

  public isColumnFiltered(colKey: string): boolean {
    return this.filterModel().has(colKey);
  }

  public onDownloadCsv(): void {
    const items = this.processedData();
    if (items.length === 0) return;

    const cols = this.columns().filter((c) => c.key !== 'actions' && c.type !== 'custom');
    const headers = cols.map((c) => `"${c.header.replace(/"/g, '""')}"`);

    const rows = items.map((row) => {
      return cols.map((col) => {
        let val = this.getCellValue(row, col);
        if (col.valueFormatter) {
          val = col.valueFormatter(val, row);
        }
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_excel_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
