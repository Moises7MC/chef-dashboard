import { Component } from '@angular/core';
import { KitchenOrdersComponent } from './components/kitchen-orders.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [KitchenOrdersComponent],
  template: '<app-kitchen-orders></app-kitchen-orders>'
})
export class AppComponent {
  title = 'chef-dashboard';
}