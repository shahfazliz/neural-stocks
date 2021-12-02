import { csvToJson } from '../util/AdaptorCSV2JSON.js';
import fs from 'fs/promises';

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