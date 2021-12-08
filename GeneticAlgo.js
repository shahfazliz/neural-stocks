import Candidate from './model/Candidate.js';
import CollectionService from './resource/CollectionService.js';
import FileService from './util/FileService.js';
import fs from 'fs/promises';

const collectionService = new CollectionService();
const fileService = new FileService();

export default class GeneticAlgo {
    __totalCandidates = 18; // pick candidates at 0, 6, 12
    __bestCandidatesCount = 3; // 3->6+6=12, 5->20+20=40, 7->42+42+7=84, 10->90+90+10=180
    __maxGenerationCount = 300;
    __costOfTrade = 1.74;
    __reward = 0.06; // 6%

    __numberOfOutputs = 6;
    __layers = [10, 10, 10, 10, 10];

    __numberOfCandles = 50;
    __numberOfCandlesAYear = 252;
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

    precision(value) {
        return parseFloat(value.toFixed(5));
    }

    currency(value) {
        return parseFloat(value.toFixed(2));
    }

    /**
     * Node structure
     * --------------
     *
     *   x0 - 2 - 4
     *      X   X   > 6
     *   x1 - 3 - 5
     *
     * const nodes = [
     *      x0, x1, // inputs
     *      [w02, w12, c2], // hidden node 2
     *      [w03, w13, c3], // hidden node 3
     *      [w24, w34, c4], // hidden node 4
     *      [w25, w35, c5], // hidden node 5
     *      [w46, w56, c6], // output node 6
     * ];
     *
     *
     * Some other rules?
     * -----------------
     * 1. number of nodes per layer === number of inputs
     * 2. number of hidden layers = Math.floor((length of nodes - number of inputs) / number of inputs)
     * 3. number of output nodes = (length of nodes - number of inputs) - (number of hidden layers * number of inputs)
     * 4. hidden nodes use swish activation function (x) => x*sigmoid(x)
     * 5. output nodes use sigmoid activation function (x) => 1/(1+Math.exp(-x))
     *
     * Sample input
     * ------------
     * const input = [13,14];
     * const nodes = [
     *  [1,1,1], // node 1
     *  [2,2,2], // node 2
     *  [3,3,3], // node 3
     *  [4,4,4], // node 4
     *  [5,5,5], // output node
     * ];
     */
    runCandidate({
        id,
        input,
        genome,
        layers,
    }) {
        console.log(`Run candidate ${id} with input length of ${input.length}`);

        const model = [...input, ...genome];

        let outputNode = undefined;
        for (let i = input.length; i < model.length; i++) {
            // Calculate hidden layer number
            const layerNumber = this.isInLayer(layers, i - input.length);

            // Sum all multiplication with weights
            let result = 0;
            for (let j = 0; j < model[i].length - 1; j++) { // don't use the last number, that is for bias
                // console.log(`model[${layerNumber} - 1 + ${j}]: ${model[layerNumber - 1 + j]}`)
                result += model[i][j] * model[layerNumber - 1 + j]; // weight * input
            }

            // Add bias
            result += model[i][model[i].length - 1];

            // Determine if current node is in output layer
            const isOutputLayer = layerNumber === layers.length;

            // Apply activation function and save result
            model[i] = isOutputLayer
                ? this.precision(this.sigmoid(result))
                : this.precision(result); // this.swish(result);

            // Save the output node number
            if (isOutputLayer && outputNode === undefined) {
                outputNode = i;
            }
        }

        // Only return the output nodes, remove the rest to save memory space
        model.splice(0, outputNode);
        return model;
    }

    swish(val) {
        return val * this.sigmoid(val);
    }

    sigmoid(val) {
        return 1 / (1 + Math.exp(-val));
    }

    /**
     * Find the target resides in which layer. Not zero index
     */
    isInLayer(layers, target) {
        for (let i = 0; i < layers.length; i++) {
            let sum = layers
                .slice(0, i + 1)
                .reduce((acc, val) => acc + val);

            if (target < sum) {
                return i + 1; // Not zero index
            }
        }
    }

    /**
     * Initial genome
     */
    randomGenome({
        numberOfInputs = 1,
        layers = [3, 3, 3],
    }) {
        console.log(`Generating random genome with ${layers[0]} input nodes, ${layers[layers.length - 1]} output nodes, and ${layers.length - 2} hidden layers`);

        let weights = [];
        layers.forEach((numberOfNode, index) => {
            let numberOfWeightsPerNode = index === 0
                ? numberOfInputs
                : layers[index - 1];

            Array.from(
                { length: numberOfNode },
                () => Array.from(
                    { length: numberOfWeightsPerNode + 1 }, // +1 for bias
                    () => this.randomWeight()
                )
            ).forEach(val => weights.push(val));
        });

        // console.log(weights);
        return weights;
    }

    randomWeight() {
        return this.precision(Math.random() * 0.02 - 0.01);
    }

    /**
     * Crossover genome
     */
    crossoverGenome({
        candidateA,
        candidateB,
    }) {
        return new Promise((resolve, reject) => {
            // Direct access to the private attibute (genome) to save memory space
            let minimumGenomeLength = candidateA.__genome.length <= candidateB.__genome.length
                ? candidateA.__genome.length
                : candidateB.__genome.length;

            let startSplice = Math.floor(Math.random() * minimumGenomeLength);
            let numberOfGenesToCross = Math.ceil(Math.random() * (minimumGenomeLength - startSplice));
            console.log(`startSplice: ${startSplice}`);
            console.log(`numberOfGenesToCross: ${numberOfGenesToCross}`);

            let candidateAGenome = candidateA
                .__genome
                .slice(startSplice, startSplice + numberOfGenesToCross);
            let candidateBGenome = candidateB
                .__genome
                .slice(startSplice, startSplice + numberOfGenesToCross);

            candidateA.__genome.splice(startSplice, numberOfGenesToCross, ...candidateBGenome);
            candidateB.__genome.splice(startSplice, numberOfGenesToCross, ...candidateAGenome);

            resolve([candidateA, candidateB]);
        });
    }


    /**
     * Genome mutation
     * @param {Candidate} candidate
     * @returns undefined
     */
    mutateGenome(candidate) {
        // Direct access to the private attibute (genome) to save memory space
        let nodePos = Math.floor(Math.random() * candidate.__genome.length);
        let startSpliceWeight = Math.floor(Math.random() * candidate.__genome[nodePos].length);
        candidate
            .__genome[nodePos]
            .splice(startSpliceWeight, 1, this.randomWeight());
        return candidate;
    }

    /**
     *
     * Inputs
     * ------
     * 1. 50 candles (open, close, high, low, volume profile, 1 standard deviation until yesterday)
     * 2. 40 tickers
     * 3. x cash in hand
     * 4. cost of trade
     * 5. withdrawal
     *
     *
     * Output nodes
     * ------------
     * 1. spx long with how much risk
     * 2. spx short with how much risk
     * 3. ndx long with how much risk
     * 4. ndx short with how much risk
     * 5. rut long with how much risk
     * 6. rut short with how much risk
     *
     *
     * Option pricing rules?
     * ---------------------
     * 1. Selling put or calls at 1 td deviation, max profit is 6~7% of risk
     */

    createTickerWorld({
        candlestickCollection,
        numberOfCandles = this.__numberOfCandles,
        tickerSymbol = 'N/A',
    }) {
        return new Promise((resolve, reject) => {
            console.log(`Create world for ${tickerSymbol}`);
            // Test the minimum amount of required candles
            const totalCandlestick = candlestickCollection.length();
            if (totalCandlestick < numberOfCandles + this.__numberOfCandlesAYear) {
                return reject(`number of candle is ${totalCandlestick}, it is less than required candle of ${numberOfCandles}`);
            }

            return resolve(candlestickCollection
                .map((candlestick, index) => {
                    if (index > this.__numberOfCandlesAYear) {
                        // const replaceDateWithCount = (index - this.__numberOfCandlesAYear) % numberOfCandles;
                        const map = new Map();

                        // For debugging, see the dates
                        // map.set(`${tickerSymbol}_Timestamp_${replaceDateWithCount}`, candlestick.getTimestamp());
                        // map.set(`${tickerSymbol}_Day_${replaceDateWithCount}`, candlestick.getDay());
                        // map.set(`${tickerSymbol}_Month_${replaceDateWithCount}`, candlestick.getMonth());
                        map.set(`Day`, candlestick.getDay());
                        map.set(`Month`, candlestick.getMonth());
                        map.set(`${tickerSymbol}_OpenPrice`, this.precision(candlestick.getOpenDiff()));
                        map.set(`${tickerSymbol}_ClosePrice`, this.precision(candlestick.getCloseDiff()));
                        map.set(`${tickerSymbol}_Volume`, this.precision(candlestick.getVolumeDiff()));
                        map.set(`${tickerSymbol}_HighPrice`, this.precision(candlestick.getHighDiff()));
                        map.set(`${tickerSymbol}_LowPrice`, this.precision(candlestick.getLowDiff()));
                        map.set(`${tickerSymbol}_VolumeProfile`, this.precision(candlestick.getVolumeProfile()));
                        map.set(`${tickerSymbol}_StandardDeviation`, candlestick.getStandardDeviation());

                        return map;
                    }
                })
                .filter(val => val !== undefined)
            );
        });
    }

    createUniverse() {
        return Promise
            .all(this
                .__listOfTickers
                .map(tickerSymbol => collectionService
                    .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
                    .then(candlestickCollection => {
                        // console.log(candlestickCollection);
                        return this.createTickerWorld({
                            candlestickCollection,
                            tickerSymbol,
                        });
                    })
                )
            )
            // Combine multiple worlds
            .then(multipleWorlds => {
                console.log(`Combine worlds to a universe`);
                const result = [];
                const totalMapsPerWorld = multipleWorlds[0].length;

                // Check if all worlds have same amount of entries
                for (let i = 0; i < multipleWorlds.length; i++) {
                    if (multipleWorlds[i].length !== totalMapsPerWorld) {
                        return Promise.reject(`Worlds does not have the same amount of entries ${totalMapsPerWorld} vs. ${multipleWorlds[i].length}`);
                    }
                }

                for (let originalMapIndex = 0; originalMapIndex < totalMapsPerWorld; originalMapIndex++) {
                    let map = new Map();

                    for (let tickerIndex = 0; tickerIndex < multipleWorlds.length; tickerIndex++) {
                        let entry = multipleWorlds[tickerIndex][originalMapIndex].entries();
                        let value = entry.next().value;

                        // Copy to new map
                        while (value !== undefined) {
                            map.set(...value);
                            value = entry.next().value;
                        }

                        // Delete the old map to save memory space
                        multipleWorlds[tickerIndex][originalMapIndex].clear();
                    }
                    result.push(map);
                }

                return result;
            })
            .catch(error => console.log(`Error: ${error}`));
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
        return (candidate.getProfit() + candidate.getWithdrawal()) * candidate.getTradeDuration();
    }

    /**
     * Read from json file as Universe
     */
    readJSONFileAsUniverse(jsonfilepath) {
        return fs
            .readFile(jsonfilepath)
            .then(rawJson => {
                console.log(`Reading from ${jsonfilepath} to CandlestickCollection`);
                // console.log(JSON.parse(rawJson));
                return JSON
                    .parse(rawJson)
                    .map(world => new Map(Object.entries(world)));
            });
    }

    /**
     * Read json file as candidate
     * @returns {Promise}
     */
    readJSONFileAsCandidate(jsonfilepath) {
        return fs
            .readFile(jsonfilepath)
            .then(rawJson => {
                console.log(`Reading from ${jsonfilepath}`);
                // console.log(JSON.parse(rawJson));
                return new Candidate(JSON.parse(rawJson));
            })
            // If file does not exist, create one
            .catch(() => fileService
                .writeToJSONFile({
                    jsonfilepath,
                })
                .then(() => new Candidate({}))
            );
    }

    factorial(number) {
        return (number === 1 || number === 0) 
            ? 1
            : number * this.factorial(number - 1);
    }

    run() {
        let universe;
        let candidates = [];
        let layers;
        let numberOfInputs;
        let tempCandidate;

        this
            // Load universe
            .readJSONFileAsUniverse('./data/universe/universe.json')
            .then(u => universe = u)
            // Load candidates
            .then(() => Promise
                .all(Array
                    .from({ length: this.__totalCandidates }, (_, k) => k)
                    .map(candidateNumber => {

                        numberOfInputs = (universe[0].size * this.__numberOfCandles) + 1; // 1 more is the capital

                        return this
                            .readJSONFileAsCandidate(`./data/candidates/${candidateNumber}.json`)
                            .then(candidate => {
                                candidate.reset();

                                layers = [...this.__layers, this.__numberOfOutputs];
                                // If candidate is empty, generate one
                                if (candidate.isGenomeEmpty()) {
                                    candidate
                                        .setId(candidateNumber)
                                        .setGenome(this.randomGenome({
                                            numberOfInputs,
                                            layers,
                                        }));
                                }

                                candidates[candidateNumber] = candidate;
                            });
                    })
                )
            )
            // Loop generations
            .then(() => Array
                .from({ length: this.__maxGenerationCount }, (_, k) => k) // 100 generations
                .reduce((promise, generationNumber) => promise.then(() => {
                    
                    return Array
                        .from({ length: candidates.length }, (_, k) => k)
                        .reduce((promise, candidateNumber) => promise.then(() => {
                            
                            let candidate = candidates[candidateNumber];
                            candidate
                                .reset()
                                .setGeneration(generationNumber);

                            // Run the candidates
                            return Array
                                .from({ length: universe.length - this.__numberOfCandles }, (_, k) => k)
                                .reduce((promise, dayNumber) => promise.then(() => {
                                    console.log('------------------------------------------------');
                                    console.log(`Generation: ${generationNumber}, Candidate: ${candidateNumber}, Day: ${dayNumber}`);
                                    console.log('------------------------------------------------');
                                    
                                    // Only trade on Monday, Wednesday, and Friday
                                    let tomorrow = universe[dayNumber].get('Day');
                                    if (candidate.getCapital() > 0
                                        && (tomorrow === 1
                                            || tomorrow === 3
                                            || tomorrow === 5)
                                    ) {
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

                                        // Add capital as part of decision making
                                        inputSet.unshift(candidate.getCapital());

                                        // Execute candidate
                                        let output = this.runCandidate({
                                            id: candidate.getId(),
                                            genome: candidate.getGenome(),
                                            input: inputSet,
                                            layers,
                                        });
                                        
                                        // let sumOfOutputs = output.reduce((acc, val) => acc + val) - output[output.length - 1];
                                        console.log(`Output: ${JSON.stringify(output, undefined, 4)}`);
                                        
                                        let originalCapital = candidate.getCapital();
                                        let profit = 0;

                                        ['SPY', 'QQQ', 'IWM']
                                            .forEach((tickerSymbol, index) => {
                                                let expectedStandardDeviation = universe[dayNumber + this.__numberOfCandles - 1].get(`${tickerSymbol}_StandardDeviation`);
                                                let closePriceToday = universe[dayNumber + this.__numberOfCandles].get(`${tickerSymbol}_ClosePrice`);

                                                // Long
                                                let availableCapital = candidate.getCapital();
                                                let capitalToUse = availableCapital * output[index * 2];
                                                let costOfTradeLong = capitalToUse > 0 
                                                    ? this.__costOfTrade 
                                                    : 0;
                                                let rewardLong = capitalToUse * this.__reward - costOfTradeLong;
                                                let long = -expectedStandardDeviation < closePriceToday
                                                    ? this.currency(rewardLong)
                                                    : this.currency(rewardLong - capitalToUse);    
                                                candidate.setCapital(availableCapital - capitalToUse);
                                                console.log(`  profit long ${tickerSymbol}: ${long}`);
                                                profit += long;
                                                
                                                // Short
                                                availableCapital = candidate.getCapital();
                                                capitalToUse = availableCapital * output[index * 2 + 1];
                                                let costOfTradeShort = capitalToUse > 0 
                                                    ? this.__costOfTrade 
                                                    : 0;
                                                let rewardShort = capitalToUse * this.__reward - costOfTradeShort;
                                                let short = expectedStandardDeviation > closePriceToday
                                                    ? this.currency(rewardShort)
                                                    : this.currency(rewardShort - capitalToUse);
                                                candidate.setCapital(availableCapital - capitalToUse);
                                                console.log(`  profit short ${tickerSymbol}: ${short}`);
                                                profit += short;                            
                                            });

                                        // Record total profits so far
                                        candidate.setProfit(candidate.getProfit() + profit);
                                        console.log(`Total profit/loss: ${profit} from ${originalCapital} capital`);

                                        // Update capital
                                        candidate.setCapital(originalCapital + profit);

                                        // Every month trade withdraw
                                        if (universe[dayNumber + this.__numberOfCandles].get('Month') !== universe[dayNumber + this.__numberOfCandles - 1].get('Month')) {
                                            let withdrawal = this.currency(candidate.getCapital() - 1000);

                                            if (withdrawal > 0) {
                                                console.log(`Withdrawal: ${withdrawal}`);
                                                candidate.setCapital(candidate.getCapital() - withdrawal);
                                                candidate.setWithdrawal(candidate.getWithdrawal() + withdrawal);
                                            }
                                            else {
                                                console.log(`Withdrawal: 0`);
                                            }
                                        }

                                        candidate.setTradeDuration(dayNumber);
                                        console.log(`Score: ${this.fitnessTest(candidate)}`);
                                    }
                                }), Promise.resolve());
                        }), Promise.resolve())
                        // Fitness test, then sort by best first
                        .then(() => {
                            console.log(`Fitness test`);
                            return Promise.resolve(candidates.sort((candidateA, candidateB) => {
                                console.log(`Sorting...`);
                                return this.fitnessTest(candidateB) - this.fitnessTest(candidateA)
                            }));
                        })
                        // Save the best into backup
                        .then(() => {
                            return new Promise((resolve, reject) => {
                                tempCandidate = new Candidate({
                                    id: 0,
                                    tradeDuration: candidates[0].getTradeDuration(),
                                    capital: candidates[0].getCapital(),
                                    profit: candidates[0].getProfit(),
                                    withdrawal: candidates[0].getWithdrawal(),
                                    generation: candidates[0].getGeneration(),
                                    genome: candidates[0].getGenome(),
                                });
                                resolve(tempCandidate);
                            });
                        })
                        // Divide into 3 (this.__bestCandidatesCount) groups, then get the best of each into top 3
                        .then(() => {
                            return new Promise((resolve, reject) => {
                                let next = (this.__totalCandidates / this.__bestCandidatesCount);
                                let newPosition = 1;
                                for (let i = next; i < this.__totalCandidates; i += next) {
                                    let temp = candidates[newPosition];
                                    candidates[newPosition] = candidates[i];
                                    candidates[i] = temp;
                                    newPosition += 1;
                                }
                                resolve(candidates);
                            });
                        }) 
                        // Have to re assign the id so that we save to the right file
                        .then(() => {
                            return Promise.all(candidates.map((candidate, index) => {
                                candidate.setId(index);
                                console.log(`candidate ${candidate.getId()}, score: ${this.fitnessTest(candidate)}`);
                            }));
                        })
                        // Crossover gene
                        .then(() => {
                            console.log(`Crossover gene`);
                            let crossoverPromises = [];
                            let leftPos = 0;
                            let savePosition = this.__bestCandidatesCount;
                            while (leftPos < this.__bestCandidatesCount) {
                                let rightPos = 0;
                                while (rightPos < this.__bestCandidatesCount) {
                                    rightPos = leftPos === rightPos
                                        ? rightPos + 1
                                        : rightPos;

                                    if (rightPos >= this.__bestCandidatesCount) {
                                        break;
                                    }

                                    // Copy genome first then crossover
                                    candidates[savePosition].setGenome(candidates[leftPos].getGenome());
                                    candidates[savePosition + 1].setGenome(candidates[rightPos].getGenome());
                                    // Crossover
                                    crossoverPromises
                                        .push(this
                                            .crossoverGenome({
                                                candidateA: candidates[savePosition],
                                                candidateB: candidates[savePosition + 1],
                                            })
                                        );
                                    rightPos += 1;
                                    savePosition += 2;
                                }
                                leftPos += 1;
                            }

                            return Promise
                                .all(crossoverPromises)
                                // Remove the parents
                                .then(() => {
                                    return Array
                                        .from({length: this.__bestCandidatesCount}, (_, k) => k)
                                        .reduce((promise, index) => promise.then(() => {
                                            candidates.push(candidates.shift());
                                        }), Promise.resolve());
                                });
                        })
                        // Re populate new genes
                        .then(() => {
                            const genomeCrossoverCount = 2 * (this.factorial(this.__bestCandidatesCount) / this.factorial(this.__bestCandidatesCount - 2));
                            return Array
                                .from({length: this.__totalCandidates - genomeCrossoverCount}, (_, k) => genomeCrossoverCount + k)
                                .reduce((promise, index) => promise.then(() => {
                                    candidates[index].setGenome(this.randomGenome({
                                        numberOfInputs,
                                        layers,
                                    }));
                                }), Promise.resolve())
                        })
                        // Mutate gene
                        .then(() => {
                            console.log(`mutate gene`);
                            const genomeCrossoverCount = 2 * (this.factorial(this.__bestCandidatesCount) / this.factorial(this.__bestCandidatesCount - 2));
                            let luckyCandidateNumber = Math.floor(Math.random() * genomeCrossoverCount - 1);
                            return Array
                                .from({length: this.__totalCandidates}, (_, k) => k)
                                .reduce((promise, index) => promise.then(() => {
                                    if (candidates[index].getId() === luckyCandidateNumber) {
                                        this.mutateGenome(candidates[luckyCandidateNumber]);
                                    }
                                }), Promise.resolve());
                        });
                }), Promise.resolve())
            )
            // Save the candidates
            .then(() => {
                console.log(`end of generation`);
                fileService.writeToJSONFile({
                    jsonfilepath: './data/backup/0.json',
                    data: tempCandidate.toString(),
                });
                return candidates
                    .forEach(candidate => fileService.writeToJSONFile({
                        jsonfilepath: `./data/candidates/${candidate.getId()}.json`,
                        data: candidate.toString(),
                    }));
            });

    }
}

const algo = new GeneticAlgo();
algo.run();
// algo
//     .createUniverse()
//     .then(universe => console.log(universe))
// algo
//     .readJSONFileAsUniverse('./data/universe/universe.json')
//     .then(universe => console.log(universe[0]));