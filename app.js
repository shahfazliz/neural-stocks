import { csvToJson } from './util/AdaptorCSV2JSON.js';
import brain from 'brain.js';
import fs from 'fs';

export default class App {
    _trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.5,
        errorThresh: 0.1,
        hiddenLayers: [840, 840, 840, 840, 840],
        iterations: 1000000,
        learningRate: 0.3,
        log: true,
    };

    __trainedFilePath = './trained.txt';

    __listOfTickers = [
        'CYB',
        'DIA',
        'EEM',
        'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXY',
        'GDX', 'GDXJ', 'GLD', 'GOVT', // 'GOVZ', // <-- problem, too recent
        'IEF', 'IEI', 'IWM', 'IYT',
        // 'MID', // <-- problem, too recent
        'QQQ',
        'SHY', 'SPY', // 'SGOV',  // <-- problem, too recent
        'TLH', 'TLT',
        'UUP',
        'VXX',
        'XLE', 'XLF', 'XLI',
    ];

    getListOfTickers() {
        return this.__listOfTickers;
    }

    /**
     * Read csv file then convert into json.
     */
    readFromCSVFileToJson(csvfilepath) {
        return new Promise((resolve, reject) => {
            fs.readFile(
                csvfilepath,
                'utf8',
                (error, data) => {
                    return error
                        ? reject(error)
                        : resolve(csvToJson(data));
                });
        });
    }

    /**
     * Read json file
     */
    readFromJSONFile(jsonfilepath) {
        return new Promise((resolve, reject) => {
            fs.readFile(
                jsonfilepath,
                (error, data) => {
                    return error
                        ? reject(error)
                        : resolve(JSON.parse(data));
                });
        });
    }

    /**
     * Create training data with output
     */
    createTrainingData({
        appendString = 'N/A',
        data = [],
        limitTrainingSet = 60,
        numberOfElement = 30,
        sortDataFunction,
    }) {
        return new Promise((resolve, reject) => {
            if (data.length - 2 < numberOfElement) {
                return reject(`number of element is less than ${numberOfElement + 2}`);
            }

            data = sortDataFunction !== null
                && typeof(sortDataFunction) === 'function'
                ? data.sort(sortDataFunction)
                : data

            data = limitTrainingSet
                ? data.slice(data.length - limitTrainingSet - 3)
                : data;

            const startIndex = 1;
            const maxIndexToIterate = data.length - numberOfElement - 1;

            let result = [];

            // For each data, iterate until maxIndexToIterate
            for (let i = startIndex; i <= maxIndexToIterate; i++) {
                let subResult = {};
                let replaceDateWithCount = 1;

                // Group data from i to numberOfElements into an object
                for (let j = i; j < i + numberOfElement; j++) {
                    Object
                        .keys(data[j]) // ['OpenPrice', 'ClosePrice', 'HighPrice', 'LowPrice', 'Volume']
                        .forEach(key => {

                            let yesterdayClosePrice = data[j - 1].ClosePrice;
                            yesterdayClosePrice = typeof(yesterdayClosePrice) === 'string'
                                ? parseFloat(yesterdayClosePrice.replace(/,/, ''))
                                : yesterdayClosePrice;

                            let todayOpenPrice = data[j].OpenPrice;
                            todayOpenPrice = typeof(todayOpenPrice) === 'string'
                                ? parseFloat(todayOpenPrice.replace(/,/, ''))
                                : todayOpenPrice;

                            let todayClosePrice = data[j].ClosePrice;
                            todayClosePrice = typeof(todayClosePrice) === 'string'
                                ? parseFloat(todayClosePrice.replace(/,/, ''))
                                : todayClosePrice;

                            let todayHighPrice = data[j].HighPrice;
                            todayHighPrice = typeof(todayHighPrice) === 'string'
                                ? parseFloat(todayHighPrice.replace(/,/, ''))
                                : todayHighPrice;

                            let todayLowPrice = data[j].LowPrice;
                            todayLowPrice = typeof(todayLowPrice) === 'string'
                                ? parseFloat(todayLowPrice.replace(/,/, ''))
                                : todayLowPrice;

                            let yesterdayVolume = data[j - 1].Volume;
                            yesterdayVolume = typeof(yesterdayVolume) === 'string'
                                ? parseFloat(yesterdayVolume.replace(/,/, ''))
                                : yesterdayVolume;

                            let todayVolume = data[j].Volume;
                            todayVolume = typeof(todayVolume) === 'string'
                                ? parseFloat(todayVolume.replace(/,/, ''))
                                : todayVolume;

                            // For debugging, see the dates
                            // subResult[`${appendString}_Timestamp_${replaceDateWithCount}`] = data[j]['Timestamp'];

                            // Calculate difference with today
                            subResult[`${appendString}_OpenPrice_${replaceDateWithCount}`] = todayOpenPrice - yesterdayClosePrice;
                            subResult[`${appendString}_ClosePrice_${replaceDateWithCount}`] = todayClosePrice - yesterdayClosePrice;
                            subResult[`${appendString}_Volume_${replaceDateWithCount}`] = todayVolume - yesterdayVolume;
                            subResult[`${appendString}_HighPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                                ? todayHighPrice - todayClosePrice
                                : todayHighPrice - todayOpenPrice;
                            subResult[`${appendString}_LowPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                                ? todayLowPrice - todayOpenPrice
                                : todayLowPrice - todayClosePrice;
                        });
                    replaceDateWithCount += 1;
                }

                // To long or to short
                let lastDayPlusOneClosePrice =  data[i + numberOfElement].ClosePrice;
                lastDayPlusOneClosePrice = typeof(lastDayPlusOneClosePrice) === 'string'
                    ? parseFloat(lastDayPlusOneClosePrice.replace(/,/, ''))
                    : lastDayPlusOneClosePrice;

                let lastDayClosePrice =  data[i + numberOfElement - 1].ClosePrice;
                lastDayClosePrice = typeof(lastDayClosePrice) === 'string'
                    ? parseFloat(lastDayClosePrice.replace(/,/, ''))
                    : lastDayClosePrice;

                const outputValue = lastDayPlusOneClosePrice - lastDayClosePrice;

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
                net.train(
                    trainingData,
                    // this._trainingOptions,
                    Object.assign(this._trainingOptions, {keepNetworkIntact: true}),
                );

                return this.saveTraining(net);
            });
    }

    createLastInput({
        appendString = 'N/A',
        data = [],
        numberOfElement = 30,
        sortDataFunction,
    }) {
        return new Promise((resolve, reject) => {
            if (data.length < numberOfElement) {
                return reject(`number of element is less than ${numberOfElement}`);
            }

            data = sortDataFunction !== null
                && typeof(sortDataFunction) === 'function'
                ? data.sort(sortDataFunction)
                : data

            data = data.slice(data.length - numberOfElement - 1);

            // Create the last set without output
            let result = {};
            let replaceDateWithCount = 1;

            for (let k = data.length - numberOfElement; k < data.length; k++) {
                Object
                    .keys(data[k]) // ['OpenPrice', 'ClosePrice', 'HighPrice', 'LowPrice']
                    .forEach(key => {

                        let yesterdayClosePrice = data[k - 1].ClosePrice;
                        yesterdayClosePrice = typeof(yesterdayClosePrice) === 'string'
                            ? parseFloat(yesterdayClosePrice.replace(/,/, ''))
                            : yesterdayClosePrice;

                        let todayOpenPrice = data[k].OpenPrice;
                        todayOpenPrice = typeof(todayOpenPrice) === 'string'
                            ? parseFloat(todayOpenPrice.replace(/,/, ''))
                            : todayOpenPrice;

                        let todayClosePrice = data[k].ClosePrice;
                        todayClosePrice = typeof(todayClosePrice) === 'string'
                            ? parseFloat(todayClosePrice.replace(/,/, ''))
                            : todayClosePrice;

                        let todayHighPrice = data[k].HighPrice;
                        todayHighPrice = typeof(todayHighPrice) === 'string'
                            ? parseFloat(todayHighPrice.replace(/,/, ''))
                            : todayHighPrice;

                        let todayLowPrice = data[k].LowPrice;
                        todayLowPrice = typeof(todayLowPrice) === 'string'
                            ? parseFloat(todayLowPrice.replace(/,/, ''))
                            : todayLowPrice;

                        let yesterdayVolume = data[k - 1].Volume;
                        yesterdayVolume = typeof(yesterdayVolume) === 'string'
                            ? parseFloat(yesterdayVolume.replace(/,/, ''))
                            : yesterdayVolume;

                        let todayVolume = data[k].Volume;
                        todayVolume = typeof(todayVolume) === 'string'
                            ? parseFloat(todayVolume.replace(/,/, ''))
                            : todayVolume;

                        // For debugging, see the dates
                        // result[`${appendString}_Timestamp_${replaceDateWithCount}`] = data[k]['Timestamp'];

                        // Calculate difference with today
                        result[`${appendString}_OpenPrice_${replaceDateWithCount}`] = todayOpenPrice - yesterdayClosePrice;
                        result[`${appendString}_ClosePrice_${replaceDateWithCount}`] = todayClosePrice - yesterdayClosePrice;
                        result[`${appendString}_Volume_${replaceDateWithCount}`] = todayVolume - yesterdayVolume;
                        result[`${appendString}_HighPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                            ? todayHighPrice - todayClosePrice
                            : todayHighPrice - todayOpenPrice;
                        result[`${appendString}_LowPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                            ? todayLowPrice - todayOpenPrice
                            : todayLowPrice - todayClosePrice;
                    });

                    replaceDateWithCount += 1;
            }

            return resolve(result);
        });
    }
}
