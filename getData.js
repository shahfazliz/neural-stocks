import App from './app.js';
import axios from 'axios';
import Candlestick from './model/Candlestick.js';
import fs from 'fs/promises';
import MomentAdaptor from './util/MomentAdaptor.js';

const app = new App();

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(candlestickCollection => ({[`${tickerSymbol}`]: candlestickCollection}))
        )
    )
    .then(multipleTickerCandlestickCollection => multipleTickerCandlestickCollection.reduce((accumulator, candlestickCollection) => {
        return Object.assign(accumulator, candlestickCollection);
    }, {}))
    .then(multipleTickerCandlestickCollection => {
        const tickerSymbols = Object.keys(multipleTickerCandlestickCollection);

        for (let tickerSymbol of tickerSymbols) {
            let candlestickCollection = multipleTickerCandlestickCollection[tickerSymbol];
            const statDateAfterLastDateInCollection = candlestickCollection.isEmpty()
                ? new MomentAdaptor('2016-08-10', 'YYYY-MM-DD')
                : new MomentAdaptor(
                    candlestickCollection
                        .getLastElement()
                        .getTimestamp(),
                    'YYYY-MM-DD'
                ).addBusinessDays(1);
            const yesterday = new MomentAdaptor().subtractBusinessDay(1);

            if (statDateAfterLastDateInCollection.isAfter(yesterday)) {
                continue;
            }

            axios
                .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/bars`, {
                    headers: {
                        'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                        'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                    },
                    params: {
                        start: statDateAfterLastDateInCollection.format(),
                        end: yesterday.format(),
                        timeframe: '1Day',
                    },
                })
                // Rename keys
                .then(response => {
                    if(response.data.bars === null) {
                        throw new Error(`Data for ${response.data.symbol} were not available from ${statDateAfterLastDateInCollection.format()} to ${yesterday.format()}`);
                    }

                    return response
                        .data
                        .bars
                        .map(obj => new Candlestick({
                            close: obj.c,
                            high: obj.h,
                            low: obj.l,
                            n: obj.n,
                            open: obj.o,
                            timestamp: obj.t,
                            volume: obj.v,
                            vw: obj.vw,
                        }));
                })
                .then(candlesticks => {
                    candlesticks.forEach(candlestick => candlestickCollection.push(candlestick));
                    return fs.writeFile(
                        `./data/${tickerSymbol}.json`,
                        candlestickCollection.stringify()
                    );
                })
                .catch(error => console.log(error));
        }
    })
    .catch(error => console.log(`Error: ${error}`));
