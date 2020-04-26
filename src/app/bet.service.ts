import { Injectable } from '@angular/core';
import { Web3Service } from './web3.service';
import { Bet } from './bet';
import { Subject } from 'rxjs';

declare let require: any;

const CASINO_CONTRACT = require('../assets/contracts/Casino.json');
const COINFLIP_CONTRACT = require('../assets/contracts/CoinFlip.json');
const CASINO_CONTRACT_ADDR = '0xEc2E5a8619307fE9aB1F57547b9FBe7aB2DAC253';


@Injectable({
  providedIn: 'root',
})
export class BetService {

  public bets: Bet[] = [];
  dirty: Subject<void> = new Subject();

  constructor(private web3Service: Web3Service) {
    console.log("Register for casino.GameCreated event ...");
    this.getCasino().events.GameCreated({ fromBlock: 0, toBlock: 'latest' })
      .on('data', (e) => {
        console.log("EVENT: casino.GameCreated - Bet found at " + e.returnValues[0]);
        const b = new Bet(e.returnValues[0]);
        this.betCreated(b);
        this.dirty.next();
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
    this.bets.unshift(b);

    console.log("Register for coinflip.StateChanged event for " + b.addr + " ...");
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
        console.log(contract._address + "." + name + " -> " + hash);
      })
      .on("confirmation", (confirmationNr) => {
        console.log(contract._address + "." + name + " -> Confirm " + confirmationNr);
      })
      .on("receipt", async (receipt) => {
        console.log(contract._address + "." + name + " -> Receipt");
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