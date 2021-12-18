import MathFn from "../util/MathFn.js";

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

    getCopyGenome() {
        return JSON.parse(JSON.stringify(this.__genome));
    }

    setGenome(genome) {
        this.__genome = genome;
        return this;
    }

    getCapital() {
        return this.__capital;
    }

    setCapital(capital) {
        this.__capital = MathFn.currency(capital);
        return this;
    }

    getProfit() {
        return this.__profit;
    }

    setProfit(profit) {
        this.__profit = MathFn.currency(profit);
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
        this.__withdrawal = MathFn.currency(withdrawal);
        return this;
    }

    getGeneration() {
        return this.__generation;
    }

    setGeneration(generation) {
        this.__generation = generation;
        return this;
    }

    getInitialCapital() {
        return this.__initialCapital;
    }

    setInitialCapital(capital) {
        this.__initialCapital = capital;
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

    executeTrade({
        model,
        modelIndex,
        perTradeComission,
        perTradeReward,
        priceCloseToday,
        priceExpectedMove,
        tickerSymbol,
    }) {
        let profit = 0;
        const sumOfModelOutput = model.reduce((acc, val) => acc + val);
        
        // Long
        let availableCapital = this.getCapital();
        let risk = (model[modelIndex * 2] / sumOfModelOutput) || 0;
        // let risk = model[modelIndex * 2];
        let capitalToUse = availableCapital * risk;
        let costOfTradeLong = capitalToUse > 0 
            ? perTradeComission
            : 0;
        let rewardLong = capitalToUse * perTradeReward - costOfTradeLong;
        let long = -priceExpectedMove < priceCloseToday
            ? MathFn.currency(rewardLong)
            : MathFn.currency(rewardLong - capitalToUse);    
        this.setCapital(availableCapital - capitalToUse);
        console.log(`  profit long ${tickerSymbol}: ${long}`);
        profit += long;
        
        // Short
        availableCapital = this.getCapital();
        risk = (model[modelIndex * 2 + 1] / sumOfModelOutput) || 0;
        // risk = model[modelIndex * 2 + 1];
        capitalToUse = availableCapital * risk;
        let costOfTradeShort = capitalToUse > 0 
            ? perTradeComission
            : 0;
        let rewardShort = capitalToUse * perTradeReward - costOfTradeShort;
        let short = priceExpectedMove > priceCloseToday
            ? MathFn.currency(rewardShort)
            : MathFn.currency(rewardShort - capitalToUse);
        this.setCapital(availableCapital - capitalToUse);
        console.log(`  profit short ${tickerSymbol}: ${short}`);
        profit += short;

        return profit;
    }
}
