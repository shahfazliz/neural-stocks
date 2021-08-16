import App from './app.js';
import axios from 'axios';
import Candlestick from './model/Candlestick.js';
import fs from 'fs/promises';
import moment from 'moment';

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
                ? moment('2016-08-10', 'YYYY-MM-DD')
                : moment(candlestickCollection.getLastElement().getTimestamp(), 'YYYY-MM-DD').add(1, 'day');
            const yesterday = moment().subtract(1, 'day');

            if (statDateAfterLastDateInCollection.isAfter(yesterday)) {
                continue;
            }

            console.log(statDateAfterLastDateInCollection.format());
            console.log(yesterday.format());

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
                .then(response => response
                    .data
                    .bars
                    .map(obj => new Candlestick({
                        timestamp: obj.t,
                        open: obj.o,
                        close: obj.c,
                        high: obj.h,
                        low: obj.l,
                        volume: obj.v,
                        n: obj.n,
                        vw: obj.vw,
                    }))
                )
                .then(candlesticks => {
                    candlesticks.forEach(candlestick => candlestickCollection.push(candlestick));
                    return fs.writeFile(
                        `./data/${tickerSymbol}.json`,
                        candlestickCollection.stringify()
                    );
                });
        }
    })
    .catch(error => console.log(`Error: ${error}`));
