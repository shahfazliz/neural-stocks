import App from './app.js';
import axios from 'axios';

const app = new App();

// Predict for today
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(tickerDailyData => app.createLastInput({
                tickerSymbol,
                tickerDailyData,
                // Sort date ascending
                // sortDataFunction: (a, b) => moment(a.Timestamp, 'YYYY-MM-DD').diff(moment(b.Timestamp, 'YYYY-MM-DD')),
            }))
        )
    )
    // Combine multiple ticker training data sets
    .then(multipleTickerLastData => multipleTickerLastData.reduce((accumulator, lastSet) => {
        Object
            .keys(lastSet)
            .forEach(key => {
                accumulator[key] = lastSet[key];
            });
        return accumulator;
    }, {}))
    .then(lastInput => app
        .loadTrainedData()
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
            .then(tickerDailyData => axios
                .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/snapshot`, {
                    headers: {
                        'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                        'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                    }
                })
                .then(response => {
                    tickerDailyData.push({
                        Timestamp: response.data.dailyBar.t,
                        OpenPrice: response.data.dailyBar.o,
                        ClosePrice: response.data.dailyBar.c,
                        HighPrice: response.data.dailyBar.h,
                        LowPrice: response.data.dailyBar.l,
                        Volume: response.data.dailyBar.v,
                        n: response.data.dailyBar.n,
                        vw: response.data.dailyBar.vw,
                    });
                    return tickerDailyData;
                })
            )
            .then(tickerDailyData => app.createLastInput({
                tickerSymbol,
                tickerDailyData,
                // Sort date ascending
                // sortDataFunction: (a, b) => moment(a.Timestamp, 'YYYY-MM-DD').diff(moment(b.Timestamp, 'YYYY-MM-DD')),
            }))
        )
    )
    // Combine multiple ticker training data sets
    .then(multipleTickerLastData => multipleTickerLastData.reduce((accumulator, tickerLastTrainingSet) => {
        Object
            .keys(tickerLastTrainingSet)
            .forEach(key => {
                accumulator[key] = tickerLastTrainingSet[key];
            });
        return accumulator;
    }, {}))
    .then(lastInput => app
        .loadTrainedData()
        .then(model => {
            console.log("Tomorrow's result:", model.run(lastInput));
        })
    )
    .catch(error => console.log(`Error: ${error}`));
