/**
 * Extra Array function utility to improve readability in the code
 */
export default {
    getLastElement: arr => arr[arr.length - 1],
    getLastIndex: arr => arr.length - 1,
    isEmpty: arr => !arr.length,
    randomize: arr => {
        // Randomize sequence using Fisher-Yates (aka Knuth) Shuffle
        let currentIndex = arr.length;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            let randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            let temp = arr[currentIndex];
            arr[currentIndex] = arr[randomIndex];
            arr[randomIndex] = temp;
        }

        return arr;
    },
}
