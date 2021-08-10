import Alpaca from '@alpacahq/alpaca-trade-api';
import App from './app.js';
import fs from 'fs';
import moment from 'moment';

const app = new App();

const alpaca = new Alpaca({
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY,
    usePolygon: false,
});

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(data => ({[`${tickerSymbol}`]: data}))
        )
    )
    .then(multipleJsonData => multipleJsonData.reduce((accumulator, data) => {
        return Object.assign(accumulator, data);
    }, {}))
    .then(async multipleJsonData => {
        const tickerSymbols = Object.keys(multipleJsonData);

        for await(let tickerSymbol of tickerSymbols) {
            const jsonData = multipleJsonData[tickerSymbol];
            const lastDateInJsonFile = moment(jsonData[jsonData.length - 1].Timestamp, 'YYYY-MM-DD');

            let bars = alpaca.getBarsV2(
                tickerSymbol,
                {
                    start: lastDateInJsonFile.add(1, 'day').format(),
                    end: moment().subtract(1, 'day').format(),
                    timeframe: '1Day',
                },
                alpaca.configuration
            );

            for await(let b of bars) {
                jsonData.push(b);
            }

            fs.writeFileSync(`./data/${tickerSymbol}.json`, JSON.stringify(jsonData));

            multipleJsonData[tickerSymbol] = jsonData;
        }
    })
    .catch(error => console.log(error));
