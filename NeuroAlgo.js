import * as tf from '@tensorflow/tfjs';
import Candidate from './model/Candidate.js';
import CollectionService from './resource/CollectionService.js';
import MathFn from './util/MathFn.js';
import tfn from '@tensorflow/tfjs-node';

const collectionService = new CollectionService();

export default class NeuroAlgo {
    __initialCapital = 1000;
    __costOfTrade = 0; // 1.74;
    __reward = 0.06; // 6%

    __numberOfCandles = 50;

    __trainedFilePath = './trained.json';

    __listOfTickers = [
        'BAL',
        'CYB',
        'DBA', 'DIA',
        'EEM',
        'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXI', 'FXY',
        'GDX', 'GDXJ', 'GLD', 'GOVT',
        'IEF', 'IEI',
        'IWM',
        'IYT',
        'NIB',
        'QQQ',
        'RJA', 'RJI',
        'SHY',
        'SPY',
        'TIP', 'TLH', 'TLT',
        'UNG', 'USO', 'UUP',
        'VXX',
        'XHB', 'XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XRT', 'XTL', 'XTN',
    ];

    __listOfTickersOfInterest = ['SPY', 'QQQ', 'IWM']; // order is important

    getListTickersOfInterest() {
        return this.__listOfTickersOfInterest;
    }

    train() {
        return collectionService
            .readJSONFileAsUniverse('./data/universe/universe.json')
            .then(universe => {
                return new Promise((resolve, reject) => {
                    const inputOutputSet = Array
                        .from({length: universe.length - this.__numberOfCandles}, (_, k) => k)
                        .reduce((accumulator, dayNumber) => {
                            const input = universe
                                .slice(dayNumber, dayNumber + this.__numberOfCandles)
                                .reduce((acc, map) => {
                                    let valueIterator = map.values();
                                    let value = valueIterator.next().value;
                                    while (value !== undefined) {
                                        acc.push(value);
                                        value = valueIterator.next().value;
                                    }
                                    return acc;
                                }, []);

                            let totalOutput = 0;
                            const output = this
                                .__listOfTickersOfInterest
                                .reduce((acc, tickerSymbol) => {
                                    const priceCloseToday = universe[dayNumber + this.__numberOfCandles].get(`${tickerSymbol}_ClosePrice`);
                                    const priceExpectedMove = universe[dayNumber + this.__numberOfCandles - 1].get(`${tickerSymbol}_StandardDeviation`);
                            
                                    let long = -priceExpectedMove < priceCloseToday ? 1 : 0;
                                    let short = priceExpectedMove > priceCloseToday ? 1 : 0
                                    
                                    acc.push(long);
                                    acc.push(short);
                                    
                                    totalOutput += long + short;

                                    return acc;
                                }, [])
                                .map(eachOutput => MathFn.currency(eachOutput / totalOutput || 0));

                            accumulator.input.push(input);
                            accumulator.output.push(output);

                            return accumulator;
                        }, {input: [], output: []});
                    
                    // Randomize sequence using Fisher-Yates (aka Knuth) Shuffle
                    let currentIndex = inputOutputSet.input.length;

                    // While there remain elements to shuffle...
                    while (0 !== currentIndex) {

                        // Pick a remaining element...
                        let randomIndex = MathFn.randomInt(0, currentIndex);
                        currentIndex--;

                        // And swap it with the current element.
                        let tempInput = inputOutputSet.input[currentIndex];
                        inputOutputSet.input[currentIndex] = inputOutputSet.input[randomIndex];
                        inputOutputSet.input[randomIndex] = tempInput;

                        let tempOutput = inputOutputSet.output[currentIndex];
                        inputOutputSet.output[currentIndex] = inputOutputSet.output[randomIndex];
                        inputOutputSet.output[randomIndex] = tempOutput;
                    }
                    resolve(inputOutputSet);
                });
            })
            .then(inputOutputSet => {
                const trainingData = tf.tensor2d(inputOutputSet.input);
                const outputData = tf.tensor2d(inputOutputSet.output);

                return tf
                    .loadLayersModel(tfn.io.fileSystem('./data/model/model.json'))
                    .then(model => {
                        console.log('Model available');
                        model.compile({
                            loss: tf.losses.meanSquaredError,
                            optimizer: tf.train.adam(0.06),
                        });
                        return model;
                    })
                    .catch(() => {
                        console.log('Model NOT available');
                        const model = tf.sequential();
                        model.add(tf.layers.dense({
                            inputShape: [inputOutputSet.input[0].length],
                            activation: 'relu6',
                            useBias: true,
                            units: 50, // Input nodes
                        }));
                        model.add(tf.layers.dense({
                            inputShape: 50,
                            activation: 'relu6',
                            useBias: true,
                            units: 50, // Hidden nodes
                        }));
                        model.add(tf.layers.dense({
                            inputShape: 50,
                            activation: 'relu6',
                            useBias: true,
                            units: 50, // Hidden nodes
                        }));
                        model.add(tf.layers.dense({
                            inputShape: 50,
                            activation: 'relu6',
                            useBias: true,
                            units: 50, // Hidden nodes
                        }));
                        model.add(tf.layers.dense({
                            inputShape: 50,
                            activation: 'relu6',
                            useBias: true,
                            units: 6, // Output nodes
                        }));
        
                        model.compile({
                            loss: tf.losses.meanSquaredError,
                            optimizer: tf.train.sgd(0.01),
                        });

                        return model;
                    })
                    .then(model => {
                        return model
                            .fit(trainingData, outputData, {epochs: 20000})
                            .then(() => {
                                model.save('file://./data/model');
                            });
                    });
            });
    }

    test() {
        return tf
            .loadLayersModel(tfn.io.fileSystem('./data/model/model.json'))
            .then(model => {
                model.compile({
                    loss: tf.losses.meanSquaredError,
                    optimizer: tf.train.sgd(0.01),
                });
                return model;
            })
            .then(model => {
                const candidate = new Candidate({
                    id: 0,
                });
                candidate
                    .reset()
                    .setInitialCapital(this.__initialCapital);

                collectionService
                    .readJSONFileAsUniverse('./data/universe/universe.json')
                    .then(universe => {
                        const numberOfTradingDays = universe.length - this.__numberOfCandles;

                        return Array
                            .from({ length: numberOfTradingDays }, (_, k) => k)
                            .reduce((promise, dayNumber) => promise.then(() => {
                                // Only trade on Monday, Wednesday, and Friday
                                let tomorrow = universe[dayNumber + this.__numberOfCandles].get('Day');
                                if (candidate.getCapital() >= candidate.getInitialCapital()
                                    && (tomorrow === 0.1
                                        || tomorrow === 0.3
                                        || tomorrow === 0.5)
                                ) {
                                    console.log('------------------------------------------------');
                                    console.log(`Day: ${dayNumber}/${numberOfTradingDays}`);
                                    console.log('------------------------------------------------');
                                    
                                    // Get 50 candles as input set from universe
                                    let inputSet = universe
                                        .slice(dayNumber, dayNumber + this.__numberOfCandles)
                                        .reduce((acc, map) => {
                                            let valueIterator = map.values();
                                            let value = valueIterator.next().value;
                                            while (value !== undefined) {
                                                acc.push(value);
                                                value = valueIterator.next().value;
                                            }
                                            return acc;
                                        }, []);

                                    // console.log(inputSet);
                
                                    // Execute candidate
                                    let output = model
                                        .predict(tf.tensor2d([inputSet]))
                                        .arraySync()[0];
                
                                    // console.log(`Output: ${JSON.stringify(output, undefined, 4)}`);
                
                                    // Calculate capital to risk based on the output
                                    let currentCapitalToTrade = candidate.getCapital();
                                    let sumOfRisk = 0;
                                    let balanceLeftToRisk = currentCapitalToTrade;
                                    
                                    let capitalToRisk = output.map(percent => {
                                        let proposedToRisk = MathFn.currency(currentCapitalToTrade * percent);
                                        let risk = balanceLeftToRisk >= proposedToRisk
                                            ? proposedToRisk
                                            : MathFn.currency(balanceLeftToRisk);
                                        sumOfRisk += risk;
                                        balanceLeftToRisk = currentCapitalToTrade - sumOfRisk;
                                        
                                        return risk;
                                    });
                
                                    let profit = this
                                        .getListTickersOfInterest()
                                        .reduce((profit, tickerSymbol, tickerSymbolIndex) => {
                                            return profit + candidate.executeTrade({
                                                risk: [capitalToRisk[tickerSymbolIndex * 2], capitalToRisk[tickerSymbolIndex * 2 + 1]],
                                                perTradeComission: this.__costOfTrade,
                                                perTradeReward: this.__reward,
                                                priceCloseToday: universe[dayNumber + this.__numberOfCandles].get(`${tickerSymbol}_ClosePrice`),
                                                priceExpectedMove: universe[dayNumber + this.__numberOfCandles - 1].get(`${tickerSymbol}_StandardDeviation`),
                                                tickerSymbol,
                                            });
                                        }, 0);
                
                                    // Record total profits so far
                                    candidate.setProfit(candidate.getProfit() + profit);
                                    console.log(`Total profit/loss: ${MathFn.currency(profit)} from ${currentCapitalToTrade} capital`);
                
                                    // Update capital
                                    candidate.setCapital(currentCapitalToTrade + profit);
                
                                    // Every month trade withdraw
                                    if (candidate.getTradeDuration() % 12 === 1) { // 12 trading days a month
                                        candidate.executeWithdrawal();
                                    }
                                }
                                candidate.setTradeDuration(candidate.getTradeDuration() + 1);
                            }), Promise.resolve());
                    })
                    .then(() => {
                        console.log('------------------------------------------------');
                        console.log('Candidate Summary');
                        console.log('------------------------------------------------');
                        console.log(candidate.scoreToString())
                    });
            });
    }
}
