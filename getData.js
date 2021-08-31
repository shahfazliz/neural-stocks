import AlpacaAPI from './resource/AlpacaAPI.js';
import App from './app.js';
import MomentAdaptor from './util/MomentAdaptor.js';
import ArrayFn from './util/ArrayFn.js';

const app = new App();
const alpacaAPI = new AlpacaAPI();

app
    .readFromCSVFileToJson('./csv_sample/cboesymboldirweeklys.csv')
    .then(json => json.map(company => company.StockSymbol))
    .then(tickerSymbols => {
        getData(tickerSymbols);
    });

// getData(app.getListOfTickers());

function getData(tickerSymbols) {
    Promise
        .all(tickerSymbols
            .map(tickerSymbol => app
                .readJSONFileAsCandlestickCollection(`./data/${tickerSymbol}.json`)
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
                const yesterday = new MomentAdaptor().subtractBusinessDay(1);

                if (startDateAfterLastDateInCollection.isSameOrAfter(yesterday)) {
                    // console.log(`For ${tickerSymbol}, the last day in collection is the same or after yesterday`);
                    continue;
                }

                // Record ticker symbol we need with start date and end date
                lastFilteredTickerSymbols.push({
                    symbol: tickerSymbol,
                    startDate: startDateAfterLastDateInCollection.format(),
                    endDate: yesterday.format(),
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

                        return app.writeToJSONFile({
                            jsonfilepath: `./data/${lastFilteredTickerSymbol.symbol}.json`,
                            data: candlestickCollection.stringify(),
                        });
                    })
                ))
                // Finally update the ignored ticker symbol with invalid symbols
                .then(() => alpacaAPI.recordInvalidTickerSymbol());
        })
        .catch(error => {
            console.log(`Error: ${error}`);
        });
}
