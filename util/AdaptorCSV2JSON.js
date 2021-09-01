import csvtojson from 'csvtojson';

export function csvToJson(csvfilepath) {
    return csvtojson({
            delimiter: ',',
            noheader: false,
            parseNumbers: true,
            quote: '"',
        })
        .fromFile(csvfilepath);
}