import FileService from '../util/FileService.js';

const fileService = new FileService();

export default class VolumeProfile {
    __volumeProfile = new Map();

    init(tickerSymbol) {
        if (this.__volumeProfile.size > 0) {
            console.log('Volume Profile already populated');
            return Promise.resolve();
        }

        return fileService
            .readJSONFile(`./data/volumeProfile/${tickerSymbol}.json`)
            .then(obj => {
                if (Object.keys(obj).length === 0) {
                    this.reCreateVolumeProfile(tickerSymbol);
                } 
                else {
                    Object
                        .keys(obj)
                        .forEach(price => {
                            this.__volumeProfile.set(price, obj[price])
                        })
                }
            });
    }

    reCreateVolumeProfile(tickerSymbol) {
        // get data from ticker symbol
        return fileService
            .readJSONFile(`./data/tickers/${tickerSymbol}.json`)
            .then(candlestickCollection => {
                return candlestickCollection
                    .reduce((promise, rawCandlestick) => promise.then(() => {
                        const temp = [];
                        for (let i = rawCandlestick.LowPrice; i <= rawCandlestick.HighPrice; i = this.precision(i + 0.01)) {
                            temp.push(i);
                        }
                        const averageVolume = rawCandlestick.Volume / temp.length;
                        new Set(temp).forEach(price => {
                            this.__volumeProfile.set(
                                price, 
                                this.__volumeProfile.has(price)
                                    ? this.precision(this.__volumeProfile.get(price) + averageVolume)
                                    : this.precision(averageVolume)
                            );
                        });
                    }), Promise.resolve());
            })
            // save into json file
            .then(() => fileService.writeToJSONFile({
                jsonfilepath: `./data/volumeProfile/${tickerSymbol}.json`,
                data: Object.fromEntries(this.__volumeProfile),
            }));
    }

    precision(value) {
        return parseFloat(value.toFixed(5));
    }

    getVolumeProfile(price) {
        return this.__volumeProfile.get(`${price}`);
    }

    update(candlestick) {
        const temp = [];
        for (let i = candlestick.getLow(); i <= candlestick.getHigh(); i = this.precision(i + 0.01)) {
            temp.push(i);
        }
        const averageVolume = candlestick.getVolume() / temp.length;
        new Set(temp).forEach(price => {
            this.__volumeProfile.set(
                price, 
                this.__volumeProfile.has(price)
                    ? this.precision(this.__volumeProfile.get(price) + averageVolume)
                    : this.precision(averageVolume)
            );
        });
    }
}

// const test = new VolumeProfile();
// test
//     .init('QQQ')
//     .then(() => test
//         .init('QQQ')
//         .then(() => console.log(test.getVolumeProfile('408.71'))));