import { 
    Component, OnInit, OnChanges, Input, Output, ViewChild, ElementRef, ViewEncapsulation, EventEmitter, SimpleChange   
} from '@angular/core';
import { Router } from '@angular/router'

import { DatagridSettings, DatagridLangs, DatagridRoutes, DatagridFilter, RouteItem, LazyloadEvent } from './datagrid.model';
import { PaginationSettings } from '../pagination/pagination.model';
import { SelectItem, SelectSettings } from '../select/select.model';
import { PopoverComponent } from '../popover/popover.component';

import { OverwriteService } from '../../shared/services/overwrite.service';
import { HelperService } from '../../shared/services/helper.service';

@Component({ 
    moduleId: module.id,
    selector: 'fox-datagrid',
    templateUrl: 'datagrid.component.html',
    styleUrls: ['datagrid.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class DatagridComponent implements OnInit, OnChanges {
    @Input() settings: DatagridSettings;
    @Input() langs: DatagridLangs;
    @Input() routes: DatagridRoutes;
    @Input() filters: any;
    @Input() rows: Array<any>;
    @Input() total: number = 0;

    @Output() lazyLoad: EventEmitter<any> = new EventEmitter();
    @Output() remove: EventEmitter<any> = new EventEmitter();
    @Output() removeSelected: EventEmitter<any> = new EventEmitter();
    @Output() rowClick: EventEmitter<any> = new EventEmitter();
    @Output() rowSelect: EventEmitter<any> = new EventEmitter();
    @Output() rowUnselect: EventEmitter<any> = new EventEmitter();
    @Output() filtersReseted: EventEmitter<any> = new EventEmitter();
    @Output() filtersSubmited: EventEmitter<any> = new EventEmitter();
    @Output() sortSubmited: EventEmitter<any> = new EventEmitter();
    
    protected totalRowsView: number;
    protected totalRowsViewOptions: Array<SelectItem> = [];
    protected paginationSettings: PaginationSettings = {
        max: 5
    }
    protected totalSettings: SelectSettings = {
        required: true
    }
    protected defaultLangs: DatagridLangs;
    protected defaultSettings: DatagridSettings;
    protected currentPage: number = 1;
    protected firstItem: number = 0;
    protected sortedField: string;
    protected sortedOrder: 'asc' | 'desc';
    protected viewedItemsCount: number = 0;
    protected totalPages: number = 1;
    protected checkedItems: Array<number> = [];
    protected filtersData: any = { };
    protected isPreloaded: boolean;

    constructor(
        private router: Router, 
        private overwriteService: OverwriteService,
        private helperService: HelperService
    ) {
        this.defaultSettings = overwriteService.getSettings('datagrid');
        this.defaultLangs = overwriteService.getLangs('datagrid');
    }

    ngOnInit() {
        this.settings = (<any>Object).assign({}, this.defaultSettings, this.settings);
        this.langs = (<any>Object).assign({}, this.defaultLangs, this.langs);
        this.sortedField = this.settings.defaultSortedField;
        this.sortedOrder = this.settings.defaultSortedOrder;

        if(this.settings.totalViewList.length) {
            for(let value in this.settings.totalViewList) {
                let total = this.settings.totalViewList[value];
                if(this.total < total) {
                    continue;
                }

                this.totalRowsViewOptions.push({
                    label: this.langs.totalRowsView + ' ' + total, 
                    value: total
                });
            }
        }

        this.totalRowsView = this.totalRowsViewOptions[0].value;

        this.fireLazyLoadEvent();
        
        this.viewedItemsCount = this.getViewedItemsCount();
        this.totalPages = this.getTotalPages();
        this.filtersData = this.buildFiltersObject();
    }

    ngOnChanges(changes: any) {
        if(changes.rows) {
            this.stopPreloader();
        }

        if(changes.settings) {
            let data = (<any>Object).assign({}, changes.settings.previousValue, changes.settings.currentValue);
            this.settings = (<any>Object).assign({}, this.defaultSettings, data);
        }

        if(changes.langs) {
            let data = (<any>Object).assign({}, changes.langs.previousValue, changes.langs.currentValue);
            this.langs = (<any>Object).assign({}, this.defaultLangs, data);
        }
    }

    getViewedItemsCount(): number {
        let viewed = this.totalRowsView * this.currentPage;
        
        if(viewed > this.total) {
            viewed = this.total;
        }

        return viewed;
    }

    getTotalPages(): number {
        return Math.ceil(this.total / this.totalRowsView);
    }

    onChangePage(event: any): void {
        this.currentPage = event.page;
        this.changeGridData();
    }

    onChangeTotal(event: any): void {
        this.currentPage = 1;
        this.totalRowsView = event.value;
        this.changeGridData();
    }

    calculateFirstRow(): number {
        let firstItem: number;

        if(this.currentPage == 1) {
            firstItem = 0;
        } else {
            firstItem = (this.currentPage * this.totalRowsView) - this.totalRowsView;
        }

        return firstItem;
    }

    changeGridData(): void {
        this.firstItem = this.calculateFirstRow();
        this.viewedItemsCount = this.getViewedItemsCount();
        this.totalPages = this.getTotalPages();

        this.fireLazyLoadEvent();
    }

    createLazyLoadData(): LazyloadEvent {
        return {
            first: this.firstItem,
            rows: Number(this.totalRowsView),
            sortedField: this.sortedField,
            sortedOrder: this.sortedOrder,
            filters: this.filtersData,
            currentPage: Number(this.currentPage)
        };
    }

    rowClickHandler(event: any, row: any): void {
        if(event.target.nodeName == 'TD') {
            this.rowClick.emit({originalEvent: event, row: row});

            if(this.settings.actionOnRowClick) {
                this.router.navigate(this.settings.actionOnRowClick);
            }
        }
    }

    rowSelectHandler(event: any, row: any): void {
        this.rowSelect.emit({originalEvent: event, row: row});
    }

    rowUnselectHandler(event: any, row: any): void {
        this.rowUnselect.emit({originalEvent: event, row: row});
    }

    rowCheckedHandler(event: any, row: any): void {
        if(event.checked) {
            this.rowSelectHandler(event, row);
        } else {
            this.rowUnselectHandler(event, row);
        }
    }

    getChecked() {
        return this.checkedItems;
    }

    onCheckedItem(event: any, row: any): void {
        if (!this.checkedItems) {
            this.checkedItems = [];
        }

        let index = this.checkedItems.indexOf(row.id);
        if(index > -1) {
            this.checkedItems.splice(index, 1);
        }
    }

    selectAllHandler(event: any, popover: PopoverComponent): void {
        this.checkedItems = this.rows.map(row => row.id);
        this.closePopover(event, popover);
    }

    unselectAllHandler(event: any, popover: PopoverComponent): void {
        this.checkedItems = [];
        this.closePopover(event, popover);
    }

    removeSelectedHandler(event: any, popover: PopoverComponent): void {
        this.removeSelected.emit(this.checkedItems);
        this.closePopover(event, popover);
    }

    removeHandler(event: any, row: any, popover: PopoverComponent): void {
        this.remove.emit(row.id);
        popover.show(event);
    }

    routeNavigate(event: any, route: RouteItem, row?: any): void {
        let parametrs: any = { };
        
        if(route.parametrs && row) {
            for(let param in route.parametrs) {
                parametrs[route.parametrs[param]] = row[route.parametrs[param]];
            }
        }
        
        this.router.navigate([route.route, parametrs]);
    }
    
    closePopover(event: any, popover: PopoverComponent) {
        popover.show(event);
    }

    buildFiltersObject(): any {
        let filtersObject: any = {};

        if(this.filters) {
            for(let filter in this.filters) {
                filtersObject[this.filters[filter].field] = [];
                filtersObject[this.filters[filter].field]['value'] = '';
                filtersObject[this.filters[filter].field]['equal'] = 'like';
            }
        }

        return filtersObject;
    }

    filterSubmitHandler(event: any): void {
        this.filtersData = event;

        this.fireLazyLoadEvent();

        this.filtersSubmited.emit({originalEvent: event, filtersData: this.filtersData});
    }

    resetFiltersHandler(event: any): void {
        this.sortedField = this.settings.defaultSortedField;
        this.sortedOrder = this.settings.defaultSortedOrder;
        this.filtersData = this.buildFiltersObject();
        this.totalRowsView = this.totalRowsViewOptions[0].value;
        this.currentPage = 1;
        this.checkedItems = [];

        this.changeGridData();

        this.filtersReseted.emit({originalEvent: event, filtersData: this.filtersData});
    }

    filterChangedHandler(event: any): void {
        this.filtersData = event;

        this.fireLazyLoadEvent();
    }

    sortChangedHandler(event: any): void {
        this.sortedField = event.sortedField;
        this.sortedOrder = event.sortedOrder;

        this.fireLazyLoadEvent();

        this.sortSubmited.emit({originalEvent: event, sortedField: this.sortedField, sortedOrder: this.sortedOrder});
    }

    fireLazyLoadEvent(): void {
        this.startPreloader();

        if(this.settings.lazyload) {
            this.lazyLoad.emit(this.createLazyLoadData());
        }
    }

    startPreloader(): void {
        this.isPreloaded = true;
    }

    stopPreloader(): void {
        this.isPreloaded = false;
    }
}