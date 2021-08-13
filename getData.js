import App from './app.js';
import ArrayFn from './util/ArrayFn.js';
import axios from 'axios';
import fs from 'fs/promises';
import moment from 'moment';

const app = new App();

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(data => ({[`${tickerSymbol}`]: data}))
        )
    )
    .then(multipleTickerDailyDataJson => multipleTickerDailyDataJson.reduce((accumulator, tickerDailyDataJson) => {
        return Object.assign(accumulator, tickerDailyDataJson);
    }, {}))
    .then(multipleTickerDailyDataJson => {
        const tickerSymbols = Object.keys(multipleTickerDailyDataJson);

        for (let tickerSymbol of tickerSymbols) {
            let tickerDailyDataJson = multipleTickerDailyDataJson[tickerSymbol];
            const statDateAfterLastDateInJson = ArrayFn.isEmpty(tickerDailyDataJson)
                ? moment('2016-08-10', 'YYYY-MM-DD')
                : moment(ArrayFn.getLastElement(tickerDailyDataJson).Timestamp, 'YYYY-MM-DD').add(1, 'day');
            const yesterday = moment().subtract(1, 'day');

            if (statDateAfterLastDateInJson.isAfter(yesterday)) {
                break;
            }

            axios
                .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/bars`, {
                    headers: {
                        'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                        'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                    },
                    params: {
                        start: statDateAfterLastDateInJson.format(),
                        end: yesterday.format(),
                        timeframe: '1Day',
                    },
                })
                // Rename keys
                .then(response => response
                    .data
                    .bars
                    .map(obj => ({
                        Timestamp: obj.t,
                        OpenPrice: obj.o,
                        ClosePrice: obj.c,
                        HighPrice: obj.h,
                        LowPrice: obj.l,
                        Volume: obj.v,
                        n: obj.n,
                        vw: obj.vw,
                    }))
                )
                .then(responseDataJson => {
                    tickerDailyDataJson = [...tickerDailyDataJson, ...responseDataJson];
                    return fs.writeFile(
                        `./data/${tickerSymbol}.json`,
                        JSON.stringify(tickerDailyDataJson, undefined, 4)
                    );
                });
        }
    })
    .catch(error => console.log(`Error: ${error}`));
