import brain from 'brain.js';
import fs from 'fs';
import { csvToJson } from './util/AdaptorCSV2JSON.js';
import moment from 'moment';

class App {
    _trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.5,
        errorThresh: 0.1,
        hiddenLayers: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
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
                            
                            const yesterdayClose = parseFloat(data[j - 1]['Close'].replace(/,/, ''));
                            const todayOpen = parseFloat(data[j]['Open'].replace(/,/, ''));
                            const todayClose = parseFloat(data[j]['Close'].replace(/,/, ''));
                            const todayHigh = parseFloat(data[j]['High'].replace(/,/, ''));
                            const todayLow = parseFloat(data[j]['Low'].replace(/,/, ''));

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
                const outputValue = parseFloat(data[i + numberOfElemet]
                        .Close
                        .replace(/,/, '')) 
                    - parseFloat(data[i + numberOfElemet - 1]
                        .Close
                        .replace(/,/, ''));

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

app
    .readFromCSVFileToJson('./Download Data - INDEX_US_S&P US_SPX.csv') // from https://www.marketwatch.com/investing/index/spx/download-data
    .then((jsonData) => {
        return app.createTrainingData({
            appendString: 'SPX',
            data: jsonData,
            numberOfElemet: 10,
            sortDataFunction: (a, b) => moment(a.Date, 'MM/DD/YYYY').diff(moment(b.Date, 'MM/DD/YYYY')),
        });
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
    // Load from saved training
    // .then((trainingData) => {
    //     return app
    //         .continueTraining('./trained.txt', trainingData)
    //         .then(net => {
    //             const lastTrainingData = trainingData[trainingData.length - 1];
    //             console.log('result:', net.run(lastTrainingData.input))
    //             console.log('actual:', lastTrainingData.output);
    //         });
    // })
    .catch(error => console.log(error));