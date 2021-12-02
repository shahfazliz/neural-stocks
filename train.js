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
    // Test to find any set with different number of inputs
    .then(trainingDataSet => {
        console.log(`Total trainingDataSet.length = ${trainingDataSet.length}`);
        for (let i = 0; i < trainingDataSet.length - 1; i++) {
            const a = JSON.stringify(Object.keys(trainingDataSet[i].input));
            const b = JSON.stringify(Object.keys(trainingDataSet[i + 1].input));

            const c = JSON.parse(a);
            const d = JSON.parse(b);

            if (a !== b) {
                console.log(c.filter(x => !d.includes(x)));
                break;
            }

            if (c.length !== d.length) {
                console.log(`Input size not equal ${c.length} != ${d.length}`);
                break;
            }
        }
        return trainingDataSet;
    })
    // Randomize sequence using Fisher-Yates (aka Knuth) Shuffle
    .then(trainingDataSet => ArrayFn.randomize(trainingDataSet))
    // Create new training
    .then(trainingDataSet => app
        .startTraining(trainingDataSet)
        .then(model => {
            const lastTrainingData = ArrayFn.getLastElement(trainingDataSet);
            console.log('result:', model.run(lastTrainingData.input))
            console.log('actual:', lastTrainingData.output);
        })
    )
    .catch(error => console.log(`Error: ${error}`));
