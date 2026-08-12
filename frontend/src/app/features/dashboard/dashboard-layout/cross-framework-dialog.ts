import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface CrossFrameworkDialogData {
  detectedLabel: string;
  selectedLabel: string;
}

@Component({
  selector: 'app-cross-framework-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, FormsModule],
  templateUrl: './cross-framework-dialog.html',
  styleUrl: './cross-framework-dialog.css',
})
export class CrossFrameworkDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CrossFrameworkDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CrossFrameworkDialogData
  ) {}

  public switchStack(): void {
    this.dialogRef.close('switch');
  }

  public migrateAnyway(): void {
    this.dialogRef.close('migrate');
  }
}