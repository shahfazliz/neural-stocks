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
                ? candlestick.getHigh() - candlestick.getClose()
                : candlestick.getHigh() - candlestick.getOpen());
            candlestick.setLowDiff(candlestick.isBullCandle()
                ? candlestick.getLow() - candlestick.getOpen()
                : candlestick.getLow() - candlestick.getClose());
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
}
