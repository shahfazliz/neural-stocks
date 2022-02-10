import AlpacaAPI from '../resource/AlpacaAPI.js';
import App from '../app.js';
import Candidate from '../model/Candidate.js';
import Candlestick from '../model/Candlestick.js';
import CollectionService from '../resource/CollectionService.js';
import MathFn from '../util/MathFn.js';
import TensorFlowAdaptor from '../util/TensorFlowAdaptor.js';
import VolumeProfile from '../model/VolumeProfile.js';

const alpacaAPI = new AlpacaAPI();
const app = new App();
const collectionService = new CollectionService();
const tensorFlow = new TensorFlowAdaptor();

let universe;

collectionService
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
                        //     console.log(`${tickerSymbol}: ${JSON.stringify(data, undefined, 4)}`);
                        //     return data;
                        // })
                        .then(data => {
                            const candlestick = new Candlestick({
                                timestamp: data.bars[0].t,
                                open: MathFn.currency(data.bars[0].o),
                                close: MathFn.currency(data.bars[0].c),
                                high: MathFn.currency(data.bars[0].h),
                                low: MathFn.currency(data.bars[0].l),
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

                                    const yesterdayVolumeProfile = candlestickCollection
                                        .getLastElement()
                                        .getVolumeProfile();

                                    candlestick.setVolumeProfileDiff(Math.log(candlestick.getVolumeProfile() / yesterdayVolumeProfile));

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
                        .catch(() => {
                            console.log(`Latest ${tickerSymbol} quote was not available`);
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
                    map.set(`${tickerSymbol}_OpenPrice`, candlestick.getOpenDiff());
                    map.set(`${tickerSymbol}_ClosePrice`, candlestick.getCloseDiff());
                    map.set(`${tickerSymbol}_Volume`, candlestick.getVolumeDiff());
                    map.set(`${tickerSymbol}_HighPrice`, candlestick.getHighDiff());
                    map.set(`${tickerSymbol}_LowPrice`, candlestick.getLowDiff());
                    map.set(`${tickerSymbol}_VolumeProfile`, candlestick.getVolumeProfileDiff());
                    map.set(`${tickerSymbol}_StandardDeviation`, candlestick.getStandardDeviation());
                });
                universe.push(map);
            });
            // .then(() => console.log(universe[universe.length - 1]));
    })
    .then(() => {
        return tensorFlow.getTrainedModel()
    })
    // Predict today
    .then(model => {
        const candidate = new Candidate({
            id: 0,
        });
        candidate
            .reset()
            .setCapital(app.__initialCapital)
            .setInitialCapital(app.__initialCapital);

        // Get 50 candles as input set from universe
        let inputSet = universe
            .slice(universe.length - app.__numberOfCandles - 1, universe.length - 1)
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
            model,
            input: inputSet,
        });

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

        console.log('Today:');
        [
            'Long SPY',
            'Short SPY',
            'Long QQQ',
            'Short QQQ',
            'Long IWM',
            'Short IWM',
        ].forEach((string, index) => {
            console.log(`  ${string}: ${capitalToRisk[index]}`);
        });
    })
    .then(() => {
        return tensorFlow.getTrainedModel();
    })
    // Predict tomorrow
    .then(model => {
        const candidate = new Candidate({
            id: 0,
        });
        candidate
            .reset()
            .setCapital(app.__initialCapital)
            .setInitialCapital(app.__initialCapital);

        // Get 50 candles as input set from universe
        let inputSet = universe
            .slice(universe.length - app.__numberOfCandles)
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
            model,
            input: inputSet,
        });

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

        console.log('Tomorrow:');
        [
            'Long SPY',
            'Short SPY',
            'Long QQQ',
            'Short QQQ',
            'Long IWM',
            'Short IWM',
        ].forEach((string, index) => {
            console.log(`  ${string}: ${capitalToRisk[index]}`);
        });
    });
