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
  public networkName = undefined;

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
        this.updateNetwork(this._provider.networkVersion);
      }

      this._web3 = new Web3(this._provider);
      this._web3.eth.net.isListening()
        .then(() => {
          console.log('Web3 is connected.');
        })
        .catch(e => this.onError('eth.net.isListening()'));

    } else {
      this.onError('Please use a browser like Brave or MetaMask plugin for Chrome/Firefox');
    }
  }

  private onError(msg) {
    console.error(msg);
    this.updateNetwork('disconnected');
    this.updateAccount(undefined);
  }

  public connect() {
    return this._provider.enable().then(accounts => {
      this.updateAccount(accounts);
    })
      .catch(e => this.onError('provider.enable()'));

  }

  public toEther(weiamount) {
    return Web3.utils.fromWei(weiamount, "ether")
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
    //console.log("Getting contract '" + artefact.contractName + "' from '" + addr + "' ...");
    if (this.getContractData(addr) === '0x')
      console.error("Cannot get contract '" + artefact.contractName + "' from '" + addr + "'");
    else
      return new this._web3.eth.Contract(artefact.abi, addr, this.defaultConfig());
  }

  public getContractData(addr) {
    return this._web3.eth.getCode(addr);
  }

  private updateAccount(accounts) {
    if (accounts != undefined && typeof accounts[0] != undefined) {
      this.account = accounts[0];
      console.log("Account changed: " + this.account);
      this.updateBalance();
    } else {
      this.account = undefined;
      console.warn("Account disconnected");
    }
    this.dirty.next();
  }

  private updateNetwork(network: any) {
    if (this.network !== undefined)
      location.reload(true); // as long as i dont know how to unsubscribe from events ...

    this.network = network;

    switch (this.network) {
      case '3':
        this.networkName = 'ropsten';
        break;
      case '42':
        this.networkName = 'kovan';
        break;
      default:
        this.networkName = undefined;
    }
    console.log("Network changed: " + this.network);
  }

  public updateBalance() {
    this._web3.eth.getBalance(this.account).then(data => {
      this.accountBalance = this.toEther(data);
      console.log("Balance updated: " + this.accountBalance);
      this.dirty.next();
    })
      .catch(e => this.onError('getBalance() for ' + this.account));
  }
}
