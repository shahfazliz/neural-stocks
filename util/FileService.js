import CandlestickCollection from '../model/CandlestickCollection.js';
import { csvToJson } from './util/AdaptorCSV2JSON.js';

export default class FileService {
    /**
     * Read csv file then convert into json.
     */
     readFromCSVFileToJson(csvfilepath) {
        return csvToJson(csvfilepath);
    }

    /**
     * Read from json file as object
     */
     readJSONFile(jsonfilepath) {
        console.log(`Reading from ${jsonfilepath}`);
        return fs
            .readFile(jsonfilepath)
            .then(rawJson => JSON.parse(rawJson))
            // If file does not exist, create one
            .catch(() => this
                .writeToJSONFile({
                    jsonfilepath,
                    data: [],
                })
                .then(data => data)
            );
    }

    /**
     * Read from json file as CandlestickCollection
     */
     readJSONFileAsCandlestickCollection(jsonfilepath) {
        console.log(`Reading from ${jsonfilepath}`);
        return this
            .readJSONFile(jsonfilepath)
            .then(json => new CandlestickCollection(json));
    }

    /**
     * Write json file
     * @returns {Promise}
     */
     writeToJSONFile({
        jsonfilepath,
        data = [],
    }) {
        return fs
            .writeFile(
                jsonfilepath,
                typeof data === 'string'
                    ? data
                    : JSON.stringify(
                        data,
                        undefined,
                        4
                    )
            )
            .then(() => {
                console.log(`Writing to ${jsonfilepath}`);
                return data;
            });
    }
}