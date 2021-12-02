import App from './app.js';
import ArrayFn from './util/ArrayFn.js';
import FileService from './util/FileService.js';

const app = new App();
const fileService = new FileService();

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => fileService
            .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
            .then(candlestickCollection => app.createTrainingData({
                tickerSymbol,
                candlestickCollection,
           }))
        )
    )
    // Combine multiple training data sets
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
    // Randomize sequence using Fisher-Yates (aka Knuth) Shuffle
    .then(trainingData => ArrayFn.randomize(trainingData))
    // Load from saved training
    .then(trainingData => app
        .continueTraining(trainingData)
        .then(model => {
            app.saveTraining(model);

            const lastTrainingData = ArrayFn.getLastElement(trainingData);
            console.log('result:', model.run(lastTrainingData.input));
            console.log('actual:', lastTrainingData.output);
        })
    )
    .catch(error => console.log(`Error: ${error}`));
