import App from './app.js';

const app = new App();

Promise
    .all(app
        .getListOfTickers()
        .map(tickerSymbol => app
            .readFromJSONFile(`./data/${tickerSymbol}.json`)
            .then(data => app.createTrainingData({
                appendString: tickerSymbol,
                data,
                // Sort date ascending
                // sortDataFunction: (a, b) => moment(a.Timestamp, 'YYYY-MM-DD').diff(moment(b.Timestamp, 'YYYY-MM-DD')),
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
                    .forEach(key => {
                        accumulator[index]['input'][key] = trainingSet.input[key];
                    });

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
    .then(trainingData => {
        let currentIndex = trainingData.length;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            let randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            let temp = trainingData[currentIndex];
            trainingData[currentIndex] = trainingData[randomIndex];
            trainingData[randomIndex] = temp;
        }

        return trainingData;
    })
    // Create new training
    .then(trainingData => {
        return app
            .startTraining(trainingData)
            .then(net => {
                const lastTrainingData = trainingData[trainingData.length - 1];
                console.log('result:', net.run(lastTrainingData.input))
                console.log('actual:', lastTrainingData.output);
            });
    })
    .catch(error => console.log(error));
