import GeneticAlgo from './GeneticAlgo.js';
import MathFn from './util/MathFn.js';

let universe;
let layers;
let candidate;
const candidateNumber = 0;

const algo = new GeneticAlgo();
algo
    .readJSONFileAsUniverse('./data/universe/universe.json')
    .then(u => universe = u)
    .then(() => algo.readJSONFileAsCandidate(`./data/backup/${candidateNumber}.json`))
    .then(c => candidate = c)
    .then(() => {
        
        candidate.reset();

        layers = [...algo.__layers, algo.__numberOfOutputs];
        // Run the candidates
        return Array
            .from({ length: universe.length - algo.__numberOfCandles }, (_, k) => k)
            .reduce((promise, dayNumber) => promise.then(() => {
                // Only trade on Monday, Wednesday, and Friday
                let tomorrow = universe[dayNumber].get('Day');
                if (candidate.getCapital() >= 1000
                    && (tomorrow === 1
                        || tomorrow === 3
                        || tomorrow === 5)
                ) {
                    console.log('------------------------------------------------');
                    console.log(`Candidate: ${candidateNumber}, Day: ${dayNumber}`);
                    console.log('------------------------------------------------');
                    
                    // Get 50 candles as input set from universe
                    let inputSet = universe
                        .slice(dayNumber, dayNumber + algo.__numberOfCandles)
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
                    let output = algo.runCandidate({
                        id: candidate.getId(),
                        genome: candidate.getGenome(),
                        input: inputSet,
                        layers,
                    });

                    let sumOfOutputs = output.reduce((acc, val) => acc + val);
                    console.log(`Output: ${JSON.stringify(output.map(val => val / sumOfOutputs || 0), undefined, 4)}`);

                    let originalCapital = candidate.getCapital();

                    let profit = algo
                        .getListTickersOfInterest()
                        .reduce((profit, tickerSymbol, tickerSymbolIndex) => {
                            return profit + candidate.executeTrade({
                                model: output,
                                modelIndex: tickerSymbolIndex,
                                perTradeComission: algo.__costOfTrade,
                                perTradeReward: algo.__reward,
                                priceCloseToday: universe[dayNumber + algo.__numberOfCandles].get(`${tickerSymbol}_ClosePrice`),
                                priceExpectedMove: universe[dayNumber + algo.__numberOfCandles - 1].get(`${tickerSymbol}_StandardDeviation`),
                                tickerSymbol,
                            });
                        }, 0);

                    // Record total profits so far
                    candidate.setProfit(candidate.getProfit() + profit);
                    console.log(`Total profit/loss: ${MathFn.currency(profit)} from ${originalCapital} capital`);

                    // Update capital
                    candidate.setCapital(originalCapital + profit);

                    // Every month trade withdraw
                    if (universe[dayNumber + algo.__numberOfCandles].get('Month') !== universe[dayNumber + algo.__numberOfCandles - 1].get('Month')) {
                        let withdrawal = MathFn.currency(candidate.getCapital() - 1000);

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
                    console.log(`Score: ${algo.fitnessTest(candidate)}`);
                }
            }), Promise.resolve());
    })
    .then(() => {
        console.log('------------------------------------------------');
        console.log('Candidate Summary');
        console.log('------------------------------------------------');
        console.log(candidate.scoreToString())
    });
