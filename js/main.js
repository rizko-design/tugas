/**
 * Main application coordinator
 * Menghubungkan seluruh modul (NN, GA, Agent, Simulator, Chart, Visualizer),
 * mengelola loop simulasi utama, menghitung FPS, serta menangani binding event control UI.
 */

// State Aplikasi Utama
let simulator;
let chart;
let visualizer;

let agents = [];
let generation = 1;
let frameCount = 0;
let maxLifespan = 600; // Durasi maks per generasi (10 detik pada 60fps)
let isPlaying = true;

// Parameter default yang disinkronkan dengan UI Sliders
let popSize = 100;
let mutationRate = 0.05; // 5%
let elitismRatio = 0.1; // 10%
let hiddenNeurons = 8;
let agentType = 'drone';
let simSpeed = 1;

// Jarak awal dari titik spon ke target (untuk hitung fitness)
let startDistance = 0;

// Penghitung FPS
let lastTime = performance.now();
let frames = 0;
let fps = 60;

// Rekam Data Sejarah untuk Evaluasi Chart
let maxFitnessHistory = [];
let avgFitnessHistory = [];

/**
 * Inisialisasi awal saat window dimuat
 */
window.addEventListener('DOMContentLoaded', () => {
  // 1. Inisialisasi Komponen Utama
  simulator = new Simulator('simulationCanvas');
  chart = new PerformanceChart('chartCanvas', 'chartTooltip');
  visualizer = new ActiveNNVisualizer('nnCanvas');

  // Hitung jarak spon awal
  recalculateStartDistance();

  // 2. Registrasi Event Listener UI & Kontrol
  initUiEvents();

  // 3. Bangun Populasi Awal (Generasi Pertama)
  initPopulation();

  // 4. Mulai loop animasi simulasi utama
  requestAnimationFrame(updateLoop);
});

/**
 * Menghitung ulang jarak awal spon ke target
 */
function recalculateStartDistance() {
  startDistance = simulator.distance(
    simulator.spawnPoint.x, 
    simulator.spawnPoint.y, 
    simulator.target.x, 
    simulator.target.y
  );
}

/**
 * Membangun populasi baru dengan jaringan saraf acak (Gen 1) atau warisan
 * @param {Array<NeuralNetwork>} brains - Otak warisan hasil evolusi (jika ada)
 */
function initPopulation(brains = null) {
  agents = [];
  
  for (let i = 0; i < popSize; i++) {
    let brain = null;
    if (brains && brains[i]) {
      brain = brains[i];
    }
    
    // Buat agen baru di titik spon simulator
    const agent = new Agent(
      simulator.spawnPoint.x,
      simulator.spawnPoint.y,
      agentType,
      brain,
      hiddenNeurons
    );
    agents.push(agent);
  }

  frameCount = 0;
  updateStatsDashboard();
}

/**
 * Menjalankan langkah evolusi ke generasi berikutnya
 */
function nextGeneration() {
  // Hitung fitness akhir untuk semua agen sebelum evolusi
  recalculateStartDistance();
  for (let agent of agents) {
    agent.calculateFitness(startDistance);
  }

  // Lakukan perkawinan silang & mutasi menggunakan Algoritma Genetika
  const evolutionResult = GeneticAlgorithm.evolve(
    agents,
    popSize,
    mutationRate,
    elitismRatio,
    agents[0].inputCount,
    hiddenNeurons,
    agents[0].outputCount
  );

  // Simpan data statistik ke grafik
  const stats = evolutionResult.stats;
  chart.addData(generation, stats.bestFitness, stats.avgFitness);

  // Update UI Stats
  generation++;
  document.getElementById('statGen').innerText = generation;
  
  // Tampilkan ID agen terbaik di visualizer header
  document.getElementById('bestAgentId').innerText = `ID: ${stats.bestAgentId}`;

  // Simpan otak terbaik generasi sebelumnya untuk direferensikan jika generasi baru mati semua seketika
  window.lastBestBrain = stats.bestBrain;

  // Bangun populasi generasi baru dengan otak hasil evolusi
  initPopulation(evolutionResult.nextBrains);
}

/**
 * Loop Simulasi Utama (Menggunakan requestAnimationFrame)
 */
function updateLoop(timestamp) {
  // 1. Hitung FPS (Frames Per Second)
  frames++;
  if (timestamp > lastTime + 1000) {
    fps = Math.round((frames * 1000) / (timestamp - lastTime));
    document.getElementById('fpsCounter').innerText = fps;
    frames = 0;
    lastTime = timestamp;
  }

  // 2. Jalankan Update Fisika (Mendukung Kecepatan Simulasi Multi-Speed)
  if (isPlaying) {
    // Jalankan beberapa iterasi per frame berdasarkan slider kecepatan
    for (let step = 0; step < simSpeed; step++) {
      frameCount++;

      // Update gerakan rintangan dinamis (ranjau memantul/dinding geser)
      simulator.updateObstacles(frameCount);

      let allDead = true;
      
      // Update semua agen
      for (let agent of agents) {
        if (agent.alive) {
          allDead = false;
          
          // Perbarui sensor raycast agen
          agent.updateSensors(simulator.obstacles, simulator.bounds);
          
          // Perbarui respon saraf & fisika gerak agen
          agent.update(simulator.target, maxLifespan, startDistance);
          
          // Cek tabrakan fisik
          agent.checkCollisions(simulator.obstacles, simulator.bounds);
        }
      }

      // Jika seluruh populasi menabrak/mati, atau waktu hidup habis -> Picu Evolusi!
      if (allDead || frameCount >= maxLifespan) {
        nextGeneration();
        break; // Keluar dari loop kecepatan multi-speed
      }
    }
  }

  // 3. Cari Agen Terunggul yang sedang hidup untuk disorot dan divisualisasikan sarafnya
  let bestAliveAgent = getLeadingAgent();

  // 4. Gambar Seluruh Kanvas Arena Simulasi
  simulator.draw(agents, bestAliveAgent);

  // 5. Gambar Diagram Jaringan Saraf Agen Terunggul
  if (bestAliveAgent) {
    visualizer.draw(bestAliveAgent.brain, bestAliveAgent.brainState);
  } else if (window.lastBestBrain) {
    // Jika semua sedang mati sebelum transisi, tunjukkan otak juara generasi lalu
    visualizer.draw(window.lastBestBrain, null);
  } else if (agents.length > 0) {
    // Default fallback
    visualizer.draw(agents[0].brain, null);
  }

  // Update statistik berkala di dashboard
  if (isPlaying && frameCount % 5 === 0) {
    updateStatsDashboard();
  }

  requestAnimationFrame(updateLoop);
}

/**
 * Mencari agen terunggul yang sedang hidup
 * Ditentukan dari jarak paling dekat ke target yang pernah diraih selama masa hidupnya
 */
function getLeadingAgent() {
  let leadingAgent = null;
  let maxFitVal = -Infinity;

  for (let agent of agents) {
    if (agent.alive) {
      // Hitung taksiran fitness instan berdasarkan seberapa dekat dia saat ini ke target
      agent.calculateFitness(startDistance);
      if (agent.fitness > maxFitVal) {
        maxFitVal = agent.fitness;
        leadingAgent = agent;
      }
    }
  }
  return leadingAgent;
}

/**
 * Memperbarui angka indikator statistik di dashboard baris atas
 */
function updateStatsDashboard() {
  const aliveCount = agents.filter(a => a.alive).length;
  const successCount = agents.filter(a => a.reachedTarget).length;
  const successRate = (successCount / popSize) * 100;

  // Hitung rata-rata dan pencapaian fitness tertinggi instan saat ini
  let bestFit = 0;
  let sumFit = 0;
  for (let agent of agents) {
    agent.calculateFitness(startDistance);
    sumFit += agent.fitness;
    if (agent.fitness > bestFit) {
      bestFit = agent.fitness;
    }
  }
  const avgFit = sumFit / popSize;

  document.getElementById('statAlive').innerText = `${aliveCount} / ${popSize}`;
  document.getElementById('statSuccess').innerText = `${successRate.toFixed(0)}%`;
  document.getElementById('statBestFitness').innerText = bestFit.toFixed(1);
  document.getElementById('statAvgFitness').innerText = avgFit.toFixed(1);
}

/**
 * Registrasi event listener untuk control panel UI
 */
function initUiEvents() {
  // Kecepatan Simulasi Slider
  const simSpeedInput = document.getElementById('simSpeed');
  simSpeedInput.addEventListener('input', (e) => {
    simSpeed = parseInt(e.target.value);
    document.getElementById('speedVal').innerText = simSpeed === 5 ? 'MAX' : simSpeed + 'x';
  });

  // Tipe Agen Selector
  const agentTypeInput = document.getElementById('agentType');
  agentTypeInput.addEventListener('change', (e) => {
    agentType = e.target.value;
    // Otomatis reset populasi dengan tipe baru
    initPopulation();
  });

  // Ukuran Populasi Slider
  const popSizeInput = document.getElementById('popSize');
  popSizeInput.addEventListener('input', (e) => {
    popSize = parseInt(e.target.value);
    document.getElementById('popSizeVal').innerText = popSize;
  });

  // Tingkat Mutasi Slider
  const mutationRateInput = document.getElementById('mutationRate');
  mutationRateInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    mutationRate = val / 100;
    document.getElementById('mutationVal').innerText = val + '%';
  });

  // Elitisme Slider
  const elitismInput = document.getElementById('elitism');
  elitismInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    elitismRatio = val / 100;
    document.getElementById('elitismVal').innerText = val + '%';
  });

  // Hidden Neurons Slider
  const hiddenNeuronsInput = document.getElementById('hiddenNeurons');
  hiddenNeuronsInput.addEventListener('input', (e) => {
    hiddenNeurons = parseInt(e.target.value);
    document.getElementById('hiddenVal').innerText = hiddenNeurons;
    // Merubah struktur saraf memicu pembentukan otak generasi awal
    initPopulation();
  });

  // Peta / Rintangan Preset Selector
  const mapPresetInput = document.getElementById('mapPreset');
  mapPresetInput.addEventListener('change', (e) => {
    simulator.loadPreset(e.target.value);
    recalculateStartDistance();
    initPopulation();
  });

  // ALAT GAMBAR KANVAS (TOOL WALL VS TOOL MINE)
  const btnToolWall = document.getElementById('toolDrawWall');
  const btnToolMine = document.getElementById('toolSpawnMine');

  btnToolWall.addEventListener('click', () => {
    simulator.activeTool = 'drawWall';
    btnToolWall.classList.add('btn-active');
    btnToolMine.classList.remove('btn-active');
  });

  btnToolMine.addEventListener('click', () => {
    simulator.activeTool = 'spawnMine';
    btnToolMine.classList.add('btn-active');
    btnToolWall.classList.remove('btn-active');
  });

  // BUTTON PLAY / PAUSE
  const btnPlayPause = document.getElementById('btnPlayPause');
  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      btnPlayPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        <span>Pause</span>
      `;
      btnPlayPause.classList.remove('btn-accent');
    } else {
      btnPlayPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <span>Play</span>
      `;
      btnPlayPause.classList.add('btn-accent');
    }
  });

  // BUTTON SKIP GENERATION (Lompat breeding langsung)
  const btnNextGen = document.getElementById('btnNextGen');
  btnNextGen.addEventListener('click', () => {
    nextGeneration();
  });

  // BUTTON CLEAR OBSTACLES (Hapus rintangan buatan)
  const btnClearObstacles = document.getElementById('btnClearObstacles');
  btnClearObstacles.addEventListener('click', () => {
    simulator.clearObstacles();
  });

  // BUTTON RESTART EVOLUTION (Ulang dari nol)
  const btnRestart = document.getElementById('btnRestart');
  btnRestart.addEventListener('click', () => {
    generation = 1;
    document.getElementById('statGen').innerText = generation;
    document.getElementById('bestAgentId').innerText = 'ID: None';
    window.lastBestBrain = null;
    chart.clear();
    recalculateStartDistance();
    initPopulation();
  });

  // MODAL CLOSE
  const btnCloseWelcome = document.getElementById('btnCloseWelcome');
  const welcomeModal = document.getElementById('welcomeModal');
  btnCloseWelcome.addEventListener('click', () => {
    welcomeModal.style.opacity = 0;
    setTimeout(() => {
      welcomeModal.classList.add('hidden');
    }, 300); // Sinkron animasi fade-out
  });
}
