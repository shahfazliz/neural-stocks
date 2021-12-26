import Candidate from './model/Candidate.js';
import CollectionService from './resource/CollectionService.js';
import FileService from './util/FileService.js';
import fs from 'fs/promises';
import MathFn from './util/MathFn.js';

const collectionService = new CollectionService();
const fileService = new FileService();

export default class GeneticAlgo {
    __totalCandidates = 12;
    __bestCandidatesCount = 3; // 2->1, 3->3, 4->6, 5->10 Combinations without repetition order not important
    __totalChildren = (this.factorial(this.__bestCandidatesCount) / (this.factorial(2) * this.factorial(this.__bestCandidatesCount - 2)));
    __maxGenerationCount = 100;
    __costOfTrade = 1.74;
    __reward = 0.06; // 6%

    __numberOfOutputs = 6;
    __layers = [200];

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

    __listTickersOfInterest = ['SPY', 'QQQ', 'IWM']; // order is important

    getListTickersOfInterest() {
        return this.__listTickersOfInterest;
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
            for (let j = 0; j < model[i].length; j++) {
                // console.log(`model[${layerNumber} - 1 + ${j}]: ${model[layerNumber - 1 + j]}`)
                result += model[i][j] * model[layerNumber - 1 + j]; // weight * input
            }

            // Determine if current node is in output layer
            const isOutputLayer = layerNumber === layers.length;

            // Apply activation function and save result
            model[i] = isOutputLayer
                ? this.sigmoid(result)
                : result; // this.swish(result);

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
        layers = [3, 3, 3],
        numberOfInputs = 1,
        seed,
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
                    { length: numberOfWeightsPerNode },
                    () => this.randomWeight()
                )
            ).forEach(val => weights.push(val));
        });

        if (seed && seed.length > 0) {
            console.log('with seed');
            for (let index = 0; index < weights.length; index += 2) {
                weights[index] = seed[index];
            }
        }

        // console.log(weights);
        return weights;
    }

    randomWeight() {
        return MathFn.precision(MathFn.randomFloat(-1, 1));
    }

    /**
     * Crossover genome
     */
    crossoverGenome({
        candidateA,
        candidateB,
    }) {
        return new Promise((resolve, reject) => {
            for (let index = 0; index < candidateA.__genome.length; index++) {
                // Direct access to the private attibute (genome) to save memory space
                let minimumGenomeLength = candidateA.__genome[index].length;

                let startSplice = MathFn.randomInt(0, minimumGenomeLength - 1);
                let numberOfGenesToCross = MathFn.randomInt(0, minimumGenomeLength - startSplice - 1);

                let candidateBGenome = candidateB
                    .__genome[index]
                    .slice(startSplice, startSplice + numberOfGenesToCross);

                candidateA
                    .__genome[index]
                    .splice(startSplice, numberOfGenesToCross, ...candidateBGenome);
            }

            resolve();
        });
    }


    /**
     * Genome mutation
     * @param {Candidate} candidate
     * @returns undefined
     */
    mutateGenome(candidate) {
        // Direct access to the private attibute (genome) to save memory space
        let nodePos = MathFn.randomInt(0, candidate.__genome.length - 1);
        let startSpliceWeight = MathFn.randomInt(0, candidate.__genome[nodePos].length - 1);
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
        return candidate.getProfit() + candidate.getWithdrawal() + candidate.getTradeDuration();
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
        let bestCandidate;

        collectionService
            // Load universe
            .readJSONFileAsUniverse('./data/universe/universe.json')
            .then(u => universe = u)
            // Load best candidate
            .then(() => {
                return this
                    .readJSONFileAsCandidate(`./data/backup/0.json`)
                    .then(candidate => bestCandidate = candidate);
            })
            // Load candidates
            .then(() => {
                let copyGenomeBestCandidate = bestCandidate.getCopyGenome();
                return Promise
                    .all(Array
                        .from({ length: this.__totalCandidates }, (_, k) => k)
                        .map(candidateNumber => {

                            numberOfInputs = (universe[0].size * this.__numberOfCandles) + 1; // 1 more is the capital

                            return this
                                .readJSONFileAsCandidate(`./data/candidates/${candidateNumber}.json`)
                                .then(candidate => {
                                    candidate
                                        .reset()
                                        .setInitialCapital(this.__initialCapital);

                                    layers = [...this.__layers, this.__numberOfOutputs];
                                    // If candidate is empty, generate one
                                    if (candidate.isGenomeEmpty()) {
                                        candidate
                                            .setId(candidateNumber)
                                            .setInitialCapital(this.__initialCapital)
                                            .setGenome(this.randomGenome({
                                                layers,
                                                numberOfInputs,
                                                seed: copyGenomeBestCandidate,
                                            }));
                                    }

                                    candidates[candidateNumber] = candidate;
                                });
                        })
                    );
            })
            // Loop generations
            .then(() => {
                const numberOfTradingDays = universe.length - this.__numberOfCandles;

                // Loop generations
                return Array
                    .from({ length: this.__maxGenerationCount }, (_, k) => k) // 100 generations
                    .reduce((promise, generationNumber) => promise.then(() => {

                        const suitableBestCandidateCount = [2, 3, 4];
                        this.__bestCandidatesCount = suitableBestCandidateCount[(suitableBestCandidateCount.indexOf(this.__bestCandidatesCount) + 1) % suitableBestCandidateCount.length];
                    
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
                                    .from({ length: numberOfTradingDays }, (_, k) => k)
                                    .reduce((promise, dayNumber) => promise.then(() => {
                                        // Only trade on Monday, Wednesday, and Friday
                                        let tomorrow = universe[dayNumber].get('Day');
                                        if (candidate.getCapital() >= candidate.getInitialCapital()
                                            && (tomorrow === 1
                                                || tomorrow === 3
                                                || tomorrow === 5)
                                        ) {
                                            console.log('------------------------------------------------');
                                            console.log(`Generation: ${generationNumber}, Candidate: ${candidateNumber}, Day: ${dayNumber}/${numberOfTradingDays}`);
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

                                            // Add capital as part of decision making
                                            inputSet.unshift(candidate.getCapital());

                                            // Execute candidate
                                            let output = this.runCandidate({
                                                id: candidate.getId(),
                                                genome: candidate.getGenome(),
                                                input: inputSet,
                                                layers,
                                            });

                                            let sumOfOutputs = output.reduce((acc, val) => acc + val);
                                            console.log(`Output: ${JSON.stringify(output.map(val => val / sumOfOutputs || 0), undefined, 4)}`);

                                            let originalCapital = candidate.getCapital();

                                            let profit = this
                                                .getListTickersOfInterest()
                                                .reduce((profit, tickerSymbol, tickerSymbolIndex) => {
                                                    return profit + candidate.executeTrade({
                                                        model: output,
                                                        modelIndex: tickerSymbolIndex,
                                                        perTradeComission: this.__costOfTrade,
                                                        perTradeReward: this.__reward,
                                                        priceCloseToday: universe[dayNumber + this.__numberOfCandles].get(`${tickerSymbol}_ClosePrice`),
                                                        priceExpectedMove: universe[dayNumber + this.__numberOfCandles - 1].get(`${tickerSymbol}_StandardDeviation`),
                                                        tickerSymbol,
                                                    });
                                                }, 0);

                                            // Record total profits so far
                                            candidate.setProfit(candidate.getProfit() + profit);
                                            console.log(`Total profit/loss: ${MathFn.currency(profit)} from ${originalCapital} capital`);

                                            // Update capital
                                            candidate.setCapital(originalCapital + profit);

                                            // Every month trade withdraw
                                            if (candidate.getTradeDuration() % 12 === 1) { // 12 trading days a month
                                                let withdrawal = MathFn.currency(candidate.getCapital() - candidate.getInitialCapital());

                                                if (withdrawal > 0) {
                                                    console.log(`Withdrawal: ${withdrawal}`);
                                                    candidate.setCapital(candidate.getCapital() - withdrawal);
                                                    candidate.setWithdrawal(candidate.getWithdrawal() + withdrawal);
                                                }
                                                else {
                                                    console.log(`Withdrawal: 0`);
                                                }
                                            }

                                            candidate.setTradeDuration(candidate.getTradeDuration() + 1);
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
                            // Move the same fitnessTest result to the back. We will only propogate new solution
                            .then(() => {
                                return new Promise((resolve, reject) => {
                                    let index = 0;
                                    while (index < this.__bestCandidatesCount + this.__totalChildren - 1) {
                                        if (this.fitnessTest(candidates[index]) === this.fitnessTest(candidates[index + 1])) {
                                            let tempCandidate = candidates[index];
                                            candidates.splice(index, 1);
                                            candidates.push(tempCandidate);
                                        }
                                        else {
                                            index += 1;
                                        }
                                    }
                                    resolve(candidates);
                                });
                            })
                            // Save the best into backup
                            .then(() => {
                                return new Promise((resolve, reject) => {
                                    let newTempCandidate = new Candidate({
                                        id: candidates[0].getId(),
                                        tradeDuration: candidates[0].getTradeDuration(),
                                        capital: candidates[0].getCapital(),
                                        profit: candidates[0].getProfit(),
                                        withdrawal: candidates[0].getWithdrawal(),
                                        generation: candidates[0].getGeneration(),
                                        genome: candidates[0].getCopyGenome(),
                                    });

                                    if (bestCandidate === undefined
                                        || this.fitnessTest(newTempCandidate) >= this.fitnessTest(bestCandidate)
                                    ) {
                                        bestCandidate = newTempCandidate;
                                    }
                                    resolve(bestCandidate);
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
                                    let rightPos = leftPos + 1;
                                    let copyLeftGenome = candidates[leftPos].getCopyGenome();
                                    while (rightPos < this.__bestCandidatesCount) {
                                        // Copy genome first then crossover
                                        candidates[savePosition].setGenome(copyLeftGenome);
                                        candidates[savePosition + 1].setGenome(candidates[rightPos].getCopyGenome());
                                        // Crossover
                                        crossoverPromises
                                            .push(this
                                                .crossoverGenome({
                                                    candidateA: candidates[savePosition],
                                                    candidateB: candidates[savePosition + 1],
                                                })
                                            );
                                        rightPos += 1;
                                        // savePosition += 2;
                                        savePosition += 1;
                                    }
                                    leftPos += 1;
                                }

                                return Array
                                    .from({length: crossoverPromises.length}, (_, k) => k)
                                    .reduce((promise, index) => promise.then(() => {
                                        return crossoverPromises[index];
                                    }), Promise.resolve());
                            })
                            // Re populate new genes
                            .then(() => {
                                let copyGenomeBestCandidate = bestCandidate.getCopyGenome();
                                return Array
                                    .from({length: this.__totalCandidates - this.__bestCandidatesCount - this.__totalChildren}, (_, k) => this.__totalChildren + this.__bestCandidatesCount + k)
                                    .reduce((promise, index) => promise.then(() => {
                                        candidates[index].setGenome(this.randomGenome({
                                            layers,
                                            numberOfInputs,
                                            seed: copyGenomeBestCandidate,
                                        }));
                                    }), Promise.resolve())
                            })
                            // Mutate gene
                            .then(() => {
                                return Array
                                    .from({length: this.__totalChildren}, (_, k) => this.__bestCandidatesCount + k)
                                    .reduce((promise, luckyCandidateNumber) => promise.then(() => {
                                        console.log(`mutate cadidate ${luckyCandidateNumber} gene`);
                                        this.mutateGenome(candidates[luckyCandidateNumber]);
                                    }), Promise.resolve());
                            });
                    }), Promise.resolve());
            })
            // Save the candidates
            .then(() => {
                console.log(`end of generation`);
                fileService.writeToJSONFile({
                    jsonfilepath: './data/backup/0.json',
                    data: bestCandidate.toString(),
                });
                return candidates
                    .forEach(candidate => fileService.writeToJSONFile({
                        jsonfilepath: `./data/candidates/${candidate.getId()}.json`,
                        data: candidate.toString(),
                    }));
            });

    }
}
