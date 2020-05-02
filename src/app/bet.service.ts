import { Injectable } from '@angular/core';
import { Web3Service } from './web3.service';
import { Bet } from './bet';
import { Subject, Subscription } from 'rxjs';

declare let require: any;

const CASINO_CONTRACT = require('../assets/contracts/Casino.json');
const COINFLIP_CONTRACT = require('../assets/contracts/CoinFlip.json');

const CASINO_CONTRACT_ADDR = new Map<string, string>();
CASINO_CONTRACT_ADDR.set("3", '0x3083c308b31C3a0D72a8C78B6dDAa43c2A6fa5b0');
CASINO_CONTRACT_ADDR.set("42", '0x83f6492a84e2D89A1848De372802EBf675Aa956D');
//CASINO_CONTRACT_ADDR.set("5777", '0xda40008eFb81AA382Bc4FaBBf7463585a201A5EA');

@Injectable({
  providedIn: 'root',
})
export class BetService {

  public bets: Bet[] = [];
  dirty: Subject<void> = new Subject();

  balance: any;
  private casinoSubscription: Subscription;

  constructor(private web3Service: Web3Service) {
    web3Service.network.subscribe(newNetwork => {
      this.bets.forEach(b => this.unsubscribeFromCoinFlip(b));
      this.bets = [];
      this.unsubscribeFromCasino();
      this.subscribeToCasino();
      this.dirty.next();
    });
    web3Service.account.subscribe(newAccount => {
      if (newAccount)
        web3Service.getBalance(newAccount).then(data => {
          this.balance = web3Service.toEther(data);
          this.dirty.next();
        });
    });
  }

  private subscribeToCasino() {
    this.getCasino().then(contract => {
      console.log("REGISTER: for casino.GameCreated event on " + this.getContractAddress() + "...");
      this.casinoSubscription = contract.events.GameCreated({ fromBlock: 0, toBlock: 'latest' })
        .on('data', e => {
          this.getCoinFlip(e.returnValues[0]).then(contract => {
            if (contract == undefined)
              return;
            console.log("EVENT: casino.GameCreated - Bet found at " + e.returnValues[0]);
            const b = new Bet(e.returnValues[0]);
            this.bets.unshift(b);
            this.subscribeToCoinFlip(b, contract);
            this.dirty.next();
          });
        });
    });
  }

  private unsubscribeFromCasino() {
    if (this.casinoSubscription) {
      console.log("UNREGISTER: from casino.GameCreated event on " + this.getContractAddress() + "...");
      this.casinoSubscription.unsubscribe();
      this.casinoSubscription = undefined;
    }
  }

  private subscribeToCoinFlip(b: Bet, contract: any) {
    console.log("REGISTER: for coinflip.StateChanged event on " + b.addr + " ...");
    b.subscription = contract.events.StateChanged({ fromBlock: 0, toBlock: 'latest' })
      .on('data', (e) => {
        console.log("EVENT: coinflip.StateChanged - State of bet " + b.addr + " changed to " + e.returnValues[0]);
        b.state = e.returnValues[0];
        if (b.state >= 4) {
          const index = this.bets.indexOf(b, 0);
          if (index > -1) {
            this.bets.splice(index, 1);
          }
          console.log("Bet " + b.addr + " removed.");
          this.dirty.next();
        } else {
          contract.methods.g().call().then(data => {
            b.amount = this.web3Service.toEther(data.amount)
            b.balance = this.web3Service.toEther(data.balance);
            b.value = this.web3Service.toEther(data.value);
            b.fees = this.web3Service.toEther(data.fees);
            b.starter = data.starter;
            b.joiner = data.joiner;
            b.winner = data.winner;
            b.heads = data.heads;
            contract.methods.getOwner().call().then(newOwner => {
              b.owner = newOwner;
              this.web3Service.getBalance(b.addr).then(data => {
                b.realbalance = this.web3Service.toEther(data);
                this.dirty.next();
              });
              this.dirty.next();
            });
            this.dirty.next();
          });
        }
      });
  }

  private unsubscribeFromCoinFlip(b: Bet) {
    console.log("UNREGISTER: for coinflip.StateChanged event on " + b.addr + " ...");
    b.subscription.unsubscribe();
    b.subscription = undefined;
  }

  public isNetworkSupported() {
    return CASINO_CONTRACT_ADDR.has(this.web3Service.network.value);
  }

  public getContractAddress() {
    return CASINO_CONTRACT_ADDR.get(this.web3Service.network.value);
  }

  public createBet(betvalue, heads) {
    console.log("Creating CoinFlip Bet with " + betvalue + " wei ...");
    this.getCasino().then(contract => {
      const config = this.web3Service.etherConfig(betvalue);
      const sent = contract.methods.createCoinFlip(heads).send(config);
      return this.handleBeforeReturn(sent, contract, "createCoinFlip");
    });
  }

  private handleBeforeReturn(sent: any, contract, name) {
    return sent
      .on("transactionHash", (hash) => {
        console.log("ACTION: " + contract._address + "." + name + " -> Hash " + hash);
      })
      .on("confirmation", (confirmationNr) => {
        console.log("ACTION: " + contract._address + "." + name + " -> Confirmed " + confirmationNr);
      })
      .on("receipt", async (receipt) => {
        console.log("ACTION: " + contract._address + "." + name + " -> Receipt");
        console.log(receipt);
      })
      .catch((err) => {
        console.warn("ACTION: " + contract._address + "." + name + " -> " + err.message);
      });
  }

  public joinButtonClicked(b: Bet) {
    const config = this.web3Service.etherConfig(b.amount);
    this.getCoinFlip(b.addr)
      .then(contract => this.handleBeforeReturn(contract.methods.join().send(config), contract, "join"));
  }

  public cancelButtonClicked(b: Bet) {
    const config = this.web3Service.defaultConfig();
    this.getCoinFlip(b.addr)
      .then(contract => this.handleBeforeReturn(contract.methods.cancel().send(config), contract, "cancel"));
  }

  public claimButtonClicked(b: Bet) {
    const config = this.web3Service.defaultConfig();
    this.getCoinFlip(b.addr)
      .then(contract => this.handleBeforeReturn(contract.methods.claim().send(config), contract, "claim"));
  }

  public collectButtonClicked(b: Bet) {
    const config = this.web3Service.defaultConfig();
    this.getCoinFlip(b.addr)
      .then(contract => this.handleBeforeReturn(contract.methods.collect().send(config), contract, "collect"));
  }

  private getCasino() {
    return this.web3Service.getContract(this.getContractAddress(), CASINO_CONTRACT);
  }

  private getCoinFlip(addr: any) {
    return this.web3Service.getContract(addr, COINFLIP_CONTRACT);
  }

}