import { Injectable } from '@angular/core';
import { Observable, from, Subject } from 'rxjs';
const Web3 = require('web3'); // tslint:disable-line

declare let require: any;
declare let window: any;

@Injectable({
  providedIn: 'root',
})
export class Web3Service {
  private _web3: any;
  private _provider: any;

  public account = undefined;
  public accountBalance = undefined;
  public network = undefined;

  dirty: Subject<void> = new Subject();

  constructor() {
    if (typeof window !== 'undefined' && typeof window.web3 !== 'undefined') {
      // We are in the browser and metamask is running.
      this._provider = Web3.givenProvider;
      if ('ethereum' in window) {
        this._provider = window['ethereum'];
        this._provider.autoRefreshOnNetworkChange = false;
        this._provider.on('accountsChanged', (accounts) => this.updateAccount(accounts));
        this._provider.on('networkChanged', (network) => this.updateNetwork(network));
      }

      this._web3 = new Web3(this._provider);
      this._web3.eth.net.isListening()
        .then(() => {
          console.log('Web3 is connected.');
        })
        .catch(e => console.warn('eth.net.isListening()'));

    } else {
      console.warn(
        'Please use a browser like Brave or MetaMask plugin for Chrome/Firefox'
      );
    }
  }

  public connect() {
    return this._provider.enable().then(accounts => {
      this.updateAccount(accounts);
    })
      .catch(e => console.warn('provider.enable()'));
  }

  public toEther(weiamount) {
    return Web3.utils.fromWei(weiamount, "ether")
  }

  public getBlockNumber(): Observable<any> {
    return from(this._web3.eth.getBlockNumber());
  }

  public defaultConfig() {
    return {
      from: this.account
    };
  }

  public etherConfig(etheramount) {
    if ((etheramount.split(",").length - 1) == 1)
      etheramount = etheramount.replace(/,/g, '.');
    else
      etheramount = etheramount.replace(/,/g, '');

    return {
      from: this.account,
      gasLimit: this._web3.eth.getBlock("latest").gasLimit,
      gasPrice: this._web3.eth.gasPrice,
      value: Web3.utils.toWei(etheramount, "ether")
    };
  }

  public getContract(addr, artefact): any {
    console.log("Getting contract '" + artefact.contractName + "' from '" + addr + "' ...");
    return new (this._web3).eth.Contract(artefact.abi, addr, this.defaultConfig());
  }

  private updateAccount(accounts) {
    if (accounts != undefined && typeof accounts[0] != undefined) {
      this.account = accounts[0];
      console.log("Account changed: " + this.account);
      (this._web3).eth.getBalance(this.account).then(data => {
        this.accountBalance = this.toEther(data);
        this.dirty.next();
      })
        .catch(e => console.warn('getBalance() for ' + this.account));
    } else {
      this.account = undefined;
      console.warn("Account disconnected");
    }
  }

  private updateNetwork(network: any) {
    this.network = network;
    console.log("Network changed: " + this.network);
  }
}
