import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Menus } from './menus';

describe('Menus', () => {
  let component: Menus;
  let fixture: ComponentFixture<Menus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Menus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Menus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
