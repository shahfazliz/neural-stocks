export default class Candidate {
    __id = 0;
    __genome = [];
    __capital = 0;
    __profit = 0;
    __tradeDuration = 0;
    __withdrawal = 0;
    __generation = 0;
    __initialCapital = 1000;

    constructor({
        id = 0,
        genome = [],
        capital = this.__initialCapital,
        profit = 0,
        tradeDuration = 0,
        withdrawal = 0,
        generation = 0,
    }) {
        this.__id = id;
        this.__genome = genome;
        this.__capital = capital;
        this.__profit = profit;
        this.__tradeDuration = tradeDuration;
        this.__withdrawal = withdrawal;
        this.__generation = generation;
    }

    reset() {
        this.__capital = this.__initialCapital;
        this.__profit = 0;
        this.__tradeDuration = 0;
        this.__withdrawal = 0;
        this.__generation = 0;
        return this;
    }

    isGenomeEmpty() {
        return this.__genome.length === 0;
    }

    precision(value) {
        return parseFloat(value.toFixed(5));
    }

    currency(value) {
        return parseFloat(value.toFixed(2));
    }

    getId() {
        return this.__id;
    }

    setId(id) {
        this.__id = id;
        return this;
    }

    getGenome() {
        return this.__genome;
    }

    setGenome(genome) {
        this.__genome = genome;
        return this;
    }

    getCapital() {
        return this.__capital;
    }

    setCapital(capital) {
        this.__capital = this.currency(capital);
        return this;
    }

    getProfit() {
        return this.__profit;
    }

    setProfit(profit) {
        this.__profit = this.currency(profit);
        return this;
    }

    getTradeDuration() {
        return this.__tradeDuration;
    }

    setTradeDuration(tradeDuration) {
        this.__tradeDuration = tradeDuration;
        return this;
    }

    getWithdrawal() {
        return this.__withdrawal;
    }

    setWithdrawal(withdrawal) {
        this.__withdrawal = this.currency(withdrawal);
        return this;
    }

    getGeneration() {
        return this.__generation;
    }

    setGeneration(generation) {
        this.__generation = generation;
        return this;
    }

    toString() {
        return JSON.stringify({
            id: this.getId(),
            tradeDuration: this.getTradeDuration(),
            capital: this.getCapital(),
            profit: this.getProfit(),
            withdrawal: this.getWithdrawal(),
            generation: this.getGeneration(),
            genome: this.getGenome(),
        }, undefined, 4);
    }

    scoreToString() {
        return JSON.stringify({
            id: this.getId(),
            tradeDuration: this.getTradeDuration(),
            capital: this.getCapital(),
            profit: this.getProfit(),
            withdrawal: this.getWithdrawal(),
            generation: this.getGeneration(),
        }, undefined, 4);
    }
}