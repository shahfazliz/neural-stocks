import App from '../app.js';
import axios from 'axios';
import Candlestick from '../model/Candlestick.js';

export default class AlpacaAPI {
    __MAX_NUMBER_OF_REQUESTS = 200;
    __numberOfRequestCounter = 0;
    __ignoreTickerSymbols = [];

    app = new App();

    constructor() {
        this
            .app
            .readJSONFile('./data/tickers/ignoreTicker.json')
            .then(ignoreTickerSymbols => this.__ignoreTickerSymbols = ignoreTickerSymbols);
    }

    removeIgnoredTickerSymbol(tickerSymbols) {
        return tickerSymbols.filter(tickerSymbol => !this
            .__ignoreTickerSymbols
            .includes(tickerSymbol));
    }

    recordInvalidTickerSymbol() {
        // Record so that we don't call that ticker anymore
        const jsonfilepath = './data/tickers/ignoreTicker.json';
        return this
            .app
            .writeToJSONFile({
                jsonfilepath,
                data: [...new Set(this.__ignoreTickerSymbols)],
            });
    }

    getCandlesticks({
        endDate,
        startDate,
        tickerSymbol,
    }) {
        if (this.__numberOfRequestCounter > this.__MAX_NUMBER_OF_REQUESTS) {
            console.log(`Max number of request reached`);
            return Promise.reject();
        }
        this.__numberOfRequestCounter += 1;

        console.log(`Retrieving data for ${tickerSymbol}`);
        return axios
            .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/bars`, {
                headers: {
                    'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                    'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                },
                params: {
                    start: startDate,
                    end: endDate,
                    timeframe: '1Day',
                },
            })
            .then(response => {
                if(response.data.bars === null) {
                    this.
                        __ignoreTickerSymbols
                        .push(tickerSymbol);
                    console.log(`Data for ${response.data.symbol} were not available from ${startDate} to ${endDate}`);
                    return [];
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
            });
    }
}
