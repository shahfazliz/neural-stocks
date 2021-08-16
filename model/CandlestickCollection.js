import ArrayFn from '../util/ArrayFn.js';
import Candlestick from './Candlestick.js';
import moment from 'moment';

export default class CandlestickCollection {
    __collection = [];

    constructor(rawCandlestickArrayOfObj) {
        // Sort the data by date ascending (older first, newer last)
        rawCandlestickArrayOfObj.sort((a, b) => moment(a.Timestamp, 'YYYY-MM-DD').diff(moment(b.Timestamp, 'YYYY-MM-DD')));

        // Initialize each data into Candlestick object, then add into collection array
        rawCandlestickArrayOfObj
            .forEach(rawCandleStickObj => this.push(new Candlestick({
                timestamp: rawCandleStickObj.Timestamp,
                open: rawCandleStickObj.OpenPrice,
                close: rawCandleStickObj.ClosePrice,
                high: rawCandleStickObj.HighPrice,
                low: rawCandleStickObj.LowPrice,
                volume: rawCandleStickObj.Volume,
            })));
    }

    getIndex(index) {
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
            candlestick.setHighDiff(candlestick.isBullCandle()
                ? candlestick.getHigh() - previousCandlestick.getClose()
                : candlestick.getHigh() - previousCandlestick.getOpen());
            candlestick.setLowDiff(candlestick.isBullCandle()
                ? candlestick.getLow() - previousCandlestick.getOpen()
                : candlestick.getLow() - previousCandlestick.getClose());
            candlestick.setVolumeDiff(candlestick.getVolume() - previousCandlestick.getVolume());

            candlestick.setLong(candlestick.getClose() - previousCandlestick.getClose() >= 0);
            candlestick.setShort(candlestick.getClose() - previousCandlestick.getClose() <= 0);
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
}
