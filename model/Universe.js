import App from '../app.js';
import CollectionService from '../resource/CollectionService.js';

const app = new App();
const collectionService = new CollectionService();
export default class Universe {
    __universe = [];

    constructor(json) {
        this.__universe = json;
    }
    
    createTickerWorld({
        candlestickCollection,
        numberOfCandles = app.__numberOfCandles,
        tickerSymbol = 'N/A',
    }) {
        return new Promise((resolve, reject) => {
            console.log(`Create world for ${tickerSymbol}`);
            // Test the minimum amount of required candles
            const totalCandlestick = candlestickCollection.length();
            if (totalCandlestick < numberOfCandles + app.__numberOfCandlesAYear) {
                return reject(`number of candle is ${totalCandlestick}, it is less than required candle of ${numberOfCandles}`);
            }

            return resolve(candlestickCollection
                .map((candlestick, index) => {
                    if (index > app.__numberOfCandlesAYear) {
                        // const replaceDateWithCount = (index - app.__numberOfCandlesAYear) % numberOfCandles;
                        const map = new Map();

                        // For debugging, see the dates
                        // map.set(`${tickerSymbol}_Timestamp_${replaceDateWithCount}`, candlestick.getTimestamp());
                        // map.set(`${tickerSymbol}_Day_${replaceDateWithCount}`, candlestick.getDay());
                        // map.set(`${tickerSymbol}_Month_${replaceDateWithCount}`, candlestick.getMonth());
                        map.set(`Day`, candlestick.getDay()); // Need days to know Mon, Wed, Fri trading days
                        map.set(`Month`, candlestick.getMonth()); // Need month to know when to withdraw
                        map.set(`${tickerSymbol}_OpenPrice`, candlestick.getOpenDiff());
                        map.set(`${tickerSymbol}_ClosePrice`, candlestick.getCloseDiff());
                        map.set(`${tickerSymbol}_Volume`, candlestick.getVolumeDiff());
                        map.set(`${tickerSymbol}_HighPrice`, candlestick.getHighDiff());
                        map.set(`${tickerSymbol}_LowPrice`, candlestick.getLowDiff());
                        map.set(`${tickerSymbol}_VolumeProfile`, candlestick.getVolumeProfileDiff());
                        map.set(`${tickerSymbol}_StandardDeviation`, candlestick.getStandardDeviation());

                        return map;
                    }
                })
                .filter(val => val !== undefined)
            );
        });
    }

    createUniverse() {
        return Promise
            .all(app
                .__listOfTickers
                .map(tickerSymbol => collectionService
                    .readJSONFileAsCandlestickCollection(`./data/tickers/${tickerSymbol}.json`)
                    .then(candlestickCollection => {
                        // console.log(candlestickCollection);
                        return this.createTickerWorld({
                            candlestickCollection,
                            tickerSymbol,
                        });
                    })
                )
            )
            // Combine multiple worlds
            .then(multipleWorlds => {
                console.log(`Combine worlds to a universe`);
                const result = [];
                const totalMapsPerWorld = multipleWorlds[0].length;

                // Check if all worlds have same amount of entries
                for (let i = 0; i < multipleWorlds.length; i++) {
                    if (multipleWorlds[i].length !== totalMapsPerWorld) {
                        const firstSymbol = this.extractSymbolFromString([...multipleWorlds[0][0].keys()][2]);
                        const secondSymbol = this.extractSymbolFromString([...multipleWorlds[i][0].keys()][2]);

                        return Promise.reject(`Worlds does not have the same amount of entries ${firstSymbol}(${totalMapsPerWorld}) vs. ${secondSymbol}(${multipleWorlds[i].length})`);
                    }
                }

                for (let originalMapIndex = 0; originalMapIndex < totalMapsPerWorld; originalMapIndex++) {
                    let map = new Map();

                    for (let tickerIndex = 0; tickerIndex < multipleWorlds.length; tickerIndex++) {
                        let entry = multipleWorlds[tickerIndex][originalMapIndex].entries();
                        let value = entry.next().value;

                        // Copy to new map
                        while (value !== undefined) {
                            map.set(...value);
                            value = entry.next().value;
                        }

                        // Delete the old map to save memory space
                        multipleWorlds[tickerIndex][originalMapIndex].clear();
                    }
                    result.push(map);
                }

                return result;
            })
            .catch(error => console.log(`Error: ${error}`));
    }

    extractSymbolFromString(str) {
        return str.match(/^.{6}/)[0];
    }
}