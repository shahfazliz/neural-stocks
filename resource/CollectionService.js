import Candidate from '../model/Candidate.js';
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
                        candlestickCollection.forEach((candlestick, index) => {
                            candlestick
                                .setVolumeProfile(tickerVolumeProfile
                                    .getVolumeProfile(candlestick
                                        .getClose()));
                            
                            if (index > 0) {
                                const yesterdayVolumeProfile = candlestickCollection
                                    .getByIndex(index - 1)
                                    .getVolumeProfile();
                                candlestick
                                    .setVolumeProfileDiff(Math.log(candlestick.getVolumeProfile() / yesterdayVolumeProfile));
                            }
                        });
                        return candlestickCollection;
                    });
            });
    }

    /**
     * Read from json file as Universe
     */
     readJSONFileAsUniverse(jsonfilepath) {
        return fileService
            .readJSONFile(jsonfilepath)
            .then(json => {
                console.log(`Reading from ${jsonfilepath} to Universe`);
                // console.log(JSON.parse(json));
                return json.map(world => new Map(Object.entries(world)));
            });
    }

    /**
     * Read json file as candidate
     * @returns {Promise}
     */
     readJSONFileAsCandidate(jsonfilepath) {
        return fileService
            .readJSONFile(jsonfilepath)
            .then(json => {
                console.log(`Reading from ${jsonfilepath}`);
                // console.log(JSON.parse(rawJson));
                return new Candidate(json);
            })
            // If file does not exist, create one
            .catch(() => fileService
                .writeToJSONFile({
                    jsonfilepath,
                })
                .then(() => new Candidate({}))
            );
    }
}
