import { csvToJson } from './util/AdaptorCSV2JSON.js';
import brain from 'brain.js';
import CandlestickCollection from './model/CandlestickCollection.js';
import fs from 'fs/promises';

export default class App {
    _trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.3,
        errorThresh: 0.1,
        hiddenLayers: [100, 100, 100, 100],
        iterations: 3000,
        learningRate: 0.2,
        log: true,
        logPeriod: 1,
    };

    __numberOfElement = 50;

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
        'XHB', 'XLB', 'XLE', 'XLF', 'XLI', 'XLU', 'XLV',
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
            .then(rawJson => new CandlestickCollection(JSON.parse(rawJson)));
    }

    /**
     * Create training data with output
     */
    createTrainingData({
        tickerSymbol = 'N/A',
        candlestickCollection,
        numberOfElement = this.__numberOfElement,
    }) {
        console.log(`Create training data set for ticker ${tickerSymbol}`);
        return new Promise((resolve, reject) => {

            const numberOfElementBeforeFirstSet = 1; // We need previous day closing price to calculate difference with today
            const numberOfElementAfterLastSet = 1; // We need tomorrow's closing price to calculate to long/short

            // Test for the minimum amount of required candles
            const totalCandlestick = candlestickCollection.length();
            const numberOfRequiredCandle = numberOfElementBeforeFirstSet
                + numberOfElement
                + numberOfElementAfterLastSet;
            if (totalCandlestick < numberOfRequiredCandle) {
                return reject(`number of candle is ${totalCandlestick}, less than required candle of ${numberOfRequiredCandle}`);
            }

            const startIndex = 1; // Because index 0 is the previous close that we need to calculate difference with today
            const maxIndexToIterate = candlestickCollection.getLastIndex() - numberOfElement;

            let result = [];

            // For each candlestickCollection, iterate until maxIndexToIterate
            for (let i = startIndex; i <= maxIndexToIterate; i++) {
                let subResult = {};
                let replaceDateWithCount = 1;

                // Group candlestickCollection from i to numberOfElements into an object
                for (let j = i; j < i + numberOfElement; j++) {
                    // For debugging, see the dates
                    // subResult[`${tickerSymbol}_Timestamp_${replaceDateWithCount}`] = candlestickCollection
                    //     .getIndex(j)
                    //     .getTimestamp();

                    // Normalize candlestickCollectionArray by calculating difference with today and yesterday
                    subResult[`${tickerSymbol}_OpenPrice_${replaceDateWithCount}`] = candlestickCollection
                        .getIndex(j)
                        .getOpenDiff();
                    subResult[`${tickerSymbol}_ClosePrice_${replaceDateWithCount}`] = candlestickCollection
                        .getIndex(j)
                        .getCloseDiff();
                    subResult[`${tickerSymbol}_Volume_${replaceDateWithCount}`] = candlestickCollection
                        .getIndex(j)
                        .getVolumeDiff();
                    subResult[`${tickerSymbol}_HighPrice_${replaceDateWithCount}`] = candlestickCollection
                        .getIndex(j)
                        .getHighDiff();
                    subResult[`${tickerSymbol}_LowPrice_${replaceDateWithCount}`] = candlestickCollection
                        .getIndex(j)
                        .getLowDiff();

                    replaceDateWithCount += 1;
                }

                // Push the input and output objects for training
                result.push({
                    input: subResult,
                    output: {
                        [`${tickerSymbol}_Long`]: candlestickCollection
                            .getIndex(i + numberOfElement)
                            .getLong() ? 1 : 0,
                        [`${tickerSymbol}_Short`]: candlestickCollection
                            .getIndex(i + numberOfElement)
                            .getShort() ? 1 : 0,
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

    loadTrainedModel() {
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
            .loadTrainedModel()
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
        candlestickCollection,
        numberOfElement = this.__numberOfElement,
    }) {
        console.log(`Create last training data set for ticker ${tickerSymbol}`);
        return new Promise((resolve, reject) => {

            // Test the minimum amount of required candles
            const totalCandlestick = candlestickCollection.length()
            if (totalCandlestick < numberOfElement) {
                return reject(`number of candle is ${totalCandlestick} is less than required candle of ${numberOfElement}`);
            }

            // Create the last set without output
            let result = {};
            let replaceDateWithCount = 1;

            for (let k = totalCandlestick - numberOfElement; k < totalCandlestick; k++) {
                // For debugging, see the dates
                // result[`${tickerSymbol}_Timestamp_${replaceDateWithCount}`] = candlestickCollection
                //     .getIndex(k)
                //     .getTimestamp();

                // Normalize tickerDailyData by calculating difference with today and yesterday
                result[`${tickerSymbol}_OpenPrice_${replaceDateWithCount}`] = candlestickCollection
                    .getIndex(k)
                    .getOpenDiff();
                result[`${tickerSymbol}_ClosePrice_${replaceDateWithCount}`] = candlestickCollection
                    .getIndex(k)
                    .getCloseDiff();
                result[`${tickerSymbol}_Volume_${replaceDateWithCount}`] = candlestickCollection
                    .getIndex(k)
                    .getVolumeDiff();
                result[`${tickerSymbol}_HighPrice_${replaceDateWithCount}`] = candlestickCollection
                    .getIndex(k)
                    .getHighDiff();
                result[`${tickerSymbol}_LowPrice_${replaceDateWithCount}`] = candlestickCollection
                    .getIndex(k)
                    .getLowDiff();

                replaceDateWithCount += 1;
            }

            return resolve(result);
        });
    }
}
