import App from './app.js';
import ArrayFn from './util/ArrayFn.js';
import MarketWatchAPI from './resource/MarketWatchAPI.js';
import MomentAdaptor from './util/MomentAdaptor.js';
import FileService from './util/FileService.js';

const app = new App();
const marketWatchAPI = new MarketWatchAPI();
const fileService = new FileService();

fileService
    .readFromCSVFileToJson('./data/csv_sample/cboesymboldirweeklys.csv')
    .then(json => json.map(company => company.StockSymbol))
    .then(tickerSymbols => {
        fixMissingData(tickerSymbols.concat(app.getListOfTickers()));
    });

// fixMissingData(app.getListOfTickers());

function fixMissingData(tickerSymbols) {
    Promise
        .all(tickerSymbols
            .map(tickerSymbol => fileService
                .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
                .then(candlestickCollection => ({[`${tickerSymbol}`]: candlestickCollection}))
            )
        )
        .then(multipleTickerCandlestickCollection => multipleTickerCandlestickCollection.reduce((accumulator, candlestickCollection) => {
            return Object.assign(accumulator, candlestickCollection);
        }, {}))
        .then(multipleTickerCandlestickCollection => {
            const initialTickerSymbols = Object.keys(multipleTickerCandlestickCollection); // eg. keys: ['SPY', 'QQQ', 'IWM']

            marketWatchAPI
                .removeIgnoredTickerSymbol(initialTickerSymbols)
                .forEach(function (tickerSymbol) {

                    // find a range of date where volume is equal to 0
                    const candlestickCollection = multipleTickerCandlestickCollection[tickerSymbol];

                    const candlestickCollectionWithError = candlestickCollection
                        .filter(candlestick => candlestick.getVolume() === 0);

                    // let candlestickCollectionWithError = [];
                    // for (let i = 0; i < candlestickCollection.length(); i++) {
                    //     if (candlestickCollection.getByIndex(i).getVolume() === 0) {
                    //         candlestickCollectionWithError.push(candlestickCollection.getByIndex(i));
                    //     } else if (candlestickCollection.getByIndex(i).getVolume() !== 0
                    //         && candlestickCollectionWithError.length > 0
                    //     ) {
                    //         break;
                    //     }
                    // }

                    if (!ArrayFn.isEmpty(candlestickCollectionWithError)) {
                        let startDate = new MomentAdaptor(ArrayFn
                            .getFirstElement(candlestickCollectionWithError)
                            .getTimestamp(),
                            'YYYY-MM-DD');
                        let endDate = new MomentAdaptor(ArrayFn
                            .getLastElement(candlestickCollectionWithError)
                            .getTimestamp(),
                            'YYYY-MM-DD');

                        marketWatchAPI
                            // download csv file
                            .getCandlesticks({
                                endDate: endDate.format('MM/DD/YYYY'),
                                startDate: startDate.format('MM/DD/YYYY'),
                                tickerSymbol,
                            })
                            // sort first so that we calculate the diff correctly
                            .then(jsonUpdates => jsonUpdates.sort((a, b) => {
                                const first = new MomentAdaptor(a.Date, 'MM/DD/YYYY');
                                const second = new MomentAdaptor(b.Date, 'MM/DD/YYYY');
                                return first.valueOf() - second.valueOf();
                            }))
                            // replace data
                            .then(jsonUpdates => {
                                jsonUpdates.forEach(json => {
                                    const index = candlestickCollection.getIndexByDate(new MomentAdaptor(json.Date, 'MM/DD/YYYY'));
                                    if (index >= 0) {
                                        candlestickCollection.updateByIndex(index, {
                                            volume: parseInt(json
                                                .Volume
                                                .split(',')
                                                .join('')
                                            ),
                                            openPrice: parseFloat(json.Open),
                                            closePrice: parseFloat(json.Close),
                                            highPrice: parseFloat(json.High),
                                            lowPrice: parseFloat(json.Low),
                                        });
                                    }
                                });

                                // save collection
                                return fileService.writeToJSONFile({
                                    jsonfilepath: `./data/tickers/${tickerSymbol}.json`,
                                    data: candlestickCollection.stringify(),
                                });
                            })
                    }
            });
        })
        .catch(error => {
            console.log(`Error: ${error}`);
        });
}