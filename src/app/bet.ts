import { Subscription } from 'rxjs';

export class Bet {

    addr: any;

    balance: any;
    amount: any;
    value: any;

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
}
