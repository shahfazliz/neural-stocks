export default class Layer {
    perceptrons = [];

    setPerceptron(perceptron) {
        this
            .perceptrons
            .push(perceptron);

        return this;
    }

    getOutput() {
        return Promise.all(this
            .perceptrons
            .map(perceptron => new Promise((resolve, reject) => {
                try {
                    resolve(perceptron
                        .calculateOutput()
                        .output
                    );
                } catch (error) {
                    reject(error);
                }
            }))
        );
    }
}