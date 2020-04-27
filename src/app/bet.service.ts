import { Injectable } from '@angular/core';
import { Web3Service } from './web3.service';
import { Bet } from './bet';
import { Subject, Subscription } from 'rxjs';

declare let require: any;

const CASINO_CONTRACT = require('../assets/contracts/Casino.json');
const COINFLIP_CONTRACT = require('../assets/contracts/CoinFlip.json');
const CASINO_CONTRACT_ADDR = '0xCf6e288c65a5e87dC76958077D81323A4876738b';


@Injectable({
  providedIn: 'root',
})
export class BetService {

  public bets: Bet[] = [];
  dirty: Subject<void> = new Subject();

  subscription: Subscription;

  constructor(private web3Service: Web3Service) {
    this.subscription = web3Service.dirty.subscribe(() => {

      if (web3Service.network != 'disconnected') {
      }
    });

    console.log("REGISTER: for casino.GameCreated event ...");
    this.getCasino().events.GameCreated({ fromBlock: 0, toBlock: 'latest' })
      .on('data', (e) => {
        web3Service.getContractData(e.returnValues[0]).then(code => {
          if (code !== '0x') {
            console.log("EVENT: casino.GameCreated - Bet found at " + e.returnValues[0]);
            const b = new Bet(e.returnValues[0]);
            this.betCreated(b);
            this.dirty.next();
          } else {
            console.log("EVENT: casino.GameCreated - DESTROYED bet found at " + e.returnValues[0]);
          }
        })
      });
  }

  public getContractAddress() {
    return CASINO_CONTRACT_ADDR;
  }

  public createBet(betvalue, heads) {
    console.log("Creating CoinFlip Bet with " + betvalue + " wei ...");
    const contract = this.getCasino();
    const config = this.web3Service.etherConfig(betvalue);
    const sent = contract.methods.createCoinFlip(heads).send(config);
    return this.handleBeforeReturn(sent, contract, "createCoinFlip")
      .catch((err) => {
        console.warn("Error placing bet: ");
        console.warn(err);
      });
  }

  private betCreated(b: Bet) {
    if (this.bets.find(i => i.addr === b.addr))
      this.bets = this.bets.filter(function (obj) {
        return obj.state !== '5' && obj.addr !== b.addr;
      });
    this.bets.unshift(b);

    console.log("REGISTER: for coinflip.StateChanged event on " + b.addr + " ...");
    const c = this.getCoinFlip(b.addr);
    c.events.StateChanged({ fromBlock: 0, toBlock: 'latest' })
      .on('data', (e) => {
        console.log("EVENT: coinflip.StateChanged - State of bet " + b.addr + " changed to " + e.returnValues[0]);
        b.state = e.returnValues[0];
        c.methods.g().call().then(data => {
          b.amount = this.web3Service.toEther(data.amount)
          b.balance = this.web3Service.toEther(data.balance);
          b.value = this.web3Service.toEther(data.value);
          b.starter = data.starter;
          b.joiner = data.joiner;
          b.winner = data.winner;
          b.heads = data.heads;
          c.methods.getOwner().call().then(newOwner => {
            b.owner = newOwner;
            this.dirty.next();
          });
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
        this.web3Service.updateBalance();
      })
      .on("receipt", async (receipt) => {
        console.log("ACTION: " + contract._address + "." + name + " -> Receipt");
        console.log(receipt);
      });
  }

  public joinButtonClicked(b: Bet) {
    const config = this.web3Service.etherConfig(b.amount);
    const contract = this.getCoinFlip(b.addr);
    const sent = contract.methods.join().send(config);
    return this.handleBeforeReturn(sent, contract, "join");
  }

  public cancelButtonClicked(b: Bet) {
    const config = this.web3Service.defaultConfig();
    const contract = this.getCoinFlip(b.addr);
    const sent = contract.methods.cancel().send(config);
    return this.handleBeforeReturn(sent, contract, "cancel");
  }

  public claimButtonClicked(b: Bet) {
    const config = this.web3Service.defaultConfig();
    const contract = this.getCoinFlip(b.addr);
    const sent = contract.methods.claim().send(config);
    return this.handleBeforeReturn(sent, contract, "claim");
  }

  public collectButtonClicked(b: Bet) {
    const config = this.web3Service.defaultConfig();
    const contract = this.getCoinFlip(b.addr);
    const sent = contract.methods.collect().send(config);
    return this.handleBeforeReturn(sent, contract, "collect");
  }

  private getCasino() {
    return this.web3Service.getContract(CASINO_CONTRACT_ADDR, CASINO_CONTRACT);
  }

  private getCoinFlip(addr: any) {
    return this.web3Service.getContract(addr, COINFLIP_CONTRACT);
  }

}