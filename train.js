import App from './app.js';
import ArrayFn from './util/ArrayFn.js';

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
        multipleTrainingData.forEach(trainingData => {
            trainingData.forEach((trainingSet, index) => {

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
    // Randomize sequence using Fisher-Yates (aka Knuth) Shuffle
    .then(trainingData => ArrayFn.randomize(trainingData))
    // Create new training
    .then(trainingData => app
        .startTraining(trainingData)
        .then(model => {
            const lastTrainingData = ArrayFn.getLastElement(trainingData);
            console.log('result:', model.run(lastTrainingData.input))
            console.log('actual:', lastTrainingData.output);
        })
    )
    .catch(error => console.log(`Error: ${error}`));
