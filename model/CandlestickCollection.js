import ArrayFn from '../util/ArrayFn.js';
import Candlestick from './Candlestick.js';
import MomentAdaptor from '../util/MomentAdaptor.js';

export default class CandlestickCollection {
    __collection = [];

    constructor(rawCandlestickArrayOfObj) {
        // Sort the data by date ascending (older first, newer last)
        rawCandlestickArrayOfObj.sort((a, b) => new MomentAdaptor(a.Timestamp, 'YYYY-MM-DD')
            .isSameOrBefore(new MomentAdaptor(b.Timestamp, 'YYYY-MM-DD')))
            ? -1
            : 1;

        // Initialize each data into Candlestick object, then add into collection array
        rawCandlestickArrayOfObj
            .forEach(rawCandleStickObj => this.push(new Candlestick({
                close: rawCandleStickObj.ClosePrice,
                high: rawCandleStickObj.HighPrice,
                low: rawCandleStickObj.LowPrice,
                n: rawCandleStickObj.n,
                open: rawCandleStickObj.OpenPrice,
                timestamp: rawCandleStickObj.Timestamp,
                volume: rawCandleStickObj.Volume,
                vw: rawCandleStickObj.vw,
            })));
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
        // The first candlestick will not have diff because there is no previous candlestick
        if (!ArrayFn.isEmpty(this.__collection)) {
            const previousCandlestick = ArrayFn.getLastElement(this.__collection);

            candlestick.setOpenDiff(candlestick.getOpen() - previousCandlestick.getClose());
            candlestick.setCloseDiff(candlestick.getClose() - previousCandlestick.getClose());
            candlestick.setHighDiff(candlestick.getHigh() - previousCandlestick.getClose());
            candlestick.setLowDiff(candlestick.getLow() - previousCandlestick.getClose());
            candlestick.setVolumeDiff(candlestick.getVolume() - previousCandlestick.getVolume());

            candlestick.setLong(candlestick.getClose() - previousCandlestick.getLow() >= 0);
            candlestick.setShort(candlestick.getClose() - previousCandlestick.getHigh() <= 0);
        }

        this
            .__collection
            .push(candlestick);

        return this;
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

        this.__collection[index].setVolume(volume);
        this.__collection[index].setVolumeDiff(volume - previousCandlestick.getVolume());

        this.__collection[index].setOpen(openPrice);
        this.__collection[index].setOpenDiff(openPrice - previousCandlestick.getClose());

        this.__collection[index].setClose(closePrice);
        this.__collection[index].setCloseDiff(closePrice - previousCandlestick.getClose());

        this.__collection[index].setHigh(highPrice);
        this.__collection[index].setHighDiff(highPrice - previousCandlestick.getClose());

        this.__collection[index].setLow(lowPrice);
        this.__collection[index].setLowDiff(lowPrice - previousCandlestick.getClose());

        this.__collection[index].setLong(closePrice - previousCandlestick.getLow() >= 0);
        this.__collection[index].setShort(closePrice - previousCandlestick.getHigh() <= 0);

        return this;
    }
}
