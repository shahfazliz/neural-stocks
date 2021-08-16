export default class Candlestick {
    __openDiff = 'N/A';
    __closeDiff = 'N/A';
    __highDiff = 'N/A';
    __lowDiff = 'N/A';
    __volumeDiff = 'N/A';
    __vwDiff = 'N/A';
    __nDiff = 'N/A';
    __long = false;
    __short = false;

    constructor({
        timestamp,
        open,
        close,
        high,
        low,
        volume,
        vw,
        n,
    }) {
        this.__timestamp = timestamp;
        this.__open = open;
        this.__close = close;
        this.__high = high;
        this.__low = low;
        this.__volume = volume;
        this.__vw = vw;
        this.__n = n;
    }

    getRawObject() {
        return {
            ClosePrice: this.__close,
            HighPrice: this.__high,
            LowPrice: this.__low,
            n: this.__n,
            OpenPrice: this.__open,
            Timestamp: this.__timestamp,
            Volume: this.__volume,
            vw: this.__vw,
        };
    }

    getTimestamp() {
        return this.__timestamp;
    }
    getOpen() {
        return this.__open;
    }
    getClose() {
        return this.__close;
    }
    getHigh() {
        return this.__high;
    }
    getLow() {
        return this.__low;
    }
    getVolume() {
        return this.__volume;
    }
    getVw() {
        return this.__vw;
    }
    getN() {
        return this.__n;
    }

    setOpenDiff(openDiff) {
        this.__openDiff = openDiff;
    }
    setCloseDiff(closeDiff) {
        this.__closeDiff = closeDiff;
    }
    setHighDiff(highDiff) {
        this.__highDiff = highDiff;
    }
    setLowDiff(lowDiff) {
        this.__lowDiff = lowDiff;
    }
    setVolumeDiff(volumeDiff) {
        this.__volumeDiff = volumeDiff;
    }
    setVwDiff(vwDiff) {
        this.__vwDiff = vwDiff;
    }
    setNDiff(nDiff) {
        this.__nDiff = nDiff;
    }

    getOpenDiff() {
        return this.__openDiff;
    }
    getCloseDiff() {
        return this.__closeDiff;
    }
    getHighDiff() {
        return this.__highDiff;
    }
    getLowDiff() {
        return this.__lowDiff;
    }
    getVolumeDiff() {
        return this.__volumeDiff;
    }
    getVwDiff() {
        return this.__vwDiff;
    }
    getNDiff() {
        return this.__nDiff;
    }

    setLong(isLong) {
        this.__long = isLong;
        return this;
    }

    setShort(isShort) {
        this.__short = isShort;
        return this;
    }

    getLong() {
        return this.__long;
    }

    getShort() {
        return this.__short;
    }

    isBullCandle() {
        return this.__close >= this.__open;
    }

    isBearCandle() {
        return this.__open >= this.__close;
    }
}
