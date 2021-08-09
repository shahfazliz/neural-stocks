import moment from 'moment';
import App from './app.js';

const app = new App();
const listOfTickers = [
    'DJIA', 
    'FXA', 'FXB', 'FXC', 'FXE', 'FXF', 'FXY', 
    'GLD', 'GOVT', 'GOVZ', 
    'IEF', 'IEI',
    'MID',
    'NDX',
    'RUT',
    'SGOV', 'SHY', 'SPX',
    'TLH', 'TLT',
    'VIX',
];

Promise
    .all(listOfTickers.map(tickerSymbol => app
        .readFromCSVFileToJson(`./csv_sample/${tickerSymbol}.csv`)
        .then(jsonData => app.createLastInput({
            appendString: tickerSymbol,
            data: jsonData,
            numberOfElemet: 10,
            sortDataFunction: (a, b) => moment(a.Date, 'MM/DD/YYYY').diff(moment(b.Date, 'MM/DD/YYYY')),
        })
    )))
    // Combine multiple training data sets
    .then(multipleLastData => {
        let lastOutput = {};
        multipleLastData.forEach(lastSet => {
            Object
                .keys(lastSet)
                .forEach(key => {
                    lastOutput[key] = lastSet[key]; 
                });
            
            Object
                .keys(lastSet)
                .forEach(key => {
                    lastOutput[key] = lastSet[key]; 
                });
        }); 
        return lastOutput;
    })
    .then(lastOutput => {
        return app
            .loadTrainedData()
            .then(net => {
                console.log('result:', net.run(lastOutput));
            });
    });