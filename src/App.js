import Layer from './model/Layer';
import Network from './model/Network';
import Perceptron from './model/Perceptron';
import React from 'react';
import './App.css';

export default class App extends React.Component {
    hiddenLayer = new Layer()
        .setPerceptron(new Perceptron()
            .setActivationFunction(Perceptron.activationFunctionCollection.sigmoid)
            .setLearnRate(0.6)
            .setNetwork(new Network()
                .setInput(0.8)
                .setWeight(0.3)
            )
            .setNetwork(new Network()
                .setInput(0.5)
                .setWeight(0.7)
            )
        )
        .setPerceptron(new Perceptron()
            .setActivationFunction(Perceptron.activationFunctionCollection.sigmoid)
            .setLearnRate(0.6)
            .setNetwork(new Network()
                .setInput(0.8)
                .setWeight(0.4)
            )
            .setNetwork(new Network()
                .setInput(0.5)
                .setWeight(0.9)
            )
        );

    handleStart = () => {
        // Business Logic
        // 1 .Calculate all outputs of   all neurons in the hidden layer
        this
            .hiddenLayer
            .getOutput()
            // 2. Calculate all outputs from all neurons in the output layer
            .then((hiddenOutputs) => {
                return new Perceptron()
                    .setActivationFunction(Perceptron.activationFunctionCollection.sigmoid)
                    .setLearnRate(0.6)
                    .setNetwork(new Network()
                        .setInput(hiddenOutputs[0])
                        .setWeight(0.6)
                    )
                    .setNetwork(new Network()
                        .setInput(hiddenOutputs[1])
                        .setWeight(0.9)
                    )
                    .calculateOutput()
                    .output;
            })
            // 3. Calculate the output layer error
            .then((output) => {

            })
            // 4. Update weight between hidden layer to output layer
            // 5. Calculate the hidden layer error
            // 6. Update weight between input layer to hidden layer
            .then();
    };

    render() {
        return <div className="App">
            <button onClick={this.handleStart}>Start</button>
        </div>;
    }
}
