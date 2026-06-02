/**
 * Genetic Algorithm (Algoritma Genetika)
 * Bertugas mengelola siklus perkawinan silang, seleksi turnamen,
 * mutasi gen, elitisme, dan evaluasi kecocokan (fitness).
 */
class GeneticAlgorithm {
  /**
   * Mengevaluasi populasi agen saat ini dan membiakkan generasi baru.
   * @param {Array<Agent>} oldAgents - Daftar agen dari generasi sebelumnya
   * @param {number} popSize - Jumlah populasi yang diinginkan
   * @param {number} mutationRate - Probabilitas mutasi gen (0.0 sampai 1.0)
   * @param {number} elitismRatio - Rasio agen terbaik yang dipertahankan langsung (0.0 sampai 1.0)
   * @param {number} inputNodes - Jumlah node input saraf
   * @param {number} hiddenNodes - Jumlah node hidden saraf
   * @param {number} outputNodes - Jumlah node output saraf
   * @returns {Object} Hasil evaluasi dan daftar otak untuk generasi berikutnya
   */
  static evolve(oldAgents, popSize, mutationRate, elitismRatio, inputNodes, hiddenNodes, outputNodes) {
    // 1. Urutkan agen berdasarkan fitness tertinggi ke terendah
    const sortedAgents = [...oldAgents].sort((a, b) => b.fitness - a.fitness);
    
    const bestAgent = sortedAgents[0];
    const bestFitness = bestAgent.fitness;
    
    // Hitung rata-rata fitness
    let sumFitness = 0;
    let successCount = 0;
    for (const agent of oldAgents) {
      sumFitness += agent.fitness;
      if (agent.reachedTarget) successCount++;
    }
    const avgFitness = sumFitness / oldAgents.length;
    const successRate = successCount / oldAgents.length;

    // 2. Terapkan Elitisme
    const nextBrains = [];
    const eliteCount = Math.max(1, Math.round(popSize * elitismRatio));
    
    for (let i = 0; i < eliteCount; i++) {
      // Masukkan salinan murni dari otak elit
      if (sortedAgents[i]) {
        nextBrains.push(sortedAgents[i].brain.copy());
      } else {
        // Jika karena suatu hal tidak ada agen, buat acak
        nextBrains.push(new NeuralNetwork(inputNodes, hiddenNodes, outputNodes));
      }
    }

    // 3. Breeding untuk memenuhi sisa ukuran populasi
    const remainingCount = popSize - eliteCount;
    for (let i = 0; i < remainingCount; i++) {
      // Seleksi orang tua menggunakan Tournament Selection
      const parentA = this.tournamentSelection(oldAgents, 5);
      const parentB = this.tournamentSelection(oldAgents, 5);
      
      // Kawin Silang (Crossover)
      let childBrain = parentA.brain.crossover(parentB.brain);
      
      // Mutasi (Mutation)
      // Skala mutasi berkurang sedikit jika agen sudah berkinerja sangat baik,
      // tapi secara default kita gunakan standar deviasi 0.1
      childBrain.mutate(mutationRate, 0.1);
      
      nextBrains.push(childBrain);
    }

    return {
      nextBrains: nextBrains,
      stats: {
        bestFitness: bestFitness,
        avgFitness: avgFitness,
        successRate: successRate,
        bestBrain: bestAgent.brain.copy(), // Ekspor otak terbaik untuk divisualisasikan
        bestAgentId: bestAgent.id
      }
    };
  }

  /**
   * Seleksi Turnamen (Tournament Selection)
   * Memilih K agen acak dari populasi, lalu mengambil yang terbaik di antara mereka.
   * Sangat efektif mencegah dominasi lokal (keberagaman terjaga) dan cepat dieksekusi.
   * @param {Array<Agent>} agents - Seluruh populasi agen saat ini
   * @param {number} k - Ukuran turnamen (semakin besar, tekanan seleksi semakin tinggi)
   * @returns {Agent} Pemenang turnamen
   */
  static tournamentSelection(agents, k = 5) {
    let best = null;
    for (let i = 0; i < k; i++) {
      const ind = Math.floor(Math.random() * agents.length);
      const contender = agents[ind];
      if (best === null || contender.fitness > best.fitness) {
        best = contender;
      }
    }
    return best;
  }
}
