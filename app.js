import { csvToJson } from './util/AdaptorCSV2JSON.js';
import { polynomial } from 'everpolate';
import brain from 'brain.js';
import CandlestickCollection from './model/CandlestickCollection.js';
import fs from 'fs/promises';

export default class App {
    __trainingOptions = {
        activation: 'sigmoid',
        binaryThresh: 0.2,
        errorThresh: 0.025,
        hiddenLayers: [25, 25, 25, 25],
        iterations: 3000,
        learningRate: 0.1,
        log: true,
        logPeriod: 1,
    };

    __numberOfElement = 50;

    __trainedFilePath = './trained.json';

    __listOfTickers = [
        'BAL',
        'CYB',
        'DBA', 'DIA',
        'EEM',
        'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXI', 'FXY',
        'GDX', 'GDXJ', 'GLD', 'GOVT',
        'IEF', 'IEI',
        'IWM',
        'IYT',
        'JJA',
        'NIB',
        'RJA', 'RJI',
        'QQQ',
        'SHY',
        'SPY',
        'TIP', 'TLH', 'TLT',
        'UNG', 'USO', 'UUP',
        'VXX',
        'XHB', 'XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XRT', 'XTL', 'XTN',
    ];

    __listOfTickersOfInterest = [
        'IWM',
        'QQQ',
        'SPY',
    ];

    getListOfTickers() {
        return this.__listOfTickers;
    }

    isTickerOfInterest(tickerSymbol) {
        return this
            .__listOfTickersOfInterest
            .includes(tickerSymbol);
    }

    /**
     * Read csv file then convert into json.
     */
    readFromCSVFileToJson(csvfilepath) {
        return csvToJson(csvfilepath);
    }

    /**
     * Read from json file as CandlestickCollection
     */
    readJSONFileAsCandlestickCollection(jsonfilepath) {
        console.log(`Reading from ${jsonfilepath}`);
        return fs
            .readFile(jsonfilepath)
            .then(rawJson => new CandlestickCollection(JSON.parse(rawJson)))
            // If file does not exist, create one
            .catch(() => this
                .writeToJSONFile({
                    jsonfilepath,
                })
                .then(() => new CandlestickCollection([]))
            );
    }

    /**
     * Read from json file as object
     */
     readJSONFile(jsonfilepath) {
        console.log(`Reading from ${jsonfilepath}`);
        return fs
            .readFile(jsonfilepath)
            .then(rawJson => JSON.parse(rawJson))
            // If file does not exist, create one
            .catch(() => this
                .writeToJSONFile({
                    jsonfilepath,
                    data: [],
                })
                .then(data => data)
            );
    }

    /**
     * Read json file
     */
    writeToJSONFile({
        jsonfilepath,
        data = [],
    }) {
        console.log(`Writing to ${jsonfilepath}`);
        return fs
            .writeFile(
                jsonfilepath,
                typeof data === 'string'
                    ? data
                    : JSON.stringify(
                        data,
                        undefined,
                        4
                    )
            )
            .then(data);
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

                // Build volume profile using polynomial interpolation
                const volumeProfile = {};
                const allPriceLevels = [];
                for (let j = i; j < i + numberOfElement; j++) {
                    const candlestick = candlestickCollection.getByIndex(j);

                    const maxPrice = Math.ceil(candlestick.getHigh());
                    const minPrice = Math.floor(candlestick.getLow());
                    const numberOfPriceLevels = (maxPrice - minPrice + 1);
                    const averageVolume = Math.floor(candlestick.getVolume() / numberOfPriceLevels);

                    for (let h = minPrice; h <= maxPrice; h++) {
                        volumeProfile[h] = volumeProfile[h] + averageVolume || averageVolume;
                    }

                    if (!allPriceLevels.includes(candlestick.getClose())) {
                        allPriceLevels.push(candlestick.getClose());
                    }
                }

                const volumeProfileInArray = Object
                    .keys(volumeProfile) // The price level
                    .reduce((accumulator, price) => {
                        accumulator
                            .prices
                            .push(price);

                        accumulator
                            .volume
                            .push(volumeProfile[price]);

                        return accumulator;
                    }, {prices: [], volume: []});

                const interpolatedVolumeProfile = polynomial(
                    allPriceLevels,
                    volumeProfileInArray.prices,
                    volumeProfileInArray.volume
                );

                // Normalize interpolated volume profile
                const maxVolume = Math.max(...interpolatedVolumeProfile);
                const minVolume = Math.min(...interpolatedVolumeProfile);
                const normalizedInterpolatedVolumeProfile = interpolatedVolumeProfile.map(volumeProfile => {
                    return (volumeProfile - minVolume) / (maxVolume - minVolume) || 0;
                });

                // Group candlestickCollection from i to numberOfElements into an object
                let subResult = {};
                let replaceDateWithCount = 1;
                for (let j = i; j < i + numberOfElement; j++) {
                    const candlestick = candlestickCollection.getByIndex(j);
                    // For debugging, see the dates
                    // subResult[`${tickerSymbol}_Timestamp_${replaceDateWithCount}`] = candlestick.getTimestamp();
                    subResult[`${tickerSymbol}_Day_${replaceDateWithCount}`] = candlestick.getDay();
                    subResult[`${tickerSymbol}_Month_${replaceDateWithCount}`] = candlestick.getMonth();

                    // Normalize candlestickCollectionArray by calculating difference with today and yesterday
                    subResult[`${tickerSymbol}_OpenPrice_${replaceDateWithCount}`] = candlestick.getOpenDiff();
                    subResult[`${tickerSymbol}_ClosePrice_${replaceDateWithCount}`] = candlestick.getCloseDiff();
                    subResult[`${tickerSymbol}_Volume_${replaceDateWithCount}`] = candlestick.getVolumeDiff();
                    subResult[`${tickerSymbol}_HighPrice_${replaceDateWithCount}`] = candlestick.getHighDiff();
                    subResult[`${tickerSymbol}_LowPrice_${replaceDateWithCount}`] = candlestick.getLowDiff();

                    // Add volume profile
                    subResult[`${tickerSymbol}_VolumeProfile_${replaceDateWithCount}`] = normalizedInterpolatedVolumeProfile[allPriceLevels.indexOf(candlestick.getClose())];

                    replaceDateWithCount += 1;
                }

                // Output Result only for tickers we are interested
                let outputResult = this.isTickerOfInterest(tickerSymbol)
                    ? {
                        [`${tickerSymbol}_Long`]: candlestickCollection
                            .getByIndex(i + numberOfElement)
                            .getLong() ? 1 : 0,
                        [`${tickerSymbol}_Short`]: candlestickCollection
                            .getByIndex(i + numberOfElement)
                            .getShort() ? 1 : 0,
                    }
                    : {};

                // Push the input and output objects for training
                result.push({
                    input: subResult,
                    output: outputResult,
                });
            }

            return resolve(result);
        });
    }

    startTraining(trainingData) {
        console.log(`Start training`);
        return new Promise((resolve, reject) => {
            const model = new brain.NeuralNetwork(this.__trainingOptions);
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
                    Object.assign(this.__trainingOptions, {keepNetworkIntact: true}),
                );

                return model;
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
            const totalCandlestick = candlestickCollection.length();
            if (totalCandlestick < numberOfElement) {
                return reject(`number of candle is ${totalCandlestick} is less than required candle of ${numberOfElement}`);
            }

            // Build volume profile using polynomial interpolation
            const volumeProfile = {};
            const allPriceLevels = [];
            for (let k = totalCandlestick - numberOfElement; k < totalCandlestick; k++) {
                const candlestick = candlestickCollection.getByIndex(k);

                const maxPrice = Math.ceil(candlestick.getHigh());
                const minPrice = Math.floor(candlestick.getLow());
                const numberOfPriceLevels = (maxPrice - minPrice + 1);
                const averageVolume = Math.floor(candlestick.getVolume() / numberOfPriceLevels);

                for (let h = minPrice; h <= maxPrice; h++) {
                    volumeProfile[h] = volumeProfile[h] + averageVolume || averageVolume;
                }

                if (!allPriceLevels.includes(candlestick.getClose())) {
                    allPriceLevels.push(candlestick.getClose());
                }
            }

            const volumeProfileInArray = Object
                .keys(volumeProfile) // The price level
                .reduce((accumulator, price) => {
                    accumulator
                        .prices
                        .push(price);

                    accumulator
                        .volume
                        .push(volumeProfile[price]);

                    return accumulator;
                }, {prices: [], volume: []});

            const interpolatedVolumeProfile = polynomial(
                allPriceLevels,
                volumeProfileInArray.prices,
                volumeProfileInArray.volume
            );

            // Normalize interpolated volume profile
            const maxVolume = Math.max(...interpolatedVolumeProfile);
            const minVolume = Math.min(...interpolatedVolumeProfile);
            const normalizedInterpolatedVolumeProfile = interpolatedVolumeProfile.map(volumeProfile => {
                return (volumeProfile - minVolume) / (maxVolume - minVolume) || 0;
            });

            // Create the last set without output
            let result = {};
            let replaceDateWithCount = 1;
            for (let k = totalCandlestick - numberOfElement; k < totalCandlestick; k++) {
                const candlestick = candlestickCollection.getByIndex(k);
                // For debugging, see the dates
                // result[`${tickerSymbol}_Timestamp_${replaceDateWithCount}`] = candlestick.getTimestamp();
                result[`${tickerSymbol}_Day_${replaceDateWithCount}`] = candlestick.getDay();
                result[`${tickerSymbol}_Month_${replaceDateWithCount}`] = candlestick.getDay();

                // Normalize tickerDailyData by calculating difference with today and yesterday
                result[`${tickerSymbol}_OpenPrice_${replaceDateWithCount}`] = candlestick.getOpenDiff();
                result[`${tickerSymbol}_ClosePrice_${replaceDateWithCount}`] = candlestick.getCloseDiff();
                result[`${tickerSymbol}_Volume_${replaceDateWithCount}`] = candlestick.getVolumeDiff();
                result[`${tickerSymbol}_HighPrice_${replaceDateWithCount}`] = candlestick.getHighDiff();
                result[`${tickerSymbol}_LowPrice_${replaceDateWithCount}`] = candlestick.getLowDiff();

                // Add volume profile
                result[`${tickerSymbol}_VolumeProfile_${replaceDateWithCount}`] = normalizedInterpolatedVolumeProfile[allPriceLevels.indexOf(candlestick.getClose())];

                replaceDateWithCount += 1;
            }

            return resolve(result);
        });
    }
}
