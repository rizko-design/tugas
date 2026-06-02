/**
 * Neural Network (Jaringan Saraf Tiruan)
 * Didesain dari awal untuk performa tinggi dalam simulasi neuroevolusi.
 */
class NeuralNetwork {
  constructor(inputNodes, hiddenNodes, outputNodes, weights_ih = null, bias_h = null, weights_ho = null, bias_o = null) {
    this.inputNodes = inputNodes;
    this.hiddenNodes = hiddenNodes;
    this.outputNodes = outputNodes;

    // Jika parameter bobot dilewatkan (untuk penyalinan/kloning), gunakan itu.
    if (weights_ih) {
      this.weights_ih = this.cloneMatrix(weights_ih);
      this.bias_h = this.cloneArray(bias_h);
      this.weights_ho = this.cloneMatrix(weights_ho);
      this.bias_o = this.cloneArray(bias_o);
    } else {
      // Inisialisasi bobot acak antara -1 dan 1
      this.weights_ih = this.createRandomMatrix(this.hiddenNodes, this.inputNodes);
      this.bias_h = this.createRandomArray(this.hiddenNodes);
      this.weights_ho = this.createRandomMatrix(this.outputNodes, this.hiddenNodes);
      this.bias_o = this.createRandomArray(this.outputNodes);
    }
  }

  /**
   * Mengalirkan input ke depan untuk mendapatkan output
   * @param {Array} inputArray - Nilai sensor/input ternormalisasi [0, 1] atau [-1, 1]
   * @returns {Array} Nilai output berkisar [-1, 1] akibat fungsi tanh
   */
  feedForward(inputArray) {
    // 1. Input -> Hidden Layer
    const hidden = [];
    for (let i = 0; i < this.hiddenNodes; i++) {
      let sum = 0;
      for (let j = 0; j < this.inputNodes; j++) {
        sum += inputArray[j] * this.weights_ih[i][j];
      }
      sum += this.bias_h[i];
      hidden.push(Math.tanh(sum)); // Aktivasi tanh [-1, 1]
    }

    // 2. Hidden -> Output Layer
    const outputs = [];
    for (let i = 0; i < this.outputNodes; i++) {
      let sum = 0;
      for (let j = 0; j < this.hiddenNodes; j++) {
        sum += hidden[j] * this.weights_ho[i][j];
      }
      sum += this.bias_o[i];
      outputs.push(Math.tanh(sum)); // Aktivasi tanh [-1, 1]
    }

    return {
      inputs: inputArray,
      hidden: hidden,
      outputs: outputs
    };
  }

  /**
   * Menyalin arsitektur dan bobot neural network secara mendalam (deep clone)
   */
  copy() {
    return new NeuralNetwork(
      this.inputNodes,
      this.hiddenNodes,
      this.outputNodes,
      this.weights_ih,
      this.bias_h,
      this.weights_ho,
      this.bias_o
    );
  }

  /**
   * Mutasi bobot menggunakan Gauss/Normal Distribution Mutation
   * @param {number} rate - Probabilitas mutasi (0.0 sampai 1.0)
   * @param {number} amount - Skala variansi mutasi (standar deviasi, default 0.1)
   */
  mutate(rate, amount = 0.1) {
    const mutateValue = (val) => {
      if (Math.random() < rate) {
        // Gaussian mutation menggunakan Box-Muller transform
        return val + this.randomGaussian() * amount;
      }
      return val;
    };

    // Mutasi bobot input-hidden
    for (let i = 0; i < this.hiddenNodes; i++) {
      for (let j = 0; j < this.inputNodes; j++) {
        this.weights_ih[i][j] = mutateValue(this.weights_ih[i][j]);
      }
      this.bias_h[i] = mutateValue(this.bias_h[i]);
    }

    // Mutasi bobot hidden-output
    for (let i = 0; i < this.outputNodes; i++) {
      for (let j = 0; j < this.hiddenNodes; j++) {
        this.weights_ho[i][j] = mutateValue(this.weights_ho[i][j]);
      }
      this.bias_o[i] = mutateValue(this.bias_o[i]);
    }
  }

  /**
   * Kawin silang (crossover) antara dua neural network
   * @param {NeuralNetwork} partner - Pasangan kawin silang
   * @returns {NeuralNetwork} Anak jaringan saraf baru hasil persilangan
   */
  crossover(partner) {
    const child = this.copy();

    // Lakukan persilangan seragam (uniform crossover) untuk bobot input-hidden
    for (let i = 0; i < this.hiddenNodes; i++) {
      for (let j = 0; j < this.inputNodes; j++) {
        if (Math.random() < 0.5) {
          child.weights_ih[i][j] = partner.weights_ih[i][j];
        }
      }
      if (Math.random() < 0.5) {
        child.bias_h[i] = partner.bias_h[i];
      }
    }

    // Uniform crossover untuk bobot hidden-output
    for (let i = 0; i < this.outputNodes; i++) {
      for (let j = 0; j < this.hiddenNodes; j++) {
        if (Math.random() < 0.5) {
          child.weights_ho[i][j] = partner.weights_ho[i][j];
        }
      }
      if (Math.random() < 0.5) {
        child.bias_o[i] = partner.bias_o[i];
      }
    }

    return child;
  }

  // --- MATRIKS & MATEMATIKA UTILITY ---

  createRandomMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push(Math.random() * 2 - 1); // -1 s.d 1
      }
      matrix.push(row);
    }
    return matrix;
  }

  createRandomArray(length) {
    const arr = [];
    for (let i = 0; i < length; i++) {
      arr.push(Math.random() * 2 - 1); // -1 s.d 1
    }
    return arr;
  }

  cloneMatrix(matrix) {
    return matrix.map(row => [...row]);
  }

  cloneArray(arr) {
    return [...arr];
  }

  /**
   * Standard Gaussian random generator (Box-Muller Transform)
   * Menghasilkan nilai random dengan rata-rata 0 dan variansi 1
   */
  randomGaussian() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Mengeluarkan nilai 0
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
