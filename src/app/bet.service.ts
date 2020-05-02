import { Injectable } from '@angular/core';
import { Web3Service } from './web3.service';
import { Bet } from './bet';
import { Subject, Subscription } from 'rxjs';

declare let require: any;

const CASINO_CONTRACT = require('../assets/contracts/Casino.json');
const COINFLIP_CONTRACT = require('../assets/contracts/CoinFlip.json');

const CASINO_CONTRACT_ADDR = new Map<string, string>();
CASINO_CONTRACT_ADDR.set("3", '0xE14434E433d27B95981Db181B0d59B83A696e034');
CASINO_CONTRACT_ADDR.set("42", '0xbdC58CEB5C03137aC2ce6bfBC271e2e0A4Ac9A89');
CASINO_CONTRACT_ADDR.set("5777", '0xC430E5e14f9beB5FA4996f0178e758bf3C1b6E40');

@Injectable({
  providedIn: 'root',
})
export class BetService {

  public bets: Bet[] = [];
  dirty: Subject<void> = new Subject();

  private casinoSubscription: Subscription;

  constructor(private web3Service: Web3Service) {
    web3Service.network.subscribe(newNetwork => {
      this.bets.forEach(b => {
        console.log("UNREGISTER: for coinflip.StateChanged event on " + b.addr + " ...");
        b.subscription.unsubscribe();
      });
      this.bets = [];
      this.unsubscribeFromCasino();
      this.subscribeToCasino();
      this.dirty.next();
    });
  }

  private subscribeToCasino() {
    this.getCasino().then(contract => {
      console.log("REGISTER: for casino.GameCreated event on " + this.getContractAddress() + "...");
      this.casinoSubscription = contract.events.GameCreated({ fromBlock: 0, toBlock: 'latest' })
        .on('data', e => {
          console.log("EVENT: casino.GameCreated - Bet found at " + e.returnValues[0]);
          const b = new Bet(e.returnValues[0]);
          this.bets.unshift(b);
          this.subscribeToCoinFlip(b);
          this.dirty.next();
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

  private subscribeToCoinFlip(b: Bet) {
    this.getCoinFlip(b.addr).then(contract => {
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
          } else {
            contract.methods.g().call().then(data => {
              b.amount = this.web3Service.toEther(data.amount)
              b.balance = this.web3Service.toEther(data.balance);
              b.value = this.web3Service.toEther(data.value);
              b.starter = data.starter;
              b.joiner = data.joiner;
              b.winner = data.winner;
              b.heads = data.heads;
              contract.methods.getOwner().call().then(newOwner => {
                b.owner = newOwner;
                this.dirty.next();
              });
            });
          }
        });
    });
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
      return this.handleBeforeReturn(sent, contract, "createCoinFlip")
        .catch((err) => {
          console.warn("Error placing bet: ");
          console.warn(err);
        });
    });
  }

  private handleBeforeReturn(sent: any, contract, name) {
    return sent
      .on("transactionHash", (hash) => {
        console.log("ACTION: " + contract._address + "." + name + " -> " + hash);
      })
      .on("confirmation", (confirmationNr) => {
        console.log("ACTION: " + contract._address + "." + name + " -> Confirm " + confirmationNr);
      })
      .on("receipt", async (receipt) => {
        console.log("ACTION: " + contract._address + "." + name + " -> Receipt");
        console.log(receipt);
        setTimeout(() => this.web3Service.updateBalance(), 1000);
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