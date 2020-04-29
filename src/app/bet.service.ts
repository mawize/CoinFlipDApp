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

  constructor(private web3Service: Web3Service) {
    this.subscribeToCasino();
  }

  private subscribeToCasino() {
    console.log("REGISTER: for casino.GameCreated event on " + this.getContractAddress() + "...");
    this.getCasino().events.GameCreated({ fromBlock: 0, toBlock: 'latest' })
      .on('data', (e) => {
        this.web3Service.getContractData(e.returnValues[0]).then(code => {
          if (code !== '0x') {
            console.log("EVENT: casino.GameCreated - Bet found at " + e.returnValues[0]);
            const b = new Bet(e.returnValues[0]);
            this.bets.unshift(b);
            this.dirty.next();
            this.subscribeToCoinFlip(b);
          } else {
            console.log("EVENT: casino.GameCreated - DESTROYED bet found at " + e.returnValues[0]);
          }
        })
      });
  }

  private subscribeToCoinFlip(b: Bet) {
    console.log("REGISTER: for coinflip.StateChanged event on " + b.addr + " ...");
    const c = this.getCoinFlip(b.addr);
    c.events.StateChanged({ fromBlock: 0, toBlock: 'latest' })
      .on('data', (e) => {
        console.log("EVENT: coinflip.StateChanged - State of bet " + b.addr + " changed to " + e.returnValues[0]);
        b.state = e.returnValues[0];
        if (b.state >= 4) {
          const index = this.bets.indexOf(b, 0);
          if (index > -1) {
            this.bets.splice(index, 1);
          }
        } else {
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
        }
      });
  }


  public isNetworkSupported() {
    return CASINO_CONTRACT_ADDR.has(this.web3Service.network);
  }

  public getContractAddress() {
    return CASINO_CONTRACT_ADDR.get(this.web3Service.network);
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
    return this.web3Service.getContract(this.getContractAddress(), CASINO_CONTRACT);
  }

  private getCoinFlip(addr: any) {
    return this.web3Service.getContract(addr, COINFLIP_CONTRACT);
  }

}