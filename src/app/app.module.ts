import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { BetService } from './bet.service';
import { Web3Service } from './web3.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [BetService, Web3Service],
  bootstrap: [AppComponent]
})
export class AppModule { }
