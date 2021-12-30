import FileService from '../util/FileService.js';
import MathFn from '../util/MathFn.js';

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
                            this.__volumeProfile.set(`${price}`, obj[`${price}`])
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
                        for (let i = rawCandlestick.LowPrice; i <= rawCandlestick.HighPrice; i = MathFn.precision(i + 0.01)) {
                            temp.push(i);
                        }
                        const averageVolume = rawCandlestick.Volume / temp.length;
                        new Set(temp).forEach(price => {
                            this.__volumeProfile.set(
                                `${price}`, 
                                this.__volumeProfile.has(`${price}`)
                                    ? MathFn.precision(this.__volumeProfile.get(`${price}`) + averageVolume)
                                    : MathFn.precision(averageVolume)
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

    getVolumeProfile(price) {
        return this.__volumeProfile.get(`${price}`);
    }

    update(candlestick, debug) {
        const temp = [];
        for (let i = candlestick.getLow(); i <= candlestick.getHigh(); i = MathFn.precision(i + 0.01)) {
            temp.push(i);
        }
        const averageVolume = candlestick.getVolume() / temp.length;
        new Set(temp).forEach(price => {
            this.__volumeProfile.set(
                `${price}`, 
                this.__volumeProfile.has(`${price}`)
                    ? MathFn.precision(this.__volumeProfile.get(`${price}`) + averageVolume)
                    : MathFn.precision(averageVolume)
            );
            if (debug) {
                console.log(this.__volumeProfile.get(`${price}`));
            }
        });
    }
}

// const test = new VolumeProfile();
// test
//     .init('QQQ')
//     .then(() => test
//         .init('QQQ')
//         .then(() => console.log(test.getVolumeProfile('408.71'))));

// const test = new VolumeProfile();
// test.reCreateVolumeProfile('QQQ');