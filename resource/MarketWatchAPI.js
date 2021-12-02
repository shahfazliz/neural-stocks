import axios from 'axios';
import fs from 'fs';
import FileService from '../util/FileService.js';

const fileService = new FileService();
export default class MarketWatchAPI {
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

    getCandlesticks({
        endDate,
        startDate,
        tickerSymbol,
    }) {
        // const url = `https://www.marketwatch.com/investing/stock/${tickerSymbol}/downloaddatapartial?startdate=${startDate}%2000:00:00&enddate=${endDate}%2000:00:00&daterange=d30&frequency=p1d&csvdownload=true&downloadpartial=false&newdates=false`;
        const url = `https://www.marketwatch.com/investing/fund/${tickerSymbol}/downloaddatapartial?startdate=${startDate}%2000:00:00&enddate=${endDate}%2000:00:00&daterange=d30&frequency=p1d&csvdownload=true&downloadpartial=false&newdates=false`;
        console.log(`Requesting from: ${url}`);
        return axios
            .get(url, {
                responseType: 'stream',
            })
            .then(response => {
                const filepath = `./csv_sample/${tickerSymbol}.csv`;
                response.data.pipe(fs.createWriteStream(filepath));

                return fileService.readFromCSVFileToJson(filepath);
            });

        // const filepath = `./csv_sample/${tickerSymbol}.csv`;
        // return fileService.readFromCSVFileToJson(filepath);
    }
}
