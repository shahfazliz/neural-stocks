import CandlestickCollection from '../model/CandlestickCollection.js';
import FileService from '../util/FileService.js';
import VolumeProfile from '../model/VolumeProfile.js';

const fileService = new FileService();

export default class CollectionService {
    /**
     * Read from json file as CandlestickCollection
     */
     readJSONFileAsCandlestickCollection(jsonfilepath) {
        console.log(`Reading from ${jsonfilepath}`);
        const tickerSymbol = jsonfilepath
            .replace(/\.\/data\/tickers\//g, '')
            .replace(/.json/, '');
            
        const tickerVolumeProfile = new VolumeProfile();

        return tickerVolumeProfile
            .init(tickerSymbol)
            .then(() => {
                return fileService
                    .readJSONFile(jsonfilepath)
                    .then(json => {
                        const candlestickCollection = new CandlestickCollection(json);
                        candlestickCollection.forEach(candlestick => {
                            candlestick
                                .setVolumeProfile(tickerVolumeProfile
                                    .getVolumeProfile(candlestick
                                        .getClose()));
                        });
                        return candlestickCollection;
                    });
            });
    }
}
