import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ExcelColumnDef,
  ColumnFilterCriteria,
  TableSortState,
  DistinctValueOption,
  NumberOperator,
  StringOperator,
} from './excel-table.models';

@Component({
  selector: 'app-excel-column-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './excel-column-popover.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExcelColumnPopoverComponent {
  public readonly column = input.required<ExcelColumnDef>();
  public readonly rawValues = input<any[]>([]);
  public readonly currentFilter = input<ColumnFilterCriteria | undefined>();
  public readonly currentSort = input<TableSortState | undefined>();
  public readonly isOpen = input<boolean>(false);

  public readonly applyFilter = output<ColumnFilterCriteria>();
  public readonly clearFilter = output<string>();
  public readonly changeSort = output<TableSortState>();
  public readonly close = output<void>();

  // Estado interno del Popover
  public readonly searchInValues = signal<string>('');
  public readonly selectedValues = signal<Set<any>>(new Set());
  public readonly isAllSelected = signal<boolean>(true);

  // Filtros condicionales
  public readonly activeTab = signal<'values' | 'condition'>('values');
  public readonly numOperator = signal<NumberOperator>('GTE');
  public readonly numValue = signal<number | null>(null);
  public readonly numValueTo = signal<number | null>(null);
  public readonly strOperator = signal<StringOperator>('CONTAINS');
  public readonly strValue = signal<string>('');

  private prevOpen = false;

  constructor() {
    // Sincronizar estado únicamente cuando el popover pasa de CERRADO a ABIERTO
    effect(() => {
      const open = this.isOpen();
      if (open && !this.prevOpen) {
        this.initWorkingState();
      }
      this.prevOpen = open;
    });
  }

  public initWorkingState(): void {
    const filter = this.currentFilter();
    const allDistinct = this.getAllDistinctValues();

    if (filter && filter.selectedValues !== undefined) {
      this.selectedValues.set(new Set(filter.selectedValues));
      this.isAllSelected.set(filter.selectedValues.size === allDistinct.length);
    } else {
      // Por defecto todos seleccionados
      this.selectedValues.set(new Set(allDistinct));
      this.isAllSelected.set(true);
    }

    if (filter?.numberOperator) {
      this.numOperator.set(filter.numberOperator);
      this.numValue.set(filter.numberValue ?? null);
      this.numValueTo.set(filter.numberValueTo ?? null);
      this.activeTab.set('condition');
    } else {
      this.numValue.set(null);
      this.numValueTo.set(null);
    }

    if (filter?.stringOperator) {
      this.strOperator.set(filter.stringOperator);
      this.strValue.set(filter.stringValue ?? '');
      this.activeTab.set('condition');
    } else {
      this.strValue.set('');
    }

    this.searchInValues.set('');
  }

  // Lista de todos los valores distintos con sus conteos
  public readonly distinctOptions = computed<DistinctValueOption[]>(() => {
    const values = this.rawValues();
    const countMap = new Map<any, number>();

    for (const val of values) {
      const normalized = val === null || val === undefined || val === '' ? '(Vacío)' : val;
      countMap.set(normalized, (countMap.get(normalized) || 0) + 1);
    }

    const selected = this.selectedValues();
    const search = this.searchInValues().trim().toLowerCase();

    const options: DistinctValueOption[] = [];
    countMap.forEach((count, val) => {
      const label = String(val);
      if (!search || label.toLowerCase().includes(search)) {
        options.push({
          value: val,
          label,
          count,
          checked: selected.has(val),
        });
      }
    });

    // Ordenar opciones: alfabética o numéricamente
    return options.sort((a, b) => {
      if (typeof a.value === 'number' && typeof b.value === 'number') {
        return a.value - b.value;
      }
      return a.label.localeCompare(b.label);
    });
  });

  public getAllDistinctValues(): any[] {
    const values = this.rawValues();
    const unique = new Set<any>();
    for (const val of values) {
      unique.add(val === null || val === undefined || val === '' ? '(Vacío)' : val);
    }
    return Array.from(unique);
  }

  public selectAllValues(): void {
    const all = this.getAllDistinctValues();
    this.selectedValues.set(new Set(all));
    this.isAllSelected.set(true);
  }

  public deselectAllValues(): void {
    this.selectedValues.set(new Set());
    this.isAllSelected.set(false);
  }

  public toggleSelectAll(checked?: boolean): void {
    const nextState = checked !== undefined ? checked : !this.isAllSelected();
    if (nextState) {
      this.selectAllValues();
    } else {
      this.deselectAllValues();
    }
  }

  public toggleValue(val: any, isChecked?: boolean): void {
    const current = new Set(this.selectedValues());
    const willCheck = isChecked !== undefined ? isChecked : !current.has(val);
    if (willCheck) {
      current.add(val);
    } else {
      current.delete(val);
    }
    this.selectedValues.set(current);
    this.isAllSelected.set(current.size === this.getAllDistinctValues().length);
  }

  public setSort(direction: 'ASC' | 'DESC'): void {
    this.changeSort.emit({
      columnKey: this.column().key,
      direction,
    });
  }

  public clearSort(): void {
    this.changeSort.emit({
      columnKey: this.column().key,
      direction: null,
    });
  }

  public onApply(): void {
    const colKey = this.column().key;
    const allDistinct = this.getAllDistinctValues();
    const selected = this.selectedValues();

    const criteria: ColumnFilterCriteria = {
      columnKey: colKey,
    };

    // Si está en la pestaña de valores
    if (this.activeTab() === 'values') {
      // Aplicamos si difiere del total seleccionado
      if (selected.size < allDistinct.length) {
        criteria.selectedValues = new Set(selected);
      }
    } else {
      // Pestaña de condición
      if (this.column().type === 'number' && this.numValue() !== null) {
        criteria.numberOperator = this.numOperator();
        criteria.numberValue = Number(this.numValue());
        if (this.numOperator() === 'BETWEEN' && this.numValueTo() !== null) {
          criteria.numberValueTo = Number(this.numValueTo());
        }
      } else if (this.strValue().trim()) {
        criteria.stringOperator = this.strOperator();
        criteria.stringValue = this.strValue().trim();
      }
    }

    if (
      criteria.selectedValues !== undefined ||
      criteria.numberValue !== undefined ||
      criteria.stringValue
    ) {
      this.applyFilter.emit(criteria);
    } else {
      this.clearFilter.emit(colKey);
    }

    this.close.emit();
  }

  public onClear(): void {
    this.clearFilter.emit(this.column().key);
    this.close.emit();
  }
}
