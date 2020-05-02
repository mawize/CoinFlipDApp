import { Subscription } from 'rxjs';

export class Bet {

    addr: any;

    balance: any;
    amount: any;
    value: any;
    fees: any;
    realbalance: any;

    starter: any;
    joiner: any;
    winner: any;
    owner: any;

    state: any;
    heads: any;

    subscription: Subscription;

    constructor(address: any) {
        this.addr = address;
    }

    getHeadsResult(): boolean {
        return this.heads && this.starter === this.winner || !this.heads && this.joiner == this.winner;
    }
}
