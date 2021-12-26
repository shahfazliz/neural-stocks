export default class Universe {
    __universe = [];

    constructor(json) {
        this.__universe = json;
    }
    
    createTickerWorld({
        candlestickCollection,
        numberOfCandles = this.__numberOfCandles,
        tickerSymbol = 'N/A',
    }) {
        return new Promise((resolve, reject) => {
            console.log(`Create world for ${tickerSymbol}`);
            // Test the minimum amount of required candles
            const totalCandlestick = candlestickCollection.length();
            if (totalCandlestick < numberOfCandles + this.__numberOfCandlesAYear) {
                return reject(`number of candle is ${totalCandlestick}, it is less than required candle of ${numberOfCandles}`);
            }

            return resolve(candlestickCollection
                .map((candlestick, index) => {
                    if (index > this.__numberOfCandlesAYear) {
                        // const replaceDateWithCount = (index - this.__numberOfCandlesAYear) % numberOfCandles;
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
            .all(this
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
                        return Promise.reject(`Worlds does not have the same amount of entries ${totalMapsPerWorld} vs. ${multipleWorlds[i].length}`);
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
}