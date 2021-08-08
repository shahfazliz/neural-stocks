import brain from 'brain.js';
import fs from 'fs';
import { csvToJson } from './util/AdaptorCSV2JSON.js';
import moment from 'moment';

class App {
    _trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.5,
        errorThresh: 0.01,
        hiddenLayers: [840, 840, 840, 840, 840],
        iterations: 1000000,
        learningRate: 0.3,
        log: true,
    };

    __trainedFilePath = './trained.txt';

    /**
     * Read csv file then convert into json.
     */
    readFromCSVFileToJson(filepath) {
        return new Promise((resolve, reject) => {
            fs.readFile(
                filepath, 
                'utf8', 
                (error, data) => {
                    return error
                        ? reject(error)
                        : resolve(csvToJson(data));
                });
        });
    }

    /**
     * Create training data with output 
     */
    createTrainingData({
        appendString = 'N/A',
        data = [],
        numberOfElemet = 10,
        sortDataFunction,
    }) {
        return new Promise((resolve, reject) => {
            if (data.length - 2 < numberOfElemet) {
                return reject(`number of element is less than ${numberOfElemet + 2}`);
            }

            data = sortDataFunction !== null 
                && typeof(sortDataFunction) === 'function'
                ? data.sort(sortDataFunction)
                : data

            const startIndex = 1;
            const maxIndexToIterate = data.length - numberOfElemet - 1;

            let result = [];

            // For each data, iterate until maxIndexToIterate
            for (let i = startIndex; i <= maxIndexToIterate; i++) {
                let subResult = {};
                let replaceDateWithCount = 1;
                
                // Group data from i to numberOfElements into an object
                for (let j = i; j < i + numberOfElemet; j++) {
                    Object
                        .keys(data[j]) // ['Open', 'Close', 'High', 'Low']
                        .forEach(key => {
                            
                            let yesterdayClose = data[j - 1].Close; 
                            yesterdayClose = typeof(yesterdayClose) === 'string' 
                                ? parseFloat(yesterdayClose.replace(/,/, ''))
                                : yesterdayClose;
                            
                            let todayOpen = data[j].Open;
                            todayOpen = typeof(todayOpen) === 'string'
                                ? parseFloat(todayOpen.replace(/,/, ''))
                                : todayOpen;
                            
                            let todayClose = data[j].Close;
                            todayClose = typeof(todayClose) === 'string'
                                ? parseFloat(todayClose.replace(/,/, ''))
                                : todayClose;
                            
                            let todayHigh = data[j].High;
                            todayHigh = typeof(todayHigh) === 'string'
                                ? parseFloat(todayHigh.replace(/,/, ''))
                                : todayHigh;
                            
                            let todayLow = data[j].Low;
                            todayLow = typeof(todayLow) === 'string'
                                ? parseFloat(todayLow.replace(/,/, ''))
                                : todayLow;

                            // For debugging, see the dates
                            // subResult[`${appendString}_Date_${replaceDateWithCount}`] = data[j]['Date'];

                            // Calculate difference with today
                            subResult[`${appendString}_Open_${replaceDateWithCount}`] = todayOpen - yesterdayClose;
                            subResult[`${appendString}_Close_${replaceDateWithCount}`] = todayClose - yesterdayClose;
                            subResult[`${appendString}_High_${replaceDateWithCount}`] = todayOpen <= todayClose 
                                ? todayHigh - todayClose
                                : todayHigh - todayOpen;
                            subResult[`${appendString}_Low_${replaceDateWithCount}`] = todayOpen <= todayClose
                                ? todayLow - todayOpen
                                : todayLow - todayClose;
                        });
                    replaceDateWithCount += 1;
                }

                // To long or to short
                let lastDayPlusOneClose =  data[i + numberOfElemet].Close;
                lastDayPlusOneClose = typeof(lastDayPlusOneClose) === 'string'
                    ? parseFloat(lastDayPlusOneClose.replace(/,/, ''))
                    : lastDayPlusOneClose;

                let lastDayClose =  data[i + numberOfElemet - 1].Close;
                lastDayClose = typeof(lastDayClose) === 'string'
                    ? parseFloat(lastDayClose.replace(/,/, ''))
                    : lastDayClose;

                const outputValue = lastDayPlusOneClose - lastDayClose;

                // Push the input and output objects for training
                result.push({ 
                    input: subResult,
                    output: {
                        [`${appendString}_Long`]: outputValue >= 0 ? 1 : 0,
                        [`${appendString}_Short`]: outputValue <= 0 ? 1 : 0,
                    },
                });
            }

            return resolve(result);
        });
    }

    startTraining(trainingData) {
        return new Promise((resolve, reject) => {
            const net = new brain.NeuralNetwork(this._trainingOptions);
            net.train(trainingData);

            return this
                .saveTraining(net)
                .then(net => resolve(net))
                .catch(error => reject(error));
        });
    }

    saveTraining(net) {
        return new Promise((resolve, reject) => {
            fs.writeFile(
                this.__trainedFilePath, 
                JSON.stringify(net.toJSON()), 
                error => {
                    if (error) {
                        return reject(error);
                    }
                });
            
            return resolve(net);
        });
    }

    loadTrainedData() {
        return new Promise((resolve, reject) => {
            fs.readFile(
                this.__trainedFilePath, 
                'utf8', 
                (error, data) => {
                    if (error) {
                        return reject(error);
                    }
                    
                    const net = new brain.NeuralNetwork();
                    net.fromJSON(JSON.parse(data));
                    return resolve(net);
                });
        });
    }

    continueTraining(trainingData) {
        return this
            .loadTrainedData()
            .then(net => {
                net.train(trainingData, this._trainingOptions);

                return this.saveTraining(net);
            });
    }
}

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
    // // Load from saved training
    // .then(trainingData => {
    //     return app
    //         .continueTraining(trainingData)
    //         .then(net => {
    //             const lastTrainingData = trainingData[trainingData.length - 1];
    //             console.log('result:', net.run(lastTrainingData.input))
    //             console.log('actual:', lastTrainingData.output);
    //         });
    // })
    .catch(error => console.log(error));