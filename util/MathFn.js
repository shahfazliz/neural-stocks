/**
 * Extra Math function utility to improve readability in the code
 */
 export default {
    currency: value => parseFloat(value.toFixed(2)),
    factorial,
    limitBetween: (value, min, max) => limitMin(limitMax(value, min), max),
    limitMin,
    limitMax,
    precision,
    randomFloat: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1) + min),
    swish: value => value * sigmoid(value),
    sigmoid,
    standardDeviation,
    // variations(repeat)
    // permutations(repeat)
    // combinations(repeat)
}

function factorial(value) {
    return (value <= 1) 
    ? 1
    : value * factorial(value - 1);
}

function limitMax(value, max) {
    return Math.min(value, max);
}

function limitMin(value, min) {
    return Math.max(value, min);
}

function sigmoid(value) {
    return 1 / (1 + Math.exp(-value));
}

function precision(value) {
    return parseFloat(value.toFixed(5));
}

function standardDeviation(numbers) {
    const mean = numbers.reduce((acc, value) => acc + value) / numbers.length;
    return precision(Math.sqrt(numbers.reduce((acc, value) => acc += (value - mean) ** 2, 0) / numbers.length));
}
