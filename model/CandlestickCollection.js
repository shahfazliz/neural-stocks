import { linearRegression } from 'everpolate';
import ArrayFn from '../util/ArrayFn.js';
import Candlestick from './Candlestick.js';
import MomentAdaptor from '../util/MomentAdaptor.js';

export default class CandlestickCollection {
    __collection = [];
    __numberOfCandlesAYear = 252;

    constructor(rawCandlestickArrayOfObj) {
        // Sort the data by date ascending (older first, newer last)
        rawCandlestickArrayOfObj.sort((a, b) => new MomentAdaptor(a.Timestamp, 'YYYY-MM-DD')
            .isSameOrBefore(new MomentAdaptor(b.Timestamp, 'YYYY-MM-DD')))
            ? -1
            : 1;

        // Initialize each data into Candlestick object, then add into collection array
        rawCandlestickArrayOfObj
            .forEach((rawCandleStickObj, index) => {
                // console.log(`Pushing candlestick ${index}`)
                this.push(new Candlestick({
                    close: this.currency(rawCandleStickObj.ClosePrice),
                    high: this.currency(rawCandleStickObj.HighPrice),
                    low: this.currency(rawCandleStickObj.LowPrice),
                    n: rawCandleStickObj.n,
                    open: this.currency(rawCandleStickObj.OpenPrice),
                    timestamp: rawCandleStickObj.Timestamp,
                    volume: rawCandleStickObj.Volume,
                    vw: rawCandleStickObj.vw,
                }));
            });
    }

    currency(value) {
        return parseFloat(value.toFixed(2));
    }

    precision(value) {
        return parseFloat(value.toFixed(5));
    }

    getByIndex(index) {
        return this.__collection[index];
    }

    getLastIndex() {
        return ArrayFn.getLastIndex(this.__collection);
    }

    getLastElement() {
        return ArrayFn.getLastElement(this.__collection);
    }

    push(candlestick) {
        // console.log(`push candlestick: ${candlestick}`);
        // The first candlestick will not have diff because there is no previous candlestick
        if (!ArrayFn.isEmpty(this.__collection)) {
            const previousCandlestick = ArrayFn.getLastElement(this.__collection);
            const previousCandlestickClose = previousCandlestick.getClose();
            const previousCandlestickVolume = previousCandlestick.getVolume();

            candlestick
                .setOpenDiff(Math.log(candlestick.getOpen() / previousCandlestickClose))
                .setCloseDiff(Math.log(candlestick.getClose() / previousCandlestickClose))
                .setHighDiff(Math.log(candlestick.getHigh() / previousCandlestickClose))
                .setLowDiff(Math.log(candlestick.getLow() / previousCandlestickClose))
                .setVolumeDiff(Math.log(candlestick.getVolume() / previousCandlestickVolume))
                .setLong(candlestick.getClose() - previousCandlestick.getLow() >= 0)
                .setShort(candlestick.getClose() - previousCandlestick.getHigh() <= 0);

            // Set standard deviation and volume profile
            if (this.__collection.length > this.__numberOfCandlesAYear) {

                const oneYearCollection = this
                    .__collection
                    .slice(this.__collection.length - this.__numberOfCandlesAYear);

                candlestick.setStandardDeviation(this.calculateStandardDeviation(oneYearCollection.map(candlestickOfYear => {
                    // console.log(candlestickOfYear.getCloseDiff());
                    return candlestickOfYear.getCloseDiff();
                })));

                // Build volume profile using polynomial interpolation
                const volumeProfile = {};
                oneYearCollection.forEach(candlestickOfYear => {

                    const maxPrice = Math.ceil(candlestickOfYear.getHigh());
                    const minPrice = Math.floor(candlestickOfYear.getLow());
                    const numberOfPriceLevels = (maxPrice - minPrice + 1) * 100;
                    const averageVolume = Math.floor(candlestickOfYear.getVolume() / numberOfPriceLevels);

                    for (let h = minPrice; h <= maxPrice; h+=0.01) {
                        volumeProfile[h] = volumeProfile[h] + averageVolume || averageVolume;
                    }
                });

                let interpolatedVolumeProfile = linearRegression(
                    Object.keys(volumeProfile).map(val => parseFloat(val)),
                    Object.values(volumeProfile)
                ).evaluate([candlestick.getClose()])[0];


                candlestick.setVolumeProfile(this.precision(interpolatedVolumeProfile));
            }
        }

        this
            .__collection
            .push(candlestick);

        return this;
    }

    calculateStandardDeviation(numbers) {
        const mean = numbers.reduce((acc, value) => acc + value) / numbers.length;
        return this.precision(Math.sqrt(numbers.reduce((acc, value) => acc += (value - mean) ** 2, 0) / numbers.length));
    }

    length() {
        return this
            .__collection
            .length;
    }

    isEmpty() {
        return ArrayFn.isEmpty(this.__collection);
    }

    stringify() {
        return JSON.stringify(
            this
                .__collection
                .map(candlestick => candlestick.getRawObject()),
            undefined,
            4
        );
    }

    clone() {
        return new CandlestickCollection(JSON.parse(this.stringify()));
    }

    filter(callbackFunction) {
        return this
            .__collection
            .filter(callbackFunction);
    }

    getIndexByDate(date) {
        return this.__binarySearchCollectionByDate({
            startIndex: 0,
            endIndex: this.__collection.length - 1,
            needle: date
        });
    }

    __binarySearchCollectionByDate({
        startIndex,
        endIndex,
        needle,
    }) {
        let middleIndex = Math.floor(startIndex + (endIndex - startIndex) / 2);
        // console.log(this.__collection[middleIndex].getTimestamp());
        let middleIndexCandlestickDate = new MomentAdaptor(
            this.__collection[middleIndex].getTimestamp(),
            'YYYY-MM-DD'
        );

        if (startIndex === endIndex
            && !middleIndexCandlestickDate.isSame(needle)
        ) {
            return -1;
        }
        else if (middleIndexCandlestickDate.isSame(needle)) {
            return middleIndex;
        }
        else if (middleIndexCandlestickDate.isAfter(needle)){
            return this.__binarySearchCollectionByDate({
                startIndex,
                endIndex: middleIndex,
                needle
            });
        }
        else if (middleIndexCandlestickDate.isBefore(needle)) {
            return this.__binarySearchCollectionByDate({
                startIndex: middleIndex,
                endIndex,
                needle
            });
        }
    }

    updateByIndex(index, {
        openPrice,
        closePrice,
        highPrice,
        lowPrice,
        volume,
    }) {
        const previousCandlestick = this.__collection[index - 1];
        const previousCandlestickClose = previousCandlestick.getClose();
        const previousCandlestickVolume = previousCandlestick.getVolume();

        this.__collection[index].setVolume(volume);
        this.__collection[index].setVolumeDiff(Math.log(volume / previousCandlestickVolume));

        this.__collection[index].setOpen(openPrice);
        this.__collection[index].setOpenDiff(Math.log(openPrice / previousCandlestickClose));

        this.__collection[index].setClose(closePrice);
        this.__collection[index].setCloseDiff(Math.log(closePrice / previousCandlestickClose));

        this.__collection[index].setHigh(highPrice);
        this.__collection[index].setHighDiff(Math.log(highPrice / previousCandlestickClose));

        this.__collection[index].setLow(lowPrice);
        this.__collection[index].setLowDiff(Math.log(lowPrice / previousCandlestickClose));

        this.__collection[index].setLong(closePrice - previousCandlestick.getLow() >= 0);
        this.__collection[index].setShort(closePrice - previousCandlestick.getHigh() <= 0);

        return this;
    }

    map(callbackFunction) {
        return this.__collection.map(callbackFunction);
    }
}
