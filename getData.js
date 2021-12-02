import AlpacaAPI from './resource/AlpacaAPI.js';
import App from './app.js';
import ArrayFn from './util/ArrayFn.js';
import FileService from './util/FileService.js';
import GeneticAlgo from './trainGeneticAlgo.js';
import MomentAdaptor from './util/MomentAdaptor.js';

const alpacaAPI = new AlpacaAPI();
const app = new App();
const fileService = new FileService();

getData(app.getListOfTickers());

async function getData(tickerSymbols) {
    const clock = await alpacaAPI.getClock();
    const nextTradingDay = new MomentAdaptor(clock.next_open, 'YYYY-MM-DD');
    const lastTradingDay = nextTradingDay.subtractBusinessDay(1);

    Promise
        .all(tickerSymbols
            .map(tickerSymbol => fileService
                .readJSONFile(`./data/tickers/${tickerSymbol}.json`)
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
                const startDateAfterLastDateInCollection = ArrayFn.isEmpty(candlestickCollection)
                    ? new MomentAdaptor('2016-08-10', 'YYYY-MM-DD')
                    : new MomentAdaptor(
                        ArrayFn
                            .getLastElement(candlestickCollection)
                            .Timestamp,
                        'YYYY-MM-DD'
                    ).addBusinessDays(1);

                if (startDateAfterLastDateInCollection.isSameOrAfter(lastTradingDay)) {
                    console.log(`For ${tickerSymbol}, the last day in collection is the same or after lastTradingDay`);
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
            const algo = new GeneticAlgo();
            return algo
                .createUniverse()
                .then(universe => fileService.writeToJSONFile({
                    jsonfilepath: './data/universe/universe.json',
                    data: universe.map(world => Object.fromEntries(world)),
                }));
        })
        .catch(error => {
            console.log(`Error: ${error}`);
        });
}
