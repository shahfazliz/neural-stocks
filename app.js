import { csvToJson } from './util/AdaptorCSV2JSON.js';
import ArrayFn from './util/ArrayFn.js';
import brain from 'brain.js';
import fs from 'fs/promises';

export default class App {
    _trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.3,
        errorThresh: 0.18,
        hiddenLayers: [100, 100, 100, 100],
        iterations: 1000,
        learningRate: 0.3,
        log: true,
        logPeriod: 1,
    };

    __limitTrainingSet = 1100; // 1100 working days is slightly more than 4 years
    __numberOfElement = 35;

    __trainedFilePath = './trained.json';

    __listOfTickers = [
        'CYB',
        'DIA',
        'EEM',
        'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXI', 'FXY',
        'GDX', 'GDXJ', 'GLD', 'GOVT',
        'IEF', 'IEI', 'IWM', 'IYT',
        'QQQ',
        'SHY', 'SPY',
        'TIP', 'TLH', 'TLT',
        'UUP',
        'VXX',
        'XHB', 'XLB', 'XLE', 'XLF', 'XLI',
    ];

    getListOfTickers() {
        return this.__listOfTickers;
    }

    /**
     * Read csv file then convert into json.
     */
    readFromCSVFileToJson(csvfilepath) {
        return fs
            .readFile(csvfilepath)
            .then(data => csvToJson(data));
    }

    /**
     * Read json file
     */
    readFromJSONFile(jsonfilepath) {
        console.log(`Reading ${jsonfilepath}`);
        return fs
            .readFile(jsonfilepath)
            .then(data => JSON.parse(data));
    }

    /**
     * Create training data with output
     */
    createTrainingData({
        tickerSymbol = 'N/A',
        data = [],
        limitTrainingSet = this.__limitTrainingSet,
        numberOfElement = this.__numberOfElement,
        sortDataFunction,
    }) {
        console.log(`Create training data set for ticker ${tickerSymbol}`);
        return new Promise((resolve, reject) => {
            data = sortDataFunction !== null
                && typeof(sortDataFunction) === 'function'
                ? data.sort(sortDataFunction)
                : data

            const numberOfElementBeforeFirstSet = 1; // We need previous day closing price to calculate difference with today
            const numberOfElementAfterLastSet = 1; // We need tomorrow's closing price to calculate to long/short

            // Slice the sample data by limitTrainingSet
            if (limitTrainingSet) {
                const startIndexToSlice = ArrayFn.getLastIndex(data)
                    - numberOfElementBeforeFirstSet
                    - limitTrainingSet
                    - numberOfElementAfterLastSet;

                data = data.slice(startIndexToSlice);
            }

            const numberOfElementsLeft = data.length - numberOfElementBeforeFirstSet - numberOfElementAfterLastSet;
            const numberOfRequiredElement = numberOfElement + numberOfElementBeforeFirstSet + numberOfElementAfterLastSet;
            if (numberOfElementsLeft < numberOfRequiredElement) {
                return reject(`number of element left is ${numberOfElementsLeft}, less than required elemnt of ${numberOfRequiredElement}`);
            }

            const startIndex = 1; // Because index 0 is the previous close that we need to calculate difference with today
            const maxIndexToIterate = ArrayFn.getLastIndex(data) - numberOfElement;

            let result = [];

            // For each data, iterate until maxIndexToIterate
            for (let i = startIndex; i <= maxIndexToIterate; i++) {
                let subResult = {};
                let replaceDateWithCount = 1;

                // Group data from i to numberOfElements into an object
                for (let j = i; j < i + numberOfElement; j++) {
                    const yesterdayClosePrice = data[j - 1].ClosePrice;
                    const todayOpenPrice = data[j].OpenPrice;
                    const todayClosePrice = data[j].ClosePrice;
                    const todayHighPrice = data[j].HighPrice;
                    const todayLowPrice = data[j].LowPrice;
                    const yesterdayVolume = data[j - 1].Volume;
                    const todayVolume = data[j].Volume;

                    // For debugging, see the dates
                    // subResult[`${tickerSymbol}_Timestamp_${replaceDateWithCount}`] = data[j]['Timestamp'];

                    // Normalize data by calculating difference with today and yesterday
                    subResult[`${tickerSymbol}_OpenPrice_${replaceDateWithCount}`] = todayOpenPrice - yesterdayClosePrice;
                    subResult[`${tickerSymbol}_ClosePrice_${replaceDateWithCount}`] = todayClosePrice - yesterdayClosePrice;
                    subResult[`${tickerSymbol}_Volume_${replaceDateWithCount}`] = todayVolume - yesterdayVolume;
                    subResult[`${tickerSymbol}_HighPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                        ? todayHighPrice - todayClosePrice // Bull candle
                        : todayHighPrice - todayOpenPrice; // Bear candle
                    subResult[`${tickerSymbol}_LowPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                        ? todayLowPrice - todayOpenPrice // Bull candle
                        : todayLowPrice - todayClosePrice; // Bear candle
                    replaceDateWithCount += 1;
                }

                // To long or to short
                const lastDayPlusOneClosePrice =  data[i + numberOfElement].ClosePrice;
                const lastDayClosePrice =  data[i + numberOfElement - 1].ClosePrice;
                const outputValue = lastDayPlusOneClosePrice - lastDayClosePrice;

                // Push the input and output objects for training
                result.push({
                    input: subResult,
                    output: {
                        [`${tickerSymbol}_Long`]: outputValue >= 0 ? 1 : 0,
                        [`${tickerSymbol}_Short`]: outputValue <= 0 ? 1 : 0,
                    },
                });
            }

            return resolve(result);
        });
    }

    startTraining(trainingData) {
        console.log(`Start training`);
        return new Promise((resolve, reject) => {
            const model = new brain.NeuralNetwork(this._trainingOptions);
            model.train(trainingData);

            return this
                .saveTraining(model)
                .then(model => resolve(model))
                .catch(error => reject(error));
        });
    }

    saveTraining(model) {
        console.log(`Save training model to ${this.__trainedFilePath}`);
        return fs
            .writeFile(
                this.__trainedFilePath,
                JSON.stringify(model.toJSON(), undefined, 4)
            )
            .then(() => model);
    }

    loadTrainedData() {
        console.log(`Load training model from ${this.__trainedFilePath}`);
        return fs
            .readFile(this.__trainedFilePath)
            .then(data => {
                const model = new brain.NeuralNetwork();
                model.fromJSON(JSON.parse(data));
                return model;
            });
    }

    continueTraining(trainingData) {
        console.log(`Continue training`);
        return this
            .loadTrainedData()
            .then(model => {
                model.train(
                    trainingData,
                    Object.assign(this._trainingOptions, {keepNetworkIntact: true}),
                );

                return this.saveTraining(model);
            });
    }

    createLastInput({
        tickerSymbol = 'N/A',
        tickerDailyData = [],
        numberOfElement = this.__numberOfElement,
        sortDataFunction,
    }) {
        console.log(`Create last training data set for ticker ${tickerSymbol}`);
        return new Promise((resolve, reject) => {
            tickerDailyData = sortDataFunction !== null
                && typeof(sortDataFunction) === 'function'
                ? tickerDailyData.sort(sortDataFunction)
                : tickerDailyData

            tickerDailyData = tickerDailyData.slice(ArrayFn.getLastIndex(tickerDailyData) - numberOfElement);

            if (tickerDailyData.length < numberOfElement) {
                return reject(`number of elements left is ${tickerDailyData.length} is less than required of ${numberOfElement}`);
            }

            // Create the last set without output
            let result = {};
            let replaceDateWithCount = 1;

            for (let k = tickerDailyData.length - numberOfElement; k < tickerDailyData.length; k++) {
                const yesterdayClosePrice = tickerDailyData[k - 1].ClosePrice;
                const todayOpenPrice = tickerDailyData[k].OpenPrice;
                const todayClosePrice = tickerDailyData[k].ClosePrice;
                const todayHighPrice = tickerDailyData[k].HighPrice;
                const todayLowPrice = tickerDailyData[k].LowPrice;
                const yesterdayVolume = tickerDailyData[k - 1].Volume;
                const todayVolume = tickerDailyData[k].Volume;

                // For debugging, see the dates
                // result[`${tickerSymbol}_Timestamp_${replaceDateWithCount}`] = tickerDailyData[k]['Timestamp'];

                // Normalize tickerDailyData by calculating difference with today and yesterday
                result[`${tickerSymbol}_OpenPrice_${replaceDateWithCount}`] = todayOpenPrice - yesterdayClosePrice;
                result[`${tickerSymbol}_ClosePrice_${replaceDateWithCount}`] = todayClosePrice - yesterdayClosePrice;
                result[`${tickerSymbol}_Volume_${replaceDateWithCount}`] = todayVolume - yesterdayVolume;
                result[`${tickerSymbol}_HighPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                    ? todayHighPrice - todayClosePrice
                    : todayHighPrice - todayOpenPrice;
                result[`${tickerSymbol}_LowPrice_${replaceDateWithCount}`] = todayOpenPrice <= todayClosePrice
                    ? todayLowPrice - todayOpenPrice
                    : todayLowPrice - todayClosePrice;

                replaceDateWithCount += 1;
            }

            return resolve(result);
        });
    }
}
