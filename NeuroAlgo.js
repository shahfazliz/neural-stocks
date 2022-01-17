import * as tf from '@tensorflow/tfjs';
import App from './app.js';
import Candidate from './model/Candidate.js';
import CollectionService from './resource/CollectionService.js';
import FileService from './util/FileService.js';
import MathFn from './util/MathFn.js';
import tfn from '@tensorflow/tfjs-node';

const app = new App();
const collectionService = new CollectionService();
const fileService = new FileService();

export default class NeuroAlgo {
    __initialCapital = 1000;
    __costOfTrade = 1.74;
    __reward = 0.06; // 6%
    __numberOfCandles = 50;

    __epochs = 50000;
    __hiddenNodes = 15;
    __hiddenLayers = 3;
    __learnRate = 0.001;
    __compileParams = {
        loss: tf.losses.meanSquaredError,
        optimizer: tf.train.sgd(this.__learnRate),
        metrics: ['accuracy'],
    };

    __trainedFilePath = './data/tensorflowModel';

    train() {
        return collectionService
            .readJSONFileAsUniverse('./data/universe/universe.json')
            .then(universe => {
                return new Promise((resolve, reject) => {
                    const inputOutputSet = Array
                        .from({length: universe.length - this.__numberOfCandles}, (_, k) => this.__numberOfCandles + k)
                        .reduce((accumulator, dayNumber) => {
                            const input = universe
                                .slice(dayNumber - this.__numberOfCandles, dayNumber)
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
                            const output = app
                                .getListOfTickers()
                                .reduce((acc, tickerSymbol) => {
                                    const priceCloseToday = universe[dayNumber].get(`${tickerSymbol}_ClosePrice`);
                                    const priceExpectedMove = universe[dayNumber - 1].get(`${tickerSymbol}_StandardDeviation`);
                            
                                    let long = -priceExpectedMove < priceCloseToday ? 1 : 0;
                                    let short = priceExpectedMove > priceCloseToday ? 1 : 0
                                    
                                    acc.push(long);
                                    acc.push(short);
                                    
                                    totalOutput += long + short;

                                    return acc;
                                }, [])
                                .map(eachOutput => MathFn.currency(eachOutput / totalOutput || 0));

                            // console.log(`Output: ${JSON.stringify(output, undefined, 4)}`);

                            accumulator.input.push(input);
                            accumulator.output.push(output);

                            return accumulator;
                        }, {input: [], output: [], validateIn: [], validateOut: []});
                    
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

                    // Train with smaller model to prevent overfitting
                    const deleteCount = Math.floor(inputOutputSet.input.length / 10);
                    const start = MathFn.randomInt(0, inputOutputSet.input.length - deleteCount);
                    
                    inputOutputSet.validateIn = inputOutputSet.input.slice(start, start + deleteCount);
                    inputOutputSet.validateOut = inputOutputSet.output.slice(start, start + deleteCount);

                    inputOutputSet.input.splice(start, deleteCount);
                    inputOutputSet.output.splice(start, deleteCount);

                    // console.log(`InputOutputSet output: ${JSON.stringify(inputOutputSet.output, undefined, 4)}`);

                    resolve(inputOutputSet);
                });
            })
            .then(inputOutputSet => {
                const trainingData = tf.tensor2d(inputOutputSet.input);
                const outputData = tf.tensor2d(inputOutputSet.output);

                return tf
                    .loadLayersModel(tfn.io.fileSystem(`${this.__trainedFilePath}/model.json`))
                    .then(model => {
                        console.log('Model available');
                        model.compile(this.__compileParams);
                        return model;
                    })
                    .catch(() => {
                        console.log('Model NOT available');
                        const model = tf.sequential();
                        // Input Layer
                        model.add(tf.layers.dense({
                            inputShape: [inputOutputSet.input[0].length],
                            activation: 'relu6',
                            useBias: true,
                            units: this.__hiddenNodes, // Input nodes
                        }));
                        
                        // Hidden layers
                        for (let i = 0; i < this.__hiddenLayers; i++) {
                            model.add(tf.layers.dense({
                                inputShape: this.__hiddenNodes,
                                activation: 'relu6',
                                useBias: true,
                                units: this.__hiddenNodes, // Hidden nodes
                            }));
                            // model.add(tf.layers.dropout({ rate: 0.0001 }));
                        }

                        // Output layer
                        model.add(tf.layers.dense({
                            inputShape: this.__hiddenNodes,
                            activation: 'sigmoid',
                            useBias: true,
                            units: 6, // Output nodes
                        }));
        
                        model.compile(this.__compileParams);

                        return model;
                    })
                    .then(model => {
                        return model
                            .fit(
                                trainingData, 
                                outputData,
                                {
                                    epochs: this.__epochs,
                                    validationData: [
                                        tf.tensor2d(inputOutputSet.validateIn),
                                        tf.tensor2d(inputOutputSet.validateOut),
                                    ],
                                    callbacks: tf.callbacks.earlyStopping({
                                        monitor: 'loss',
                                        mode: 'auto',
                                    }),
                                },
                            )
                            .then(() => {
                                model.save(`file://${this.__trainedFilePath}`);
                            });
                    });
            });
    }

    test() {
        return tf
            .loadLayersModel(tfn.io.fileSystem(`${this.__trainedFilePath}/model.json`))
            .then(model => {
                model.compile(this.__compileParams);
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
                            .from({ length: numberOfTradingDays }, (_, k) => this.__numberOfCandles + k)
                            .reduce((promise, dayNumber) => promise.then(() => {
                                // Only trade on Monday, Wednesday, and Friday
                                let today = universe[dayNumber].get('Day');
                                if (candidate.getCapital() > 0 // >= candidate.getInitialCapital()
                                    && (today === 0.1
                                        || today === 0.3
                                        || today === 0.5)
                                ) {
                                    candidate.setTradeDuration(candidate.getTradeDuration() + 1);
                                    console.log('------------------------------------------------');
                                    console.log(`Day: ${dayNumber}/${universe.length - 1}`);
                                    console.log('------------------------------------------------');
                                    
                                    // Get 50 candles as input set from universe
                                    let inputSet = universe
                                        .slice(dayNumber - this.__numberOfCandles, dayNumber) // 50 candles bofore today
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

                                    // console.log(`Capital To Risk: ${JSON.stringify(capitalToRisk, undefined, 4)}`);
                
                                    let profit = app
                                        .getListTickersOfInterest()
                                        .reduce((profit, tickerSymbol, tickerSymbolIndex) => {
                                            return profit + candidate.executeTrade({
                                                risk: [capitalToRisk[tickerSymbolIndex * 2], capitalToRisk[tickerSymbolIndex * 2 + 1]],
                                                perTradeComission: this.__costOfTrade,
                                                perTradeReward: this.__reward,
                                                priceCloseToday: universe[dayNumber].get(`${tickerSymbol}_ClosePrice`),
                                                priceExpectedMove: universe[dayNumber - 1].get(`${tickerSymbol}_StandardDeviation`),
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
                            }), Promise.resolve());
                    })
                    .then(() => {
                        console.log('------------------------------------------------');
                        console.log('Candidate Summary');
                        console.log('------------------------------------------------');
                        console.log(candidate.scoreToString())

                        return candidate;
                    });
            });
    }

    extractGenome() {
        return tf
            .loadLayersModel(tfn.io.fileSystem(`${this.__trainedFilePath}/model.json`))
            .then(model => {
                console.log('Model available');
                model.compile(this.__compileParams);
                return model;
            })
            .then(model => {
                const totalLayers = model.layers.length;
                return Promise.all(Array
                    .from({length: totalLayers}, (_, k) => k)
                    .map(layerNumber => {
                        return Promise
                            .all([
                                model.layers[layerNumber].getWeights()[0].data(), // Weights
                                model.layers[layerNumber].getWeights()[1].data(), // Bias
                            ])
                            .then(data => {
                                let [weights, bias] = data;
                                const result = [];
                                bias.forEach((b, index) => {
                                    result.push([...weights.slice(index, index + weights.length / bias.length), b]);
                                })
                                return result;
                            });
                    }));
            })
            .then(data => {
                const candidate = new Candidate({
                    id: 10,
                    genome: data.flat(1),
                });

                return fileService.writeToJSONFile({
                    jsonfilepath: `./data/candidates/${candidate.getId()}.json`,
                    data: candidate.toString(),
                });
            });
    }
}
