import axios from 'axios';
import Candlestick from '../model/Candlestick.js';
import FileService from '../util/FileService.js';
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

    currency(value) {
        return parseFloat(value.toFixed(2));
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
                        close: this.currency(obj.c),
                        high: this.currency(obj.h),
                        low: this.currency(obj.l),
                        n: obj.n,
                        open: this.currency(obj.o),
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
            .then(clock => axios
                .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/bars`, {
                    headers: {
                        'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                        'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                    },
                    params: {
                        start: new MomentAdaptor(clock.timestamp, 'YYYY-MM-DD')
                            // .subtractBusinessDay(1)
                            .format(),
                        end: new MomentAdaptor(clock.timestamp, 'YYYY-MM-DD')
                            .addBusinessDays(1)
                            .format(),
                        timeframe: '1Day',
                    },
                })
                .then(response => response.data));
    }
}

// new AlpacaAPI().getLatestQuote('QQQ').then(data => console.log(data));