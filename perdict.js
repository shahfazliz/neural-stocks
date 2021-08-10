import App from './app.js';
import axios from 'axios';

const app = new App();

// Perdict for today
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(data => app.createLastInput({
                appendString: tickerSymbol,
                data,
                // Sort date ascending
                // sortDataFunction: (a, b) => moment(a.Timestamp, 'YYYY-MM-DD').diff(moment(b.Timestamp, 'YYYY-MM-DD')),
            }))
        )
    )
    // Combine multiple training data sets
    .then(multipleLastData => {
        const lastInput = {};
        multipleLastData.forEach(lastSet => {
            Object
                .keys(lastSet)
                .forEach(key => {
                    lastInput[key] = lastSet[key];
                });

            Object
                .keys(lastSet)
                .forEach(key => {
                    lastInput[key] = lastSet[key];
                });
        });
        return lastInput;
    })
    .then(lastInput => {
        return app
            .loadTrainedData()
            .then(net => {
                console.log("Today's result:", net.run(lastInput));
            });
    })
    .catch(error => console.log(error));

// Perdict for tomorrow
Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            // Hijack data by adding today's daily quote
            .then(data => {
                return axios
                    .get(`https://data.alpaca.markets/v2/stocks/${tickerSymbol}/snapshot`, {
                        headers: {
                            'APCA-API-KEY-ID': process.env.APCA_API_KEY_ID,
                            'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY,
                        }
                    })
                    .then(response => {
                        data.push({
                            Timestamp: response.data.dailyBar.t,
                            OpenPrice: response.data.dailyBar.o,
                            ClosePrice: response.data.dailyBar.c,
                            HighPrice: response.data.dailyBar.h,
                            LowPrice: response.data.dailyBar.l,
                            Volume: response.data.dailyBar.v,
                            n: response.data.dailyBar.n,
                            vw: response.data.dailyBar.vw,
                        });
                        return data;
                    }) // or prevDailyBar
            })
            .then(data => app.createLastInput({
                appendString: tickerSymbol,
                data,
                // Sort date ascending
                // sortDataFunction: (a, b) => moment(a.Timestamp, 'YYYY-MM-DD').diff(moment(b.Timestamp, 'YYYY-MM-DD')),
            }))
        )
    )
    // Combine multiple training data sets
    .then(multipleLastData => {
        const lastInput = {};
        multipleLastData.forEach(lastSet => {
            Object
                .keys(lastSet)
                .forEach(key => {
                    lastInput[key] = lastSet[key];
                });

            Object
                .keys(lastSet)
                .forEach(key => {
                    lastInput[key] = lastSet[key];
                });
        });
        return lastInput;
    })
    .then(lastInput => {
        return app
            .loadTrainedData()
            .then(net => {
                console.log("Tomorrow's result:", net.run(lastInput));
            });
    })
    .catch(error => console.log(error));
