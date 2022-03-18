import * as tf from '@tensorflow/tfjs';
import App from './app.js';
import Candidate from './model/Candidate.js';
import CollectionService from './resource/CollectionService.js';
import FileService from './util/FileService.js';
import MathFn from './util/MathFn.js';
import TensorFlowAdaptor from './util/TensorFlowAdaptor.js';
import tfn from '@tensorflow/tfjs-node';

const app = new App();
const collectionService = new CollectionService();
const fileService = new FileService();
const tensorFlow = new TensorFlowAdaptor();

export default class GeneticAlgo {
    __mutationRate = 0.2;
    __totalCandidates = 10;
    __maxGenerationCount = 300;

    /**
     * Crossover genome
     */
    crossoverGenome({
        candidateA,
        candidateB,
    }) {
        return Promise
            .all([
                candidateA.getModel().getWeights(),
                candidateB.getModel().getWeights(),
            ])
            .then(weightsAndBias => {
                let [candidateAWeights, candidateBWeights] = weightsAndBias;

                const totalWeights = candidateAWeights.length;
                const startWeight = MathFn.randomInt(0, totalWeights - 1);
                const numberOfWeights = MathFn.randomInt(0, totalWeights - startWeight);

                const candidateASegment = candidateAWeights.slice(startWeight, startWeight + numberOfWeights);
                const candidateBSegment = candidateBWeights.slice(startWeight, startWeight + numberOfWeights);

                candidateAWeights.splice(startWeight, numberOfWeights, ...candidateBSegment);
                candidateBWeights.splice(startWeight, numberOfWeights, ...candidateASegment);
            });
    }

    /**
     * Genome mutation
     * @param {Candidate} candidate
     * @returns undefined
     */
    mutateGenome(candidate) {
        return Promise
            .all(candidate
                .getModel()
                .getWeights()
                .map(tensor => {
                    return tensor
                        .data()
                        .then(values => {
                            for (let i = 0; i < values.length; i++) {
                                if (MathFn.randomFloat(0, 1) < this.__mutationRate) {
                                    values[i] += MathFn.randomInt(-1, 1) * values[1] * 0.1;
                                }
                            }

                            return tf.tensor(values, tensor.shape);
                        });
                }))
            .then(newWeights => {
                candidate
                    .getModel()
                    .setWeights(newWeights);
                
                return candidate;
            });
    }

    /**
     * Fitness test/score
     * ------------------
     * 1. profit + cash in hand - withdrawal - cost to open - cost to close
     * 2. how long can it trade until it runs out ot cash
     *
     * AI should notice the longer they can trade, the more they can profit,
     * then the more they can withdraw to score higher
     * @returns {Number}
     */
    fitnessTest(candidate) {
        // console.log(`candidate ${candidate.getId()}: ${JSON.stringify({
        //     profit: candidate.getProfit(),
        //     withdrawal: candidate.getWithdrawal(),
        //     tradeDuration: candidate.getTradeDuration(),
        // }, undefined, 4)}`);
        return (candidate.getCapital() + candidate.getProfit() + candidate.getWithdrawal());
    }

    train() {
        let universe;
        let candidates = [];
        let layers;
        let numberOfInputs;

        let bestCandidates;

        return collectionService
            // Load universe
            .readJSONFileAsUniverse('./data/universe/universe.json')
            .then(u => {
                universe = u;
                numberOfInputs = universe[0].size * app.__numberOfCandles;
            })
            // Load best candidates
            .then(() => {
                return Promise.all([0, 1].map(candidateNumber => {
                    return collectionService
                        .readJSONFileAsCandidate(`./data/backup/${candidateNumber}/metadata.json`)
                        .then(candidate => {
                            return tensorFlow
                                .setTrainedFilePath(candidate.getModelLocation())
                                .getTrainedModel()
                                .catch(() => {
                                    candidate.setModelLocation(`./data/backup/${candidateNumber}`);
                                    return tensorFlow
                                        .setTrainedFilePath(candidate.getModelLocation())
                                        .createNewModel({
                                            numberOfInputNodes: numberOfInputs,
                                            numberOfOutputNodes: app.__numberOfOutputs,
                                        });
                                })
                                .then(model => candidate.setModel(model));
                        });
                }));
            })
            .then(candidates => {
                bestCandidates = candidates;
            })
            // Load other candidates
            .then(() => {
                return Promise
                    .all(Array
                        .from({ length: this.__totalCandidates }, (_, k) => k)
                        .map(candidateNumber => {

                            return collectionService
                                .readJSONFileAsCandidate(`./data/candidates/${candidateNumber}/metadata.json`)
                                .then(candidate => {
                                    return tensorFlow
                                        .setTrainedFilePath(candidate.getModelLocation())
                                        .getTrainedModel()
                                        .catch(() => {
                                            candidate.setModelLocation(`./data/candidates/${candidateNumber}`);
                                            return tensorFlow
                                                .setTrainedFilePath(candidate.getModelLocation())
                                                .createNewModel({
                                                    numberOfInputNodes: numberOfInputs,
                                                    numberOfOutputNodes: app.__numberOfOutputs,
                                                });
                                        })
                                        .then(model => {
                                            candidate
                                                .reset()
                                                .setId(candidateNumber)
                                                .setInitialCapital(app.__initialCapital)
                                                .setModel(model);

                                            return candidate;
                                        });
                                });
                        })
                    );
            })
            .then(c => {
                candidates = c;
            })
            // Loop generations
            .then(() => {
                const numberOfTradingDays = universe.length - app.__numberOfCandles;

                // Loop generations
                return Array
                    .from({ length: this.__maxGenerationCount }, (_, k) => k)
                    .reduce((promise, generationNumber) => promise.then(() => {

                        // Loop candidates
                        return Array
                            .from({ length: candidates.length }, (_, k) => k)
                            .reduce((promise, candidateNumber) => promise.then(() => {
                            
                                let candidate = candidates[candidateNumber];
                                candidate
                                    .reset()
                                    .setGeneration(generationNumber);

                                // Loop trading days by running the candidate
                                return Array
                                    .from({ length: numberOfTradingDays }, (_, k) => app.__numberOfCandles + k)
                                    .reduce((promise, dayNumber) => promise.then(() => {
                                        // Only trade on Monday, Wednesday, and Friday
                                        let today = universe[dayNumber].get('Day');
                                        if (candidate.getCapital() > 0 // >= candidate.getInitialCapital()
                                            // && (today === 0.1
                                            //     || today === 0.3
                                            //     || today === 0.5)
                                        ) {
                                            candidate.setTradeDuration(candidate.getTradeDuration() + 1);
                                            console.log('------------------------------------------------');
                                            console.log(`Generation: ${generationNumber}, Candidate: ${candidateNumber}, Day: ${dayNumber}/${universe.length - 1}`);
                                            console.log('------------------------------------------------');
                                            
                                            // Get 50 candles as input set from universe
                                            let inputSet = universe
                                                .slice(dayNumber - app.__numberOfCandles, dayNumber) // 50 candles before today
                                                .reduce((acc, map) => {
                                                    let valueIterator = map.values();
                                                    let value = valueIterator.next().value;
                                                    while (value !== undefined) {
                                                        acc.push(value);
                                                        value = valueIterator.next().value;
                                                    }
                                                    return acc;
                                                }, []);

                                            // Execute candidate
                                            let output = tensorFlow.predict({
                                                model: candidate.getModel(),
                                                input: inputSet,
                                            });

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

                                            let profit = app
                                                .getListTickersOfInterest()
                                                .reduce((profit, tickerSymbol, tickerSymbolIndex) => {
                                                    return profit + candidate.executeTrade({
                                                        risk: [capitalToRisk[tickerSymbolIndex * 2], capitalToRisk[tickerSymbolIndex * 2 + 1]],
                                                        perTradeComission: app.__costOfTrade,
                                                        perTradeReward: app.__reward,
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

                                            console.log(`Score: ${this.fitnessTest(candidate)}`);
                                        }
                                    }), Promise.resolve());
                            }), Promise.resolve())
                            // Fitness test, then sort by best first
                            .then(() => {
                                console.log(`Fitness test`);
                                return Promise.resolve(candidates.sort((candidateA, candidateB) => {
                                    console.log(`Sorting...`);
                                    return this.fitnessTest(candidateB) - this.fitnessTest(candidateA);
                                }));
                            })
                            // Save the best two candidates
                            .then(() => {
                                let sortedBestCandidates = [
                                    bestCandidates[0],
                                    bestCandidates[1],
                                    candidates[0],
                                    candidates[1]
                                ].sort((candidateA, candidateB) => {
                                    return this.fitnessTest(candidateB) - this.fitnessTest(candidateA);
                                });

                                // Move the same fitnessTest result to the back. We will only propogate new solution
                                let index = 0;
                                let numberOfLoops = 1;
                                while (numberOfLoops < sortedBestCandidates.length) {
                                    if (this.fitnessTest(sortedBestCandidates[index]) === this.fitnessTest(sortedBestCandidates[index + 1])) {
                                        let tempCandidate = sortedBestCandidates[index];
                                        sortedBestCandidates.splice(index, 1);
                                        sortedBestCandidates.push(tempCandidate);
                                    } else {
                                        index += 1;
                                    }
                                    numberOfLoops += 1;
                                }

                                // Copy best two candidates
                                return Promise.all([0, 1].map(candidateNumber => {
                                    let newTempCandidate = new Candidate({
                                        id: sortedBestCandidates[candidateNumber].getId(),
                                        tradeDuration: sortedBestCandidates[candidateNumber].getTradeDuration(),
                                        capital: sortedBestCandidates[candidateNumber].getCapital(),
                                        profit: sortedBestCandidates[candidateNumber].getProfit(),
                                        withdrawal: sortedBestCandidates[candidateNumber].getWithdrawal(),
                                        generation: sortedBestCandidates[candidateNumber].getGeneration(),
                                        modelLocation: `./data/backup/${candidateNumber}`,
                                    });
                                    newTempCandidate.setModel(tensorFlow.clone(sortedBestCandidates[candidateNumber].getModel()))
                                    return newTempCandidate
                                }));
                            })
                            .then(b => {
                                bestCandidates = b;
                            })
                            // Crossover gene
                            .then(() => {
                                console.log(`Crossover gene`);
                                let crossoverPromises = [];
                                let savePosition = 0;
                                while (savePosition < this.__totalCandidates) {
                                    // Copy genome first then crossover
                                    candidates[savePosition].setModel(tensorFlow.clone(bestCandidates[0].getModel()));
                                    candidates[savePosition + 1].setModel(tensorFlow.clone(bestCandidates[1].getModel()));
                                    // Crossover
                                    crossoverPromises
                                        .push(this
                                            .crossoverGenome({
                                                candidateA: candidates[savePosition],
                                                candidateB: candidates[savePosition + 1],
                                            })
                                        );
                                    savePosition += 2;
                                }

                                return Promise.all(crossoverPromises);
                            })
                            // Mutate gene
                            .then(() => {
                                return Promise.all(Array
                                    .from({length: this.__totalCandidates}, (_, k) => k)
                                    .map(candidateNumber => {
                                        return this.mutateGenome(candidates[candidateNumber]);
                                    })
                                );
                            })
                            // Have to re assign the id so that we save to the right file
                            .then(() => {
                                return Promise.all(candidates.map((candidate, index) => {
                                    candidate.setId(index);
                                    console.log(`candidate ${candidate.getId()}, score: ${this.fitnessTest(candidate)}`);
                                }));
                            })
                            .then(() => {
                                tensorFlow.memory();
                            });
                    }), Promise.resolve());
            })
            // Save the candidates
            .then(() => {
                console.log(`end of generation`);

                bestCandidates
                    .map((candidate, index) => {
                        candidate
                            .setModelLocation(`./data/backup/${index}`)
                            .getModel()
                            .save(`file://${candidate.getModelLocation()}`);
                        
                            return fileService.writeToJSONFile({
                            jsonfilepath: `./data/backup/${index}/metadata.json`,
                            data: candidate.toString(),
                        })
                });

                candidates
                    .map((candidate, index) => {
                        candidate
                            .setModelLocation(`./data/candidates/${index}`)
                            .getModel()
                            .save(`file://${candidate.getModelLocation()}`);
                            
                        return fileService.writeToJSONFile({
                            jsonfilepath: `./data/candidates/${index}/metadata.json`,
                            data: candidate.toString(),
                        });
                    });
            });

    }

    validate() {
        return tensorFlow
            .setTrainedFilePath(`./data/backup/0`)
            .getTrainedModel()
            .then(model => {
                const candidate = new Candidate({
                    id: 0,
                });
                candidate
                    .reset()
                    .setInitialCapital(app.__initialCapital);

                collectionService
                    .readJSONFileAsUniverse('./data/universe/universe.json')
                    .then(universe => {
                        const numberOfTradingDays = universe.length - app.__numberOfCandles;

                        return Array
                            .from({ length: numberOfTradingDays }, (_, k) => app.__numberOfCandles + k)
                            .reduce((promise, dayNumber) => promise.then(() => {
                                // Only trade on Monday, Wednesday, and Friday
                                let today = universe[dayNumber].get('Day');
                                if (candidate.getCapital() > 0 // >= candidate.getInitialCapital()
                                    // && (today === 0.1
                                    //     || today === 0.3
                                    //     || today === 0.5)
                                ) {
                                    let day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][today * 10 - 1];
                                    candidate.setTradeDuration(candidate.getTradeDuration() + 1);
                                    console.log('------------------------------------------------');
                                    console.log(`Day: ${dayNumber}/${universe.length - 1} ${day}`);
                                    console.log('------------------------------------------------');
                                    
                                    // Get 50 candles as input set from universe
                                    let inputSet = universe
                                        .slice(dayNumber - app.__numberOfCandles, dayNumber) // 50 candles before today
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
                                    let output = tensorFlow.predict({
                                        model,
                                        input: inputSet,
                                    });

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
                                                perTradeComission: app.__costOfTrade,
                                                perTradeReward: app.__reward,
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
                        console.log(candidate.scoreToString());
                        tensorFlow.memory();

                        return candidate;
                    });
            });
    }
}
