import brain from 'brain.js';
import fs from 'fs';
import { csvToJson } from './util/AdaptorCSV2JSON.js';
import moment from 'moment';

class App {
    constructor() {
        this
            .readFileToJson({
                filepath: './Download Data - INDEX_US_S&P US_SPX.csv',
            })
            .then((data) => {
                let trainingData = this.createTrainingData({
                    appendString: 'SPX',
                    data: data.sort((a, b) => moment(a.Date, 'MM/DD/YYYY').diff(moment(b.Date, 'MM/DD/YYYY'))),
                    numberOfElemet: 10,
                });

                // console.log(trainingData);

                const test = trainingData[trainingData.length - 1];

                // const net = new brain.NeuralNetwork(this._trainingOptions);
                // net.train(trainingData);

                this
                    .continueTraining('./trained.txt', trainingData)
                    .then((net) => {
                        const json = net.toJSON();

                        fs.writeFile('./trained.txt', JSON.stringify(json), function (error) {
                            if (error) {
                                console.log(error);
                            }
                        });

                        console.log('result:', net.run(test.input))
                        console.log('actual:', test.output);
                    });

                // const json = net.toJSON();

                // fs.writeFile('./trained.txt', JSON.stringify(json), function (error) {
                //     if (error) {
                //         console.log(error);
                //     }
                // });

                // console.log('result:', net.run(test.input))
                // console.log('actual:', test.output);
            });
    }

    _trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.5,
        errorThresh: 0.1,
        hiddenLayers: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
        iterations: 1000000,
        learningRate: 0.3,
        log: true,
    };

    /**
     * Read csv file then convert into json.
     * Returns Promise
     */
    readFileToJson({
        filepath = '',
    }) {
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

    createTrainingData({
        appendString = 'N/A',
        data = [],
        numberOfElemet = 10,
    }) {
        // Count max length to iterate
        // minus 1 because we want to start with second element onwards. this is due we need the previous day close to caluclate the difference with today
        const maxLength = (Math.floor((data.length - 1) / numberOfElemet) - 1) * numberOfElemet + 1;

        let result = [];
        for (let i = 1; i < maxLength; i++) {
            let subResult = {};
            let counter = 1;
            for (let j = i; j < i + numberOfElemet; j++) {
                Object
                    .keys(data[j])
                    .forEach(function(key) {
                        // Copy all values
                        // subResult[`${appendString}_${key}_${counter}`] = key === 'Date'
                        //     ? moment(data[j][key], 'MM/DD/YYYY').unix()
                        //     : parseFloat(data[j][key].replace(/,/, ''));
                        
                        // Copy only the prices
                        // if (key !== 'Date') {
                        //     subResult[`${appendString}_${key}_${counter}`] = parseFloat(data[j][key].replace(/,/, ''));
                        // }

                        const yesterdayClose = parseFloat(data[j - 1]['Close'].replace(/,/, ''));
                        const todayOpen = parseFloat(data[j]['Open'].replace(/,/, ''));
                        const todayClose = parseFloat(data[j]['Close'].replace(/,/, ''));
                        const todayHigh = parseFloat(data[j]['High'].replace(/,/, ''));
                        const todayLow = parseFloat(data[j]['Low'].replace(/,/, ''));

                        // For debugging, see the dates
                        // subResult[`${appendString}_Date_${counter}`] = data[j]['Date'];

                        // Calculate difference with today
                        subResult[`${appendString}_Open_${counter}`] = todayOpen - yesterdayClose;
                        subResult[`${appendString}_Close_${counter}`] = todayClose - yesterdayClose;

                        subResult[`${appendString}_High_${counter}`] = todayOpen <= todayClose 
                            ? todayHigh - todayClose
                            : todayHigh - todayOpen;
                        subResult[`${appendString}_Low_${counter}`] = todayOpen <= todayClose
                            ? todayLow - todayOpen
                            : todayLow - todayClose;
                    });
                counter += 1;
            }

            // To long or to short 
            const value = parseFloat(data[i + numberOfElemet]
                    .Close
                    .replace(/,/, '')) 
                - parseFloat(data[i + numberOfElemet - 1]
                    .Close
                    .replace(/,/, ''));

            // Push the input and output objects for training
            result.push({ 
                input: subResult,
                output: {
                    [`${appendString}_Long`]: value >= 0 ? 1 : 0,
                    [`${appendString}_Short`]: value <= 0 ? 1 : 0,
                },
            });
        }
        return result;
    }

    continueTraining(filepath, trainingData) {
        return new Promise((resolve, reject) => {
            this
                .loadBrain(filepath)
                .then((net) => {
                    net.train(trainingData, this._trainingOptions);
                    return resolve(net);
                });
        });
    }

    loadBrain(filepath) {
        return new Promise((resolve, reject) => {
            // Use the trained file
            fs.readFile(
                filepath, 
                'utf8', 
                (error, data) => {
                    if (error) {
                        return reject(error);
                    }
                    
                    const net = new brain.NeuralNetwork();
                    net.fromJSON(JSON.parse(data));
                    // console.log('result:', net.run(test.input))
                    // console.log('actual:', test.output);

                    return resolve(net);
                });
        });
    }
}

const app = new App();