import App from './app.js';
import ArrayFn from './util/ArrayFn.js';
import axios from 'axios';
import Candlestick from './model/Candlestick.js';

const app = new App();

// Predict for today
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
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
            .forEach(key => { // eg. key: SPX_OpenPrice_1
                accumulator[key] = tickerLastDataSet[key];
            });
        return accumulator;
    }, {}))
    .then(lastInput => app
        .loadTrainedModel()
        .then(model => {
            const result = model.run(lastInput);
            Object
                .keys(result)
                .forEach(key => result[key] = result[key].toFixed(4));
            console.log("Today's result:", result);
        })
    )
    .catch(error => console.log(`Error: ${error}`));

// Predict for tomorrow
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
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
            .then(candlestickCollection => app.createTrainingData({
                tickerSymbol,
                candlestickCollection,
            }))
        )
    )
    // Combine multiple ticker training data sets
    .then(multipleTrainingData => {
        const accumulator = [];
        multipleTrainingData.forEach(trainingData => {
            trainingData.forEach((trainingSet, index) => {

                // Initialize new training set to be combined
                if (!accumulator[index]) {
                    accumulator[index] = {
                        input: {},
                        output: {},
                    };
                }

                Object
                    .keys(trainingSet.input)
                    .forEach(key => { // eg. key: SPY_OpenPrice_1
                        accumulator[index]['input'][key] = trainingSet.input[key];
                    });

                Object
                    .keys(trainingSet.output)
                    .forEach(key => { // eg. key: SPY_Long
                        accumulator[index]['output'][key] = trainingSet.output[key];
                    });
            });
        });
        return accumulator;
    })
    // Load from saved training
    .then(trainingData => app
        .continueTraining(trainingData)
        .then(model => {
            const result = model.run(ArrayFn.getLastElement(trainingData).input);
            Object
                .keys(result)
                .forEach(key => result[key] = result[key].toFixed(4));
            console.log("Tomorrow's result:", result);
        })
    )
    .catch(error => console.log(`Error: ${error}`));
