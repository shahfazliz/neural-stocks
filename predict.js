import App from './app.js';
import axios from 'axios';
import Candlestick from './model/Candlestick.js';

const app = new App();

// Predict for today
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(candlestickCollection => app.createLastInput({
                tickerSymbol,
                candlestickCollection,
            }))
        )
    )
    // Combine multiple ticker training data sets
    .then(multipleTickerLastDataSet => multipleTickerLastDataSet.reduce((accumulator, tickerLastDataSet) => {
        Object
            .keys(tickerLastDataSet)
            .forEach(key => {
                accumulator[key] = tickerLastDataSet[key];
            });
        return accumulator;
    }, {}))
    .then(lastInput => app
        .loadTrainedModel()
        .then(model => console.log("Today's result:", model.run(lastInput)))
    )
    .catch(error => console.log(`Error: ${error}`));

// Predict for tomorrow
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            // Hijack data by adding today's daily quote
            .then(candlestickCollection => axios
                .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/snapshot`, {
                    headers: {
                        'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                        'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                    }
                })
                .then(response => candlestickCollection
                    .clone()
                    .push(new Candlestick({
                        timestamp: response.data.dailyBar.t,
                        open: response.data.dailyBar.o,
                        close: response.data.dailyBar.c,
                        high: response.data.dailyBar.h,
                        low: response.data.dailyBar.l,
                        volume: response.data.dailyBar.v,
                        n: response.data.dailyBar.n,
                        vw: response.data.dailyBar.vw,
                    }))
                )
            )
            .then(candlestickCollection => app.createLastInput({
                tickerSymbol,
                candlestickCollection,
            }))
        )
    )
    // Combine multiple ticker training data sets
    .then(multipleTickerLastDataSet => multipleTickerLastDataSet.reduce((accumulator, tickerLastTrainingSet) => {
        Object
            .keys(tickerLastTrainingSet)
            .forEach(key => {
                accumulator[key] = tickerLastTrainingSet[key];
            });
        return accumulator;
    }, {}))
    .then(lastInput => app
        .loadTrainedModel()
        .then(model => {
            console.log("Tomorrow's result:", model.run(lastInput));
        })
    )
    .catch(error => console.log(`Error: ${error}`));
