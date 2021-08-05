import csv2json from 'csvjson-csv2json';

export function csvToJson(strCSV) {
    return csv2json(strCSV, {parseNumbers: true})
}