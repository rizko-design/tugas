/**
 * Agent Class (Drone, Spaceship, Car, Ant)
 * Merepresentasikan individu dalam populasi. Memiliki fisika gerak,
 * sensor radar raycast, jaringan saraf tiruan (otak), dan perhitungan kebugaran (fitness).
 */
class Agent {
  constructor(x, y, type = 'drone', brain = null, hiddenNodes = 8) {
    this.id = this.generateCallsign(type);
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2; // Menghadap ke atas secara default
    this.type = type;
    
    // Dimensi fisik agen
    this.radius = 12;
    this.width = 24;
    this.height = 18;
    
    // Parameter Spesifikasi Fisika Gerak berdasarkan Tipe
    this.maxSpeed = 4.5;
    this.acceleration = 0.2;
    this.rotationSpeed = 0.08;
    this.friction = 0.95; // Perlambatan alami
    
    this.configurePhysics();

    // Otak (Neural Network): 10 Inputs, X Hidden, 2 Outputs
    // Inputs: 7 sensor radar + 1 kecepatan + 1 sudut relatif target + 1 jarak relatif target
    // Outputs: [Steering (-1 Left, 1 Right), Thrust (-1 Reverse/Slow, 1 Fast)]
    this.inputCount = 10;
    this.outputCount = 2;
    
    if (brain) {
      this.brain = brain;
    } else {
      this.brain = new NeuralNetwork(this.inputCount, hiddenNodes, this.outputCount);
    }

    // Sensor Raycast (Radar) - 7 sensor menyebar di depan
    this.sensorAngles = [-60, -40, -20, 0, 20, 40, 60].map(deg => (deg * Math.PI) / 180);
    this.sensorRange = 160;
    this.sensors = [];
    this.initSensors();

    // Status Evolusi
    this.fitness = 0;
    this.alive = true;
    this.reachedTarget = false;
    this.crashed = false;
    this.lifespan = 0;
    this.successTime = 0;
    this.minDistanceToTarget = Infinity;
    this.trail = [];
    this.trailLength = 40;
  }

  /**
   * Mengatur parameter fisika khusus untuk setiap tipe agen
   */
  configurePhysics() {
    switch (this.type) {
      case 'spaceship':
        this.maxSpeed = 6.0;
        this.acceleration = 0.22;
        this.rotationSpeed = 0.09;
        this.friction = 0.985; // Sangat licin (gesekan rendah)
        this.radius = 11;
        break;
      case 'car':
        this.maxSpeed = 4.0;
        this.acceleration = 0.18;
        this.rotationSpeed = 0.06;
        this.friction = 0.90; // Cepat berhenti saat gas dilepas
        this.radius = 12;
        break;
      case 'ant':
        this.maxSpeed = 2.5;
        this.acceleration = 0.5; // Respon instan
        this.rotationSpeed = 0.15; // Berputar cepat
        this.friction = 0.0; // Tidak ada inersia/meluncur
        this.radius = 8;
        break;
      case 'drone':
      default:
        this.maxSpeed = 4.5;
        this.acceleration = 0.2;
        this.rotationSpeed = 0.08;
        this.friction = 0.94; // Gesekan quadcopter standar
        this.radius = 12;
        break;
    }
  }

  /**
   * Menghasilkan nama panggil (Callsign) militer futuristik
   */
  generateCallsign(type) {
    const prefixes = {
      drone: 'DRN',
      spaceship: 'SPX',
      car: 'CAR',
      ant: 'ANT'
    };
    const code = Math.floor(1000 + Math.random() * 9000);
    return `${prefixes[type] || 'AGN'}-${code}`;
  }

  /**
   * Inisialisasi sensor radar raycast awal
   */
  initSensors() {
    this.sensors = this.sensorAngles.map(angle => ({
      angle: angle,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      value: 1.0, // 1.0 berarti bersih, 0.0 berarti menabrak
      cx: 0, // titik benturan x
      cy: 0  // titik benturan y
    }));
  }

  /**
   * Memperbarui radar sensor dengan mencari jarak perpotongan terdekat dengan rintangan
   * @param {Array<Object>} obstacles - Daftar rintangan (dinding statis & ranjau)
   * @param {Object} bounds - Batas kanvas {width, height}
   */
  updateSensors(obstacles, bounds) {
    for (let sensor of this.sensors) {
      // Hitung arah absolut sensor berdasarkan rotasi agen saat ini
      const absAngle = this.angle + sensor.angle;
      
      sensor.x1 = this.x;
      sensor.y1 = this.y;
      sensor.x2 = this.x + Math.cos(absAngle) * this.sensorRange;
      sensor.y2 = this.y + Math.sin(absAngle) * this.sensorRange;

      let closestIntersection = null;
      let minDistance = this.sensorRange;

      // 1. Uji perpotongan dengan dinding statis (berbentuk garis / segmen)
      for (const obs of obstacles) {
        if (obs.type === 'wall') {
          // Setiap dinding memiliki 4 segmen garis (kiri, kanan, atas, bawah)
          const segments = [
            {p1: {x: obs.x, y: obs.y}, p2: {x: obs.x + obs.w, y: obs.y}}, // Atas
            {p1: {x: obs.x + obs.w, y: obs.y}, p2: {x: obs.x + obs.w, y: obs.y + obs.h}}, // Kanan
            {p1: {x: obs.x, y: obs.y + obs.h}, p2: {x: obs.x + obs.w, y: obs.y + obs.h}}, // Bawah
            {p1: {x: obs.x, y: obs.y}, p2: {x: obs.x, y: obs.y + obs.h}}  // Kiri
          ];

          for (const seg of segments) {
            const pt = this.getLineIntersection(
              {x: sensor.x1, y: sensor.y1}, {x: sensor.x2, y: sensor.y2},
              seg.p1, seg.p2
            );
            if (pt) {
              const d = this.distance(this.x, this.y, pt.x, pt.y);
              if (d < minDistance) {
                minDistance = d;
                closestIntersection = pt;
              }
            }
          }
        } else if (obs.type === 'mine') {
          // Ranjau berbentuk lingkaran dinamis. Cast ray ke lingkaran.
          const pt = this.getRayCircleIntersection(
            {x: sensor.x1, y: sensor.y1},
            {x: sensor.x2, y: sensor.y2},
            {x: obs.x, y: obs.y, r: obs.r}
          );
          if (pt) {
            const d = this.distance(this.x, this.y, pt.x, pt.y);
            if (d < minDistance) {
              minDistance = d;
              closestIntersection = pt;
            }
          }
        }
      }

      // 2. Uji perpotongan dengan batas tepi kanvas simulasi
      const borderSegments = [
        {p1: {x: 0, y: 0}, p2: {x: bounds.width, y: 0}}, // Batas Atas
        {p1: {x: bounds.width, y: 0}, p2: {x: bounds.width, y: bounds.height}}, // Batas Kanan
        {p1: {x: 0, y: bounds.height}, p2: {x: bounds.width, y: bounds.height}}, // Batas Bawah
        {p1: {x: 0, y: 0}, p2: {x: 0, y: bounds.height}} // Batas Kiri
      ];

      for (const seg of borderSegments) {
        const pt = this.getLineIntersection(
          {x: sensor.x1, y: sensor.y1}, {x: sensor.x2, y: sensor.y2},
          seg.p1, seg.p2
        );
        if (pt) {
          const d = this.distance(this.x, this.y, pt.x, pt.y);
          if (d < minDistance) {
            minDistance = d;
            closestIntersection = pt;
          }
        }
      }

      // Simpan nilai sensor ternormalisasi [0, 1]
      sensor.value = minDistance / this.sensorRange;
      if (closestIntersection) {
        sensor.cx = closestIntersection.x;
        sensor.cy = closestIntersection.y;
      } else {
        sensor.cx = sensor.x2;
        sensor.cy = sensor.y2;
      }
    }
  }

  /**
   * Keputusan & Update Fisika Agen pada setiap frame
   * @param {Object} target - Koordinat target {x, y}
   * @param {number} maxLifespan - Durasi maksimum simulasi (frame)
   * @param {number} startDistance - Jarak awal saat spon ke target
   */
  update(target, maxLifespan, startDistance) {
    if (!this.alive) return;
    this.lifespan++;

    // 1. Persiapkan Input Jaringan Saraf
    // a. Sensor radar (7 input)
    const inputs = this.sensors.map(s => s.value);
    
    // b. Kecepatan saat ini (1 input)
    const currentSpeedNorm = this.distance(0, 0, this.vx, this.vy) / this.maxSpeed;
    inputs.push(currentSpeedNorm);

    // c. Sudut relatif ke target (1 input)
    const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
    let relativeAngle = angleToTarget - this.angle;
    
    // Normalisasi sudut ke [-1, 1]
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    inputs.push(relativeAngle / Math.PI);

    // d. Jarak relatif ke target (1 input)
    const distToTarget = this.distance(this.x, this.y, target.x, target.y);
    inputs.push(Math.min(distToTarget / 800, 1.0)); // Batasi pembagi normalisasi

    // 2. Lakukan Forward Propagation
    const brainDecision = this.brain.feedForward(inputs);
    this.brainState = brainDecision; // Disimpan untuk visualisasi visualizer saraf

    // Output saraf berkisar [-1, 1]
    const steerOutput = brainDecision.outputs[0]; // [-1 Kiri, +1 Kanan]
    const thrustOutput = brainDecision.outputs[1]; // [-1 Rem/Mundur, +1 Maju]

    // 3. Eksekusi Pergerakan Berdasarkan Model Fisika
    this.move(steerOutput, thrustOutput);

    // Rekam jejak pergerakan (opsional, dibatasi agar tidak lag)
    if (this.lifespan % 3 === 0) {
      this.trail.push({x: this.x, y: this.y});
      if (this.trail.length > this.trailLength) {
        this.trail.shift();
      }
    }

    // 4. Evaluasi Jarak Terdekat ke Target
    if (distToTarget < this.minDistanceToTarget) {
      this.minDistanceToTarget = distToTarget;
    }

    // 5. Cek Apakah Agen Berhasil Menjangkau Target
    if (distToTarget < this.radius + 15) { // 15px toleransi target
      this.reachedTarget = true;
      this.alive = false;
      this.successTime = this.lifespan;
    }

    // 6. Batas waktu mati (Time-out jika diam)
    if (this.lifespan >= maxLifespan) {
      this.alive = false;
    }
  }

  /**
   * Fisika Pergerakan Agen
   */
  move(steer, thrust) {
    switch (this.type) {
      case 'spaceship':
        // Meluncur dengan gesekan sangat rendah (asteroid style)
        this.angle += steer * this.rotationSpeed;
        
        if (thrust > 0) {
          this.vx += Math.cos(this.angle) * thrust * this.acceleration;
          this.vy += Math.sin(this.angle) * thrust * this.acceleration;
        }
        
        // Aplikasikan gesekan
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Batasi kecepatan maks
        let shipSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (shipSpeed > this.maxSpeed) {
          this.vx = (this.vx / shipSpeed) * this.maxSpeed;
          this.vy = (this.vy / shipSpeed) * this.maxSpeed;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        break;

      case 'car':
        // Fisika mobil: hanya melaju searah hadap sudut kemudi
        this.angle += steer * this.rotationSpeed * (thrust >= 0 ? 1 : -0.5); 
        
        let currentCarSpeed = thrust * this.maxSpeed;
        
        // Kecepatan perlahan mengikuti akselerasi
        this.vx = Math.cos(this.angle) * currentCarSpeed;
        this.vy = Math.sin(this.angle) * currentCarSpeed;
        
        this.x += this.vx;
        this.y += this.vy;
        break;

      case 'ant':
        // Langkah diskrit, tidak meluncur, kemudi berputar cepat
        this.angle += steer * this.rotationSpeed;
        
        let antSpeed = Math.max(0, thrust) * this.maxSpeed;
        this.vx = Math.cos(this.angle) * antSpeed;
        this.vy = Math.sin(this.angle) * antSpeed;
        
        this.x += this.vx;
        this.y += this.vy;
        break;

      case 'drone':
      default:
        // Kemudi Quadcopter: Rotasi + Dorongan Thruster (Hovering Fluid)
        this.angle += steer * this.rotationSpeed;
        
        // Hanya berakselerasi jika thrust > 0 (tidak ada rem mundur)
        if (thrust > 0) {
          this.vx += Math.cos(this.angle) * thrust * this.acceleration;
          this.vy += Math.sin(this.angle) * thrust * this.acceleration;
        }
        
        // Hambatan angin/perlambatan alami
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Batasi kecepatan
        let droneSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (droneSpeed > this.maxSpeed) {
          this.vx = (this.vx / droneSpeed) * this.maxSpeed;
          this.vy = (this.vy / droneSpeed) * this.maxSpeed;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        break;
    }
  }

  /**
   * Cek Tabrakan Fisik dengan Dinding atau Ranjau Bergerak
   */
  checkCollisions(obstacles, bounds) {
    if (!this.alive) return;

    // 1. Tabrakan dengan tepi kanvas simulasi
    if (this.x - this.radius < 0 || this.x + this.radius > bounds.width ||
        this.y - this.radius < 0 || this.y + this.radius > bounds.height) {
      this.die();
      return;
    }

    // 2. Tabrakan dengan dinding statis & ranjau dinamis
    for (const obs of obstacles) {
      if (obs.type === 'wall') {
        // Deteksi tabrakan lingkaran vs persegi
        const closestX = Math.max(obs.x, Math.min(this.x, obs.x + obs.w));
        const closestY = Math.max(obs.y, Math.min(this.y, obs.y + obs.h));
        const d = this.distance(this.x, this.y, closestX, closestY);
        
        if (d < this.radius) {
          this.die();
          return;
        }
      } else if (obs.type === 'mine') {
        // Tabrakan lingkaran vs lingkaran
        const d = this.distance(this.x, this.y, obs.x, obs.y);
        if (d < this.radius + obs.r) {
          this.die();
          return;
        }
      }
    }
  }

  die() {
    this.alive = false;
    this.crashed = true;
  }

  /**
   * Menghitung Nilai Kecocokan (Fitness) Akhir
   * Memadukan non-linear progress, waktu cepat, dan penalti tabrakan.
   */
  calculateFitness(startDistance) {
    // 1. Evaluasi seberapa dekat agen berhasil menjangkau target
    // Gunakan fungsi eksponensial non-linear agar seleksi menghargai kemajuan ekstrem
    const distanceCloseness = Math.max(0, startDistance - this.minDistanceToTarget);
    let ratio = distanceCloseness / startDistance; // [0, 1]
    
    // Pangkatkan rasio untuk memicu persaingan ketat di dekat target
    this.fitness = Math.pow(ratio, 3) * 100;
    
    // Tambah skor kecil karena bertahan hidup dan terus menjelajah
    this.fitness += this.lifespan * 0.05;

    // 2. Bonus jika berhasil mencapai target
    if (this.reachedTarget) {
      // Diberikan bonus besar, ditambah efisiensi waktu (semakin cepat, semakin tinggi bonusnya)
      const timeBonus = Math.max(0, 1000 - this.successTime) * 3;
      this.fitness += 5000 + timeBonus;
    }

    // 3. Penalti jika menabrak dinding rintangan
    // Ini mengajarkan agen agar tidak ceroboh, melatih refleks menghindar
    if (this.crashed) {
      this.fitness *= 0.45; // Mengurangi fitness sebanyak 55%
    }
    
    // Pastikan tidak ada nilai fitness negatif atau nol mutlak
    this.fitness = Math.max(0.1, this.fitness);
  }

  // --- HELPER GEOMETRI & JALUR ---

  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  /**
   * Perpotongan Segmen Garis A (p1, p2) dengan Segmen Garis B (p3, p4)
   * Menggunakan Cramer's rule untuk pencarian titik potong 2D
   */
  getLineIntersection(p1, p2, p3, p4) {
    const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denominator === 0) return null; // Garis sejajar

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

    // Apakah titik potong berada di dalam kedua segmen garis?
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return {
        x: p1.x + ua * (p2.x - p1.x),
        y: p1.y + ua * (p2.y - p1.y)
      };
    }
    return null;
  }

  /**
   * Mencari titik potong antara Ray dan Lingkaran
   * p1: Asal Ray, p2: Ujung Ray, c: Lingkaran {x, y, r}
   */
  getRayCircleIntersection(p1, p2, c) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // Arah Ray yang ternormalisasi
    const rx = dx / len;
    const ry = dy / len;

    // Vektor dari asal Ray ke pusat lingkaran
    const cx = c.x - p1.x;
    const cy = c.y - p1.y;

    // Proyeksi proyeksi vektor pusat lingkaran ke Ray
    const t = cx * rx + cy * ry;

    // Titik terdekat pada ray ke pusat lingkaran
    const px = p1.x + t * rx;
    const py = p1.y + t * ry;

    // Jarak tegak lurus dari pusat lingkaran ke ray
    const distSq = (c.x - px) * (c.x - px) + (c.y - py) * (c.y - py);

    // Jika jarak tegak lurus lebih kecil dari radius, ada kemungkinan perpotongan
    if (distSq < c.r * c.r) {
      const dt = Math.sqrt(c.r * c.r - distSq);
      
      // Ada dua titik potong t1 dan t2
      const t1 = t - dt;
      const t2 = t + dt;

      // Ambil t positif terdekat (di depan ray dan di dalam panjang ray)
      if (t1 >= 0 && t1 <= len) {
        return { x: p1.x + t1 * rx, y: p1.y + t1 * ry };
      }
      if (t2 >= 0 && t2 <= len) {
        return { x: p1.x + t2 * rx, y: p1.y + t2 * ry };
      }
    }
    return null;
  }
}
