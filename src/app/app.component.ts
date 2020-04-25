import { Component, ChangeDetectorRef, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Web3Service } from './web3.service';
import { BetService } from './bet.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
  //, changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {

  title = 'CasinoDapp';
  betinputvalue = "";
  bet = "tails";
  subscription: Subscription;

  constructor(public web3Service: Web3Service, private dc: ChangeDetectorRef, public betService: BetService) { }

  ngOnInit(): void {
    this.subscription = this.betService.dirty.subscribe(() => {
      this.dc.detectChanges();
    })
  }

  connect(_event) {
    this.web3Service.connect().then(() => this.update());
  }

  iAmOwner(owner: string) {
    return owner != undefined && this.web3Service.account && this.web3Service.account.toLowerCase() === owner.toLowerCase();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  minicoinClicked(e) {
    e.currentTarget.classList.remove(this.bet);
    this.bet = (this.bet === 'heads' ? 'tails' : 'heads');
    e.currentTarget.classList.add(this.bet);
    this.update();
  }

  valuechanged(e) {
    this.betinputvalue = e.target.value;
  }

  flipButtonClicked(e) {
    if (this.betinputvalue == "")
      return;
    this.betService.createBet(this.betinputvalue, "tails" === this.bet);
    this.betinputvalue = "";
    this.update();
  }

  update() {
    this.dc.detectChanges();
  }

  colorFromAddr(addr, alpha) {
    return this.addAlpha("#" + this.intToARGB(this.hashCode(addr)), alpha);
  }

  private addAlpha(color: string, opacity: number): string {
    // coerce values so ti is between 0 and 1.
    const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
    return color + _opacity.toString(16).toUpperCase();
  }

  // Hash any string into an integer value
  // Then we'll use the int and convert to hex.
  private hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  // Convert an int to hexadecimal with a max length
  // of six characters.
  private intToARGB(i) {
    var hex = ((i >> 24) & 0xFF).toString(16) +
      ((i >> 16) & 0xFF).toString(16) +
      ((i >> 8) & 0xFF).toString(16) +
      (i & 0xFF).toString(16);
    // Sometimes the string returned will be too short so we 
    // add zeros to pad it out, which later get removed if
    // the length is greater than six.
    hex += '000000';
    return hex.substring(0, 6);
  }
}
