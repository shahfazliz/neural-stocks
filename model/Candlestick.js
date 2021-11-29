import MomentAdaptor from "../util/MomentAdaptor.js";

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

    setOpen(value) {
        this.__open = value;
    }
    setClose(value) {
        this.__close = value;
    }
    setHigh(value) {
        this.__high = value;
    }
    setLow(value) {
        this.__low = value;
    }
    setVolume(value) {
        this.__volume = value;
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
    getDay() {
        return new MomentAdaptor(this.__timestamp, 'YYYY-MM-DD').day();
    }
    getMonth() {
        return new MomentAdaptor(this.__timestamp, 'YYYY-MM-DD').month();
    }

    getStandardDeviation() {
        return this.__standardDeviation;
    }

    getVolumeProfile() {
        return this.__volumeProfile;
    }

    setVolumeProfile(volumeProfile) {
        this.__volumeProfile = volumeProfile;
        return this;
    }

    setStandardDeviation(standardDeviation) {
        this.__standardDeviation = standardDeviation;
        return this;
    }

    setOpenDiff(openDiff) {
        this.__openDiff = openDiff;
        return this;
    }
    setCloseDiff(closeDiff) {
        this.__closeDiff = closeDiff;
        return this;
    }
    setHighDiff(highDiff) {
        this.__highDiff = highDiff;
        return this;
    }
    setLowDiff(lowDiff) {
        this.__lowDiff = lowDiff;
        return this;
    }
    setVolumeDiff(volumeDiff) {
        this.__volumeDiff = volumeDiff;
        return this;
    }
    setVwDiff(vwDiff) {
        this.__vwDiff = vwDiff;
        return this;
    }
    setNDiff(nDiff) {
        this.__nDiff = nDiff;
        return this;
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
