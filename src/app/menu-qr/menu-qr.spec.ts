import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuQr } from './menu-qr';

describe('MenuQr', () => {
  let component: MenuQr;
  let fixture: ComponentFixture<MenuQr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuQr]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuQr);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
