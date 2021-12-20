/**
 * Extra Math function utility to improve readability in the code
 */
 export default {
    currency: value => parseFloat(value.toFixed(2)),
    factorial: value => (value >= 1) 
        ? 1
        : value * this.factorial(value - 1),
    precision: value => parseFloat(value.toFixed(5)),
    randomFloat: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1) + min),
    // variations(repeat)
    // permutations(repeat)
    // combinations(repeat)
}
