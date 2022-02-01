export default class App {
    __initialCapital = 1000;
    __costOfTrade = 0.5; // 0.25 to open and another 0.25 to close
    __reward = 0.06; // 6%

    __numberOfCandlesAYear = 252;
    __numberOfCandles = 50;
    __numberOfOutputs = 6;

    __trainedFilePath = './trained.json';

    __listOfTickers = [
        'BAL',
        'CYB',
        'DBA', 'DIA',
        'EEM',
        'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXI', 'FXY',
        'GDX', 'GDXJ', 'GLD', 'GOVT',
        'IEF', 'IEI',
        'IWM',
        'IYT',
        'NIB',
        'QQQ',
        'RJA', 'RJI',
        'SHY',
        'SPY',
        'TIP', 'TLH', 'TLT',
        'UNG', 'USO', 'UUP',
        'VXX',
        'XHB', 'XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XRT', 'XTL', 'XTN',
    ];

    __listOfTickersOfInterest = ['SPY', 'QQQ', 'IWM']; // order is important

    getListOfTickers() {
        return this.__listOfTickers;
    }

    getListTickersOfInterest() {
        return this.__listOfTickersOfInterest;
    }

    isTickerOfInterest(tickerSymbol) {
        return this
            .__listOfTickersOfInterest
            .includes(tickerSymbol);
    }
}
