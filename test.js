import App from './app.js';

const app = new App();

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(candlestickCollection => app.createTrainingData({
                tickerSymbol,
                candlestickCollection,
            }))
        )
    )
    // Combine multiple training data sets
    .then(multipleTrainingData => {
        console.log(`Combine multiple ticker training data sets`);
        const accumulator = [];
        multipleTrainingData.forEach(trainingDataSet => {
            trainingDataSet.forEach((trainingSet, index) => {

                // Initialize new training set to be combined
                if (!accumulator[index]) {
                    accumulator[index] = {
                        input: {},
                        output: {},
                    };
                }

                // Set input
                Object
                    .keys(trainingSet.input)
                    .forEach(key => {
                        accumulator[index]['input'][key] = trainingSet.input[key];
                    });

                // Set output
                Object
                    .keys(trainingSet.output)
                    .forEach(key => {
                        accumulator[index]['output'][key] = trainingSet.output[key];
                    });
            });
        });
        return accumulator;
    })
    .then(trainingDataSet => {
        const testResult = {
            SPY: {
                correct: 0,
                error: 0,
            },
            QQQ: {
                correct: 0,
                error: 0,
            },
            IWM: {
                correct: 0,
                error: 0,
            },
        };

        app
            .loadTrainedModel()
            .then(model => {
                trainingDataSet.forEach(dataSet => {
                    const result = model.run(dataSet.input);

                    ['SPY', 'QQQ', 'IWM'].forEach(tickerSymbol => {
                        // Take scores
                        if (dataSet.output[`${tickerSymbol}_Long`] === 1) {
                            testResult[tickerSymbol].correct += result[`${tickerSymbol}_Long`] >= 0.7 ? 1 : 0;
                            testResult[tickerSymbol].error += result[`${tickerSymbol}_Long`] < 0.7 ? 1 : 0;
                        }

                        if (dataSet.output[`${tickerSymbol}_Long`] === 0) {
                            testResult[tickerSymbol].correct += result[`${tickerSymbol}_Long`] < 0.7 ? 1 : 0;
                            testResult[tickerSymbol].error += result[`${tickerSymbol}_Long`] >= 0.7 ? 1 : 0;
                        }

                        if (dataSet.output[`${tickerSymbol}_Short`] === 1) {
                            testResult[tickerSymbol].correct += result[`${tickerSymbol}_Short`] >= 0.7 ? 1 : 0;
                            testResult[tickerSymbol].error += result[`${tickerSymbol}_Short`] < 0.7 ? 1 : 0;
                        }

                        if (dataSet.output[`${tickerSymbol}_Short`] === 0) {
                            testResult[tickerSymbol].correct += result[`${tickerSymbol}_Short`] < 0.7 ? 1 : 0;
                            testResult[tickerSymbol].error += result[`${tickerSymbol}_Short`] >= 0.7 ? 1 : 0;
                        }
                    });
                });

                ['SPY', 'QQQ', 'IWM'].forEach(tickerSymbol => {
                    console.log(`${tickerSymbol} correct: ${testResult[tickerSymbol].correct}`);
                    console.log(`${tickerSymbol} error: ${testResult[tickerSymbol].error}`);
                    console.log(`${tickerSymbol} % error: ${testResult[tickerSymbol].error / testResult[tickerSymbol].correct * 100}%`);
                });
            });
    })