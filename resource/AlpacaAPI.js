import axios from 'axios';
import Candlestick from '../model/Candlestick.js';
import FileService from '../util/FileService.js';
import MathFn from '../util/MathFn.js';
import MomentAdaptor from '../util/MomentAdaptor.js';

const fileService = new FileService();
export default class AlpacaAPI {
    __MAX_NUMBER_OF_REQUESTS = 200;
    __numberOfRequestCounter = 0;
    __ignoreTickerSymbols = [];

    constructor() {
        fileService
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
        return fileService.writeToJSONFile({
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

        console.log(`Retrieving data for ${tickerSymbol} from ${startDate} to ${endDate}`);
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
                        close: MathFn.currency(obj.c),
                        high: MathFn.currency(obj.h),
                        low: MathFn.currency(obj.l),
                        n: obj.n,
                        open: MathFn.currency(obj.o),
                        timestamp: obj.t,
                        volume: obj.v,
                        vw: obj.vw,
                    }));
            });
    }

    getClock() {
        return axios
            .get(`https://api.alpaca.markets/v2/clock`, {
                headers: {
                    'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                    'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                },
            })
            .then(response => response.data);
    }

    getLatestQuote(tickerSymbol) {
        return this
            .getClock()
            // .then(clock => {
            //     console.log(JSON.stringify({
            //         start: new MomentAdaptor(clock.next_close, 'YYYY-MM-DD')
            //             .utcOffset(-5)
            //             .subtractBusinessDay(2)
            //             .format(),
            //         end: new MomentAdaptor(clock.next_close, 'YYYY-MM-DD')
            //             .utcOffset(-5)
            //             .subtractBusinessDay(1)
            //             .format(),
            //         timeframe: '1Day',
            //     }, undefined, 4));
            // })
            .then(clock => axios
                .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/bars`, {
                    headers: {
                        'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                        'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                    },
                    params: {
                        start: new MomentAdaptor(clock.next_close, 'YYYY-MM-DD')
                            .utcOffset(-5)
                            .subtractBusinessDay(1)
                            .format(),
                        end: new MomentAdaptor(clock.timestamp, 'YYYY-MM-DD')
                            .utcOffset(-5)
                            .subtract(15, 'minutes')
                            .format(),
                        timeframe: '1Day',
                    },
                })
                .then(response => response.data));
                // .then(data => console.log(data));
    }
}

// new AlpacaAPI().getLatestQuote('QQQ').then(data => console.log(data));