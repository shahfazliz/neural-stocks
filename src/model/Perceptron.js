import Network from "./Network";

export default class Perceptron {
    static activationFunctionCollection = {
        sigmoid: (x) => 1 / (1 + Math.pow(Math.E, -1 * x)),
    };

    // Default function is just to return itself
    activationFunction = x => x;

    learnRate = 0.1;

    // A Perceptron has a collection of Networks
    networks = [];

    output = 0;

    setActivationFunction(callbackFunction) {
        this.activationFunction = callbackFunction;
        return this;
    }

    setLearnRate(rate) {
        this.learnRate = rate;
        return this;
    }

    setNetwork(networkObj) {
        this
            .networks
            .push(networkObj);
        return this;
    }

    // 1. Calculate output neuron
    calculateOutput() {
        this.output = this.activationFunction(this
            .networks
            .reduce((accumulator, network) => {
                accumulator += network.input * network.weight + network.bias;
                return accumulator;
            }, 0));

        return this;
    }

    // 2. Calculate output error
    // gradientToExpectedOutput = (expectedOutput - this.output)
    // gradientToExpectedOutput = Sum (expectedOutputError * weight)
    calculateOutputError(gradientToExpectedOutput) {
        return this.output * (1 - this.output) * gradientToExpectedOutput;
    }
    
    // 3. Update weight
    updateWeight() {
        this
            .networks
            .forEach(network => {
                network.setWeight(network.weight + this.learnRate * this.output * this.calculateOutputError());
            });
        
        return this;
    }
}
