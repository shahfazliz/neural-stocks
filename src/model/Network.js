export default class Network {
    bias = 0;
    input = 0;
    weight = 1;

    setBias(number) {
        this.bias = number;
        return this;
    }

    setInput(number) {
        this.input = number;
        return this;
    }

    setWeight(number) {
        this.weight = number;
        return this;
    }
}