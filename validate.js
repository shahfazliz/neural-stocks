import GeneticAlgo from './GeneticAlgo.js';

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
                console.log('------------------------------------------------');
                console.log(`Candidate: ${candidateNumber}, Day: ${dayNumber}`);
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
                    let profit = 0;

                    ['SPY', 'QQQ', 'IWM']
                        .forEach((tickerSymbol, index) => {
                            let expectedStandardDeviation = universe[dayNumber + algo.__numberOfCandles - 1].get(`${tickerSymbol}_StandardDeviation`);
                            let closePriceToday = universe[dayNumber + algo.__numberOfCandles].get(`${tickerSymbol}_ClosePrice`);

                            // Long
                            let availableCapital = candidate.getCapital();
                            let risk = (output[index * 2] / sumOfOutputs) || 0;
                            let capitalToUse = availableCapital * risk;
                            let costOfTradeLong = capitalToUse > 0 
                                ? algo.__costOfTrade 
                                : 0;
                            let rewardLong = capitalToUse * algo.__reward - costOfTradeLong;
                            let long = -expectedStandardDeviation < closePriceToday
                                ? algo.currency(rewardLong)
                                : algo.currency(rewardLong - capitalToUse);    
                            candidate.setCapital(availableCapital - capitalToUse);
                            console.log(`  profit long ${tickerSymbol}: ${long}`);
                            profit += long;
                            
                            // Short
                            availableCapital = candidate.getCapital();
                            risk = (output[index * 2 + 1] / sumOfOutputs) || 0;
                            capitalToUse = availableCapital * risk;
                            let costOfTradeShort = capitalToUse > 0 
                                ? algo.__costOfTrade 
                                : 0;
                            let rewardShort = capitalToUse * algo.__reward - costOfTradeShort;
                            let short = expectedStandardDeviation > closePriceToday
                                ? algo.currency(rewardShort)
                                : algo.currency(rewardShort - capitalToUse);
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
                    if (universe[dayNumber + algo.__numberOfCandles].get('Month') !== universe[dayNumber + algo.__numberOfCandles - 1].get('Month')) {
                        let withdrawal = algo.currency(candidate.getCapital() - 1000);

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
