import App from './app.js';
import Candlestick from './model/Candlestick.js';
import CollectionService from './resource/CollectionService.js';
import GeneticAlgo from './GeneticAlgo.js';
import VolumeProfile from './model/VolumeProfile.js';
import AlpacaAPI from './resource/AlpacaAPI.js';

const alpacaAPI = new AlpacaAPI();
const app = new App();
const collectionService = new CollectionService();

let universe;
const numberOfOutputs = 7;
let layers;
let candidate;
const candidateNumber = 0;

const algo = new GeneticAlgo();
algo
    .readJSONFileAsUniverse('./data/universe/universe.json')
    .then(u => universe = u)
    // get data to update universe
    .then(() => {
        return Promise
            .all(app
                .getListOfTickers()
                .map(tickerSymbol => collectionService
                    .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
                    // Hijack data by adding today's daily quote
                    .then(candlestickCollection => alpacaAPI
                        .getLatestQuote(tickerSymbol)
                        // .then(data => {
                        //     console.log(`${tickerSymbol}: ${JSON.stringify(data)}`);
                        //     return data;
                        // })
                        .then(data => {
                            const candlestick = new Candlestick({
                                timestamp: data.bars[0].t,
                                open: algo.currency(data.bars[0].o),
                                close: algo.currency(data.bars[0].c),
                                high: algo.currency(data.bars[0].h),
                                low: algo.currency(data.bars[0].l),
                                volume: data.bars[0].v,
                                n: data.bars[0].n,
                                vw: data.bars[0].vw,
                            });

                            const tickerVolumeProfile = new VolumeProfile();
                            return tickerVolumeProfile
                                .init(tickerSymbol)
                                .then(() => {
                                    tickerVolumeProfile.update(candlestick);

                                    candlestick.setVolumeProfile(tickerVolumeProfile.getVolumeProfile(candlestick.getClose()));
                                    candlestickCollection.push(candlestick);
                                    return candlestickCollection;
                                });
                        })
                        .then(candlestickCollection => {
                            const obj = {
                                tickerSymbol,
                                candlestickCollection
                            };
                            return obj;
                        })
                    )
                )
            )
            // Combine multiple ticker training data sets
            .then(multipleTrainingData => {
                const map = new Map();
                multipleTrainingData.forEach(obj => {
                    const tickerSymbol = obj.tickerSymbol;
                    const candlestick = obj.candlestickCollection.getLastElement();

                    // For debugging, see the dates
                    // map.set(`${tickerSymbol}_Timestamp_${replaceDateWithCount}`, candlestick.getTimestamp());
                    // map.set(`${tickerSymbol}_Day_${replaceDateWithCount}`, candlestick.getDay());
                    // map.set(`${tickerSymbol}_Month_${replaceDateWithCount}`, candlestick.getMonth());
                    map.set(`Day`, candlestick.getDay());
                    map.set(`Month`, candlestick.getMonth());
                    map.set(`${tickerSymbol}_OpenPrice`, algo.precision(candlestick.getOpenDiff()));
                    map.set(`${tickerSymbol}_ClosePrice`, algo.precision(candlestick.getCloseDiff()));
                    map.set(`${tickerSymbol}_Volume`, algo.precision(candlestick.getVolumeDiff()));
                    map.set(`${tickerSymbol}_HighPrice`, algo.precision(candlestick.getHighDiff()));
                    map.set(`${tickerSymbol}_LowPrice`, algo.precision(candlestick.getLowDiff()));
                    map.set(`${tickerSymbol}_VolumeProfile`, algo.precision(candlestick.getVolumeProfile()));
                    map.set(`${tickerSymbol}_StandardDeviation`, candlestick.getStandardDeviation());
                });
                universe.push(map);
            })
            // .then(() => console.log(universe[universe.length - 1]))
    })
.then(() => algo.readJSONFileAsCandidate(`./data/candidates/${candidateNumber}.json`))
.then(c => candidate = c)
// Predict today
.then(() => {
    candidate.reset();

    layers = [...algo.__layers, numberOfOutputs];
    // Get 50 candles as input set from universe
    let inputSet = universe
        .slice(universe.length - algo.__numberOfCandles - 1, universe.length - 1)
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

    console.log('Today:');
    let sumOfOutputs = output.reduce((acc, val) => acc + val) - output[output.length - 1];
    [
        'Long SPY',
        'Short SPY',
        'Long QQQ',
        'Short QQQ',
        'Long IWM',
        'Short IWM',
    ].forEach((string, index) => {
        console.log(`${string}: ${algo.currency(output[index] / sumOfOutputs)}`);
    });
    console.log(`Withdraw: ${algo.currency(output[output.length - 1])}`);
})
// Predict tomorrow
.then(() => {
    candidate.reset();

    layers = [...algo.__layers, numberOfOutputs];
    // Get 50 candles as input set from universe
    let inputSet = universe
        .slice(universe.length - algo.__numberOfCandles)
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

    console.log('Tomorrow:');
    let sumOfOutputs = output.reduce((acc, val) => acc + val) - output[output.length - 1];
    [
        'Long SPY',
        'Short SPY',
        'Long QQQ',
        'Short QQQ',
        'Long IWM',
        'Short IWM',
    ].forEach((string, index) => {
        console.log(`${string}: ${algo.currency(output[index] / sumOfOutputs)}`);
    });
    console.log(`Withdraw: ${algo.currency(output[output.length - 1])}`);
});
