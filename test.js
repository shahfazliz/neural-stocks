import App from './app.js';

const app = new App();

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readJSONFileAsCandlestickCollection(`./data/${tickerSymbol}.json`)
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
                    .forEach(key => { // eg. key: SPY_OpenPrice_1
                        accumulator[index]['input'][key] = trainingSet.input[key];
                    });

                // Set output
                Object
                    .keys(trainingSet.output)
                    .forEach(key => { // eg. key: SPY_Long
                        accumulator[index]['output'][key] = trainingSet.output[key];
                    });
            });
        });
        return accumulator;
    })
    .then(trainingDataSet => {
        // Initialize test result
        const testResult = app
            .getListOfTickers()
            .reduce((accumulator, tickerSymbol) => {
                accumulator[tickerSymbol] = {
                    correct: 0,
                    error: 0,
                };
                return accumulator;
            }, {});

        const treshold = 0.6;

        app
            .loadTrainedModel()
            .then(model => {
                trainingDataSet.forEach(dataSet => {
                    // Run trained model against all ticker data in json files
                    const trainingResult = model.run(dataSet.input);

                    // Take scores
                    app
                        .getListOfTickers()
                        .forEach(tickerSymbol => {

                            if (trainingResult[`${tickerSymbol}_Long`] >= treshold) {
                                if (dataSet.output[`${tickerSymbol}_Long`] === 1) {
                                    testResult[tickerSymbol].correct += 1;
                                } else {
                                    testResult[tickerSymbol].error += 1;
                                }
                            }

                            if (trainingResult[`${tickerSymbol}_Long`] < treshold) {
                                if (dataSet.output[`${tickerSymbol}_Long`] === 0) {
                                    testResult[tickerSymbol].correct += 1;
                                } else {
                                    testResult[tickerSymbol].error += 1;
                                }
                            }

                            if (trainingResult[`${tickerSymbol}_Short`] >= treshold) {
                                if (dataSet.output[`${tickerSymbol}_Short`] === 1) {
                                    testResult[tickerSymbol].correct += 1;
                                } else {
                                    testResult[tickerSymbol].error += 1;
                                }
                            }

                            if (trainingResult[`${tickerSymbol}_Short`] < treshold) {
                                if (dataSet.output[`${tickerSymbol}_Short`] === 0) {
                                    testResult[tickerSymbol].correct += 1;
                                } else {
                                    testResult[tickerSymbol].error += 1;
                                }
                            }
                        });
                });

                // Print scores
                // app
                //     .getListOfTickers()
                ['SPY', 'QQQ', 'IWM'] // I'm only interested in SPY, QQQ, and IWM
                    .forEach(tickerSymbol => {
                        const predictedCorrectly = testResult[tickerSymbol].correct;
                        const predictedWrongly = testResult[tickerSymbol].error;
                        const totalTrades = predictedCorrectly + predictedWrongly;

                        console.log(`${tickerSymbol} correct: ${predictedCorrectly}`);
                        console.log(`${tickerSymbol} error: ${predictedWrongly}`);
                        console.log(`${tickerSymbol} % error: ${predictedWrongly / totalTrades * 100} %`);
                    });
            });
    });
