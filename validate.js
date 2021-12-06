import GeneticAlgo from './GeneticAlgo.js';

let universe;
const numberOfOutputs = 7;
let layers;
let candidate;
const candidateNumber = 0;

const algo = new GeneticAlgo();
algo
    .readJSONFileAsUniverse('./data/universe/universe.json')
    .then(u => universe = u)
    .then(() => algo.readJSONFileAsCandidate(`./data/candidates/${candidateNumber}.json`))
    .then(c => candidate = c)
    .then(() => {
        
        candidate.reset();

        layers = [...algo.__layers, numberOfOutputs];
        return Array
            .from({ length: universe.length - algo.__numberOfCandles }, (_, k) => k)
            .reduce((promise, dayNumber) => promise.then(() => {
                console.log(`Candidate: ${candidateNumber}, Day: ${dayNumber}`);
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
                    console.log(`Output: ${output}`);

                    let sumOfOutputs = output.reduce((acc, val) => acc + val) - output[output.length - 1];

                    let profit = 0;
                    // Long SPY
                    let longSpy = -universe[dayNumber + algo.__numberOfCandles - 1].get('SPY_StandardDeviation') < universe[dayNumber + algo.__numberOfCandles].get('SPY_ClosePrice')
                        ? candidate.getCapital() * (output[0] / sumOfOutputs) * algo.__reward - algo.__costOfTrade
                        : candidate.getCapital() * -(output[0] / sumOfOutputs) - algo.__costOfTrade;
                    // console.log(`candidate.getCapital(): ${candidate.getCapital()}`);
                    // console.log(`output[(0]: ${output[(0]}`);
                    // console.log(`algo.__reward: ${algo.__reward}`);
                    // console.log(`algo.__costOfTrade: ${algo.__costOfTrade}`);
                    console.log(`profit long spy: ${longSpy}`);
                    profit = algo.currency(profit + longSpy);

                    // Short SPY
                    let shortSpy = universe[dayNumber + algo.__numberOfCandles - 1].get('SPY_StandardDeviation') > universe[dayNumber + algo.__numberOfCandles].get('SPY_ClosePrice')
                        ? candidate.getCapital() * (output[1] / sumOfOutputs) * algo.__reward - algo.__costOfTrade
                        : candidate.getCapital() * -(output[1] / sumOfOutputs) - algo.__costOfTrade;
                    console.log(`profit short spy: ${shortSpy}`);
                    profit = algo.currency(profit + shortSpy);

                    // Long QQQ
                    let longQqq = -universe[dayNumber + algo.__numberOfCandles - 1].get('QQQ_StandardDeviation') < universe[dayNumber + algo.__numberOfCandles].get('QQQ_ClosePrice')
                        ? candidate.getCapital() * (output[2] / sumOfOutputs) * algo.__reward - algo.__costOfTrade
                        : candidate.getCapital() * -(output[2] / sumOfOutputs) - algo.__costOfTrade;
                    console.log(`profit long qqq: ${longQqq}`);
                    profit = algo.currency(profit + longQqq);

                    // Short QQQ
                    let shortQqq = universe[dayNumber + algo.__numberOfCandles - 1].get('QQQ_StandardDeviation') > universe[dayNumber + algo.__numberOfCandles].get('QQQ_ClosePrice')
                        ? candidate.getCapital() * (output[3] / sumOfOutputs) * algo.__reward - algo.__costOfTrade
                        : candidate.getCapital() * -(output[3] / sumOfOutputs) - algo.__costOfTrade;
                    console.log(`profit short qqq: ${shortQqq}`);
                    profit = algo.currency(profit + shortQqq);

                    // Long IWM
                    let longIwm = -universe[dayNumber + algo.__numberOfCandles - 1].get('IWM_StandardDeviation') < universe[dayNumber + algo.__numberOfCandles].get('IWM_ClosePrice')
                        ? candidate.getCapital() * (output[4] / sumOfOutputs) * algo.__reward - algo.__costOfTrade
                        : candidate.getCapital() * -(output[4] / sumOfOutputs) - algo.__costOfTrade;
                    console.log(`profit long iwm: ${longIwm}`);
                    profit = algo.currency(profit + longIwm);

                    // Short IWM
                    let shortIwm = universe[dayNumber + algo.__numberOfCandles - 1].get('IWM_StandardDeviation') > universe[dayNumber + algo.__numberOfCandles].get('IWM_ClosePrice')
                        ? candidate.getCapital() * (output[5] / sumOfOutputs) * algo.__reward - algo.__costOfTrade
                        : candidate.getCapital() * -(output[5] / sumOfOutputs) - algo.__costOfTrade;
                    console.log(`profit short iwm: ${shortIwm}`);
                    profit = algo.currency(profit + shortIwm);

                    // Record total profits so far
                    candidate.setProfit(candidate.getProfit() + profit);
                    console.log(`total profit: ${profit}`);

                    // Update capital
                    candidate.setCapital(candidate.getCapital() + profit);

                    // Every month trade withdraw
                    if (universe[dayNumber + algo.__numberOfCandles].get('Month') !== universe[dayNumber + algo.__numberOfCandles - 1].get('Month')) {
                        let withdrawal = algo.currency(candidate.getCapital() - 1000); // * output[6]);
                        
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
                    console.log(`Score: ${algo.fitnessTest(candidate)}`)
                }
            }), Promise.resolve());
    })
    .then(() => {
        console.log(candidate.scoreToString())
    });
