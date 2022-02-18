import AlpacaAPI from '../resource/AlpacaAPI.js';
import App from '../app.js';
import ArrayFn from '../util/ArrayFn.js';
import CollectionService from '../resource/CollectionService.js';
import FileService from '../util/FileService.js';
import MomentAdaptor from '../util/MomentAdaptor.js';
import Universe from '../model/Universe.js';
import VolumeProfile from '../model/VolumeProfile.js';

const alpacaAPI = new AlpacaAPI();
const app = new App();
const fileService = new FileService();
const collectionService = new CollectionService();

getData(app.getListOfTickers());

async function getData(tickerSymbols) {
    const clock = await alpacaAPI.getClock();
    const nextTradingDay = new MomentAdaptor(clock.next_open, 'YYYY-MM-DD');
    const lastTradingDay = nextTradingDay.subtractBusinessDay(1);

    Promise
        .all(tickerSymbols
            .map(tickerSymbol => collectionService
                .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
                .then(candlestickCollection => ({[`${tickerSymbol}`]: candlestickCollection}))
            )
        )
        .then(multipleTickerCandlestickCollection => multipleTickerCandlestickCollection.reduce((accumulator, candlestickCollection) => {
            return Object.assign(accumulator, candlestickCollection);
        }, {}))
        .then(multipleTickerCandlestickCollection => {
            const initialTickerSymbols = Object.keys(multipleTickerCandlestickCollection); // eg. keys: ['SPY', 'QQQ', 'IWM']

            // Remove ignored ticker symbols
            const removedIgnoredTickerSymbols = alpacaAPI.removeIgnoredTickerSymbol(initialTickerSymbols);

            // Remove symbols that is already updated, Save the ones we need to update
            let lastFilteredTickerSymbols = [];
            for (let tickerSymbol of removedIgnoredTickerSymbols) {
                const candlestickCollection = multipleTickerCandlestickCollection[tickerSymbol];
                const startDateAfterLastDateInCollection = candlestickCollection.isEmpty()
                    ? new MomentAdaptor('2016-08-10', 'YYYY-MM-DD')
                    : new MomentAdaptor(
                        candlestickCollection
                            .getLastElement()
                            .getTimestamp(),
                        'YYYY-MM-DD'
                    ).addBusinessDays(1);

                if (startDateAfterLastDateInCollection.isAfter(lastTradingDay)) {
                    console.log(`${tickerSymbol}, the last day in collection is ${startDateAfterLastDateInCollection.format()} after lastTradingDay ${lastTradingDay.format()}`);
                    continue;
                }

                // Record ticker symbol we need with start date and end date
                lastFilteredTickerSymbols.push({
                    symbol: tickerSymbol,
                    startDate: startDateAfterLastDateInCollection.format(),
                    endDate: lastTradingDay.format(),
                });
            }

            lastFilteredTickerSymbols = ArrayFn.sortAscByKey(lastFilteredTickerSymbols, 'symbol');

            return Promise
                .all(lastFilteredTickerSymbols.map(lastFilteredTickerSymbol => alpacaAPI
                    .getCandlesticks({
                        endDate: lastFilteredTickerSymbol.endDate,
                        startDate: lastFilteredTickerSymbol.startDate,
                        tickerSymbol: lastFilteredTickerSymbol.symbol,
                    })
                    .then(candlesticks => {
                        const candlestickCollection = multipleTickerCandlestickCollection[lastFilteredTickerSymbol.symbol];

                        candlesticks.forEach(candlestick => candlestickCollection.push(candlestick));

                        return fileService.writeToJSONFile({
                            jsonfilepath: `./data/tickers/${lastFilteredTickerSymbol.symbol}.json`,
                            data: candlestickCollection.stringify(),
                        });
                    })
                ))
                // Finally update the ignored ticker symbol with invalid symbols
                .then(() => alpacaAPI.recordInvalidTickerSymbol());
        })
        .then(() => {
            return Promise
                .all(app
                    .__listOfTickers
                    .map(tickerSymbol => {
                        const volumeProfile = new VolumeProfile();
                        return volumeProfile.reCreateVolumeProfile(tickerSymbol);
                    })
                );
        })
        .then(() => {
            const universe = new Universe();
            return universe
                .createUniverse()
                .then(universe => fileService.writeToJSONFile({
                    jsonfilepath: './data/universe/universe.json',
                    data: universe.map(world => Object.fromEntries(world)),
                }));
        });
}
