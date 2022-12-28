
// New logic to calculate diff using new data source

// no earlier date because sometimes data just start much later
const ticker1s = {
    '3': {open: '1C', close: '2C', high: '3C', low: '0C'},
    '4': {open: '1D', close: '2D', high: '3D', low: '0D'},
    '5': {open: '1E', close: '2E', high: '3E', low: '0E'},
};

// no data at the end because some stock just stop trading for a while
const ticker10s = {
    '2': {open: '10B', close: '20B', high: '30B', low: '00B'},
    '3': {open: '10C', close: '20C', high: '30C', low: '00C'},
};

// no date in between because some stocks may close on certain days
const ticker100s = {
    '2': {open: '100B', close: '200B', high: '300B', low: '000B'},
    '4': {open: '100D', close: '200D', high: '300D', low: '000D'},
};

// simulate compile all data
const allCandlestickObjects = {
    ticker1s,
    ticker10s,
    ticker100s,
};

const allTickerSymbolNames = Object.keys(allCandlestickObjects);

const allCandlestickAttrs = ['open', 'close', 'high', 'low'];
// other attributes: volume, volume profile, 200ma, 100ma, 50ma

function findAvailableDate({data, startDateSearch}) {
    const yesterday = data[`${startDateSearch - 1}`];
    if (yesterday !== undefined) {
        return yesterday;
    }

    for(let i = 1;;i++) {
        const future = data[`${startDateSearch + i}`];
        if (future !== undefined) {
            return future;
        }
    }
}

// Fill up empty data and compile into an array
const compiledData = [];
let date = 1; // get start date from somewhere
while (date <= 5) { // maximum date available which is today
    const modifiedDataObj = {date}; // for debugging

    // loop each ticker symbols
    allTickerSymbolNames.forEach((tickerSymbol) => {
        // if data not available
        // use the last known data into the set so that the next statements will pickup
        // but if there is not last known data, we will use the next known data
        if (allCandlestickObjects[tickerSymbol][`${date}`] === undefined) {
            allCandlestickObjects[tickerSymbol][`${date}`] = findAvailableDate({
                data: allCandlestickObjects[tickerSymbol],
                startDateSearch: date,
            });;
        }

        allCandlestickAttrs.forEach((candlestickAttr) => {
            modifiedDataObj[`${tickerSymbol}_${candlestickAttr}`] 
                = allCandlestickObjects[tickerSymbol][`${date}`][candlestickAttr];
        });
    });

    compiledData.push(modifiedDataObj);
    date += 1; // increament date for next loop
} 

// Calculate Diff
date = 2; // get second date from start date. this is to start calculating the diff
for(let index = 1;; index++) {
    allTickerSymbolNames.forEach((tickerSymbol) => {
        allCandlestickAttrs.forEach((candlestickAttr) => {
            // calculate diff
            const prev = compiledData[index - 1][`${tickerSymbol}_${candlestickAttr}`];
            const now = compiledData[index][`${tickerSymbol}_${candlestickAttr}`];
            compiledData[index - 1][`${tickerSymbol}_${candlestickAttr}`] = `${now} - ${prev}`
            compiledData[index - 1].date = date; // for debugging
        });
    });

    if (date >= 5) break; // maximum date available which is today
    date += 1; // increament date for next loop
}
compiledData.pop();

console.log(compiledData);