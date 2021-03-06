import { Component, OnInit } from '@angular/core';

import { SelectSettings } from '../../components/select/select.model'

@Component({
    moduleId: module.id,
    selector: 'select-demo',
    templateUrl: 'select.demo.html'
})
export class SelectDemoComponent implements OnInit {
    public value: string;
    public requiredValue: string;
    public settings: SelectSettings = {
        
    };
    public options: Array<any> = [
        {
            label: 'Option 1', 
            value: '1'
        },
        {
            label: 'Option 2', 
            value: '2'
        },
        {
            label: 'Option 3', 
            value: '3'
        }
    ];
    
    constructor() { }

    ngOnInit() { }
}