import moment from 'moment';
import App from './app.js';

const app = new App();
const listOfTickers = [
    'DJIA', 
    'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXY', 
    'GLD', 'GOVT', 'GOVZ', 
    'IEF', 'IEI',
    'MID',
    'NDX',
    'RUT',
    'SGOV', 'SHY', 'SPX',
    'TLH', 'TLT',
    'VIX',
];

Promise
    .all(listOfTickers.map(tickerSymbol => app
        .readFromCSVFileToJson(`./csv_sample/${tickerSymbol}.csv`)
        .then(jsonData => app.createTrainingData({
            appendString: tickerSymbol,
            data: jsonData,
            numberOfElemet: 10,
            sortDataFunction: (a, b) => moment(a.Date, 'MM/DD/YYYY').diff(moment(b.Date, 'MM/DD/YYYY')),
        })
    )))
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
    // Load from saved training
    .then(trainingData => {
        return app
            .continueTraining(trainingData)
            .then(net => {
                const lastTrainingData = trainingData[trainingData.length - 1];
                console.log('result:', net.run(lastTrainingData.input));
                console.log('actual:', lastTrainingData.output);
            });
    })
    .catch(error => console.log(error));
