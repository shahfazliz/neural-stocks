import CollectionService from '../resource/CollectionService.js';
import GeneticAlgo from '../GeneticAlgo.js';
import MathFn from '../util/MathFn.js';

let universe;
let layers;
let candidate;
const candidateNumber = 0;

const algo = new GeneticAlgo();
const collectionService = new CollectionService();
collectionService
    .readJSONFileAsUniverse('./data/universe/universe.json')
    .then(u => universe = u)
    .then(() => algo.readJSONFileAsCandidate(`./data/candidates/${candidateNumber}.json`))
    .then(c => candidate = c)
    .then(() => {
        const numberOfTradingDays = universe.length - algo.__numberOfCandles;

        candidate
            .reset()
            .setInitialCapital(algo.__initialCapital);

        layers = [...algo.__layers, algo.__numberOfOutputs];
        // Run the candidates
        return Array
            .from({ length: numberOfTradingDays }, (_, k) => algo.__numberOfCandles + k)
            .reduce((promise, dayNumber) => promise.then(() => {
                // Only trade on Monday, Wednesday, and Friday
                let today = universe[dayNumber].get('Day');
                if (candidate.getCapital() >= candidate.getInitialCapital()
                    && (today === 0.1
                        || today === 0.3
                        || today === 0.5)
                ) {
                    console.log('------------------------------------------------');
                    console.log(`Candidate: ${candidateNumber}, Day: ${dayNumber}/${universe.length - 1}`);
                    console.log('------------------------------------------------');
                    
                    // Get 50 candles as input set from universe
                    let inputSet = universe
                        .slice(dayNumber - algo.__numberOfCandles, dayNumber) // 50 candles before today
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

                    console.log(`Output: ${JSON.stringify(output, undefined, 4)}`);

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

                    let profit = algo
                        .getListTickersOfInterest()
                        .reduce((profit, tickerSymbol, tickerSymbolIndex) => {
                            return profit + candidate.executeTrade({
                                risk: [capitalToRisk[tickerSymbolIndex * 2], capitalToRisk[tickerSymbolIndex * 2 + 1]],
                                perTradeComission: algo.__costOfTrade,
                                perTradeReward: algo.__reward,
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

                    console.log(`Score: ${algo.fitnessTest(candidate)}`);
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
