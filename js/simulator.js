/**
 * Simulator
 * Mengelola area kanvas utama, penggambaran grafis canggih (agen, target, rintangan),
 * deteksi klik & seret mouse untuk menggambar dinding/ranjau, drag-drop target/spawn,
 * serta memuat level rintangan preset.
 */
class Simulator {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Titik Spawn & Target Awal
    this.spawnPoint = { x: 80, y: 350 };
    this.target = { x: 720, y: 150 };
    
    // Rintangan (Dinding & Ranjau)
    this.obstacles = [];
    
    // Konfigurasi Interaktivitas Mouse
    this.activeTool = 'drawWall'; // 'drawWall' atau 'spawnMine'
    this.isDrawing = false;
    this.drawStart = { x: 0, y: 0 };
    this.drawEnd = { x: 0, y: 0 };
    
    this.draggingTarget = false;
    this.draggingSpawn = false;
    this.dragOffset = { x: 0, y: 0 };
    
    // Rotasi target untuk animasi berputar
    this.targetRotation = 0;
    
    this.resize();
    this.initEvents();
    this.loadPreset('gauntlet'); // Level default
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    this.bounds = {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    // Deteksi Mouse Turun (Mousedown)
    this.canvas.addEventListener('mousedown', (e) => {
      const pos = this.getMousePos(e);
      
      // 1. Cek apakah pengguna mengklik Target untuk diseret
      const distToTarget = this.distance(pos.x, pos.y, this.target.x, this.target.y);
      if (distToTarget < 25) {
        this.draggingTarget = true;
        return;
      }

      // 2. Cek apakah pengguna mengklik Spawn Point untuk diseret
      const distToSpawn = this.distance(pos.x, pos.y, this.spawnPoint.x, this.spawnPoint.y);
      if (distToSpawn < 25) {
        this.draggingSpawn = true;
        return;
      }

      // 3. Jika tidak menyeret pin, aktifkan alat gambar
      if (this.activeTool === 'drawWall') {
        this.isDrawing = true;
        this.drawStart = pos;
        this.drawEnd = pos;
      } else if (this.activeTool === 'spawnMine') {
        // Langsung taruh ranjau bergerak
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 2.0;
        this.obstacles.push({
          id: 'mine_' + Date.now(),
          type: 'mine',
          x: pos.x,
          y: pos.y,
          r: 14,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed
        });
      }
    });

    // Deteksi Gerakan Mouse (Mousemove)
    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getMousePos(e);

      if (this.draggingTarget) {
        // Seret target ke posisi mouse baru (dibatasi batas kanvas)
        this.target.x = Math.max(20, Math.min(pos.x, this.bounds.width - 20));
        this.target.y = Math.max(20, Math.min(pos.y, this.bounds.height - 20));
      } else if (this.draggingSpawn) {
        // Seret spawn ke posisi mouse baru
        this.spawnPoint.x = Math.max(20, Math.min(pos.x, this.bounds.width - 20));
        this.spawnPoint.y = Math.max(20, Math.min(pos.y, this.bounds.height - 20));
      } else if (this.isDrawing && this.activeTool === 'drawWall') {
        this.drawEnd = pos;
      }
    });

    // Lepas Mouse (Mouseup)
    window.addEventListener('mouseup', () => {
      this.draggingTarget = false;
      this.draggingSpawn = false;
      
      if (this.isDrawing && this.activeTool === 'drawWall') {
        this.isDrawing = false;
        
        // Hitung koordinat pojok kiri atas dan ukuran persegi
        const x = Math.min(this.drawStart.x, this.drawEnd.x);
        const y = Math.min(this.drawStart.y, this.drawEnd.y);
        const w = Math.abs(this.drawEnd.x - this.drawStart.x);
        const h = Math.abs(this.drawEnd.y - this.drawStart.y);

        // Jangan simpan dinding jika terlalu kecil (tidak sengaja terklik)
        if (w > 8 && h > 8) {
          this.obstacles.push({
            id: 'wall_' + Date.now(),
            type: 'wall',
            x: x,
            y: y,
            w: w,
            h: h
          });
        }
      }
    });
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Mengupdate rintangan dinamis (ranjau memantul, dinding geser)
   */
  updateObstacles(frameCount) {
    for (let obs of this.obstacles) {
      if (obs.type === 'mine') {
        // Gerakan ranjau
        obs.x += obs.vx;
        obs.y += obs.vy;

        // Memantul dari tepi batas kanvas
        if (obs.x - obs.r < 0) {
          obs.x = obs.r;
          obs.vx = -obs.vx;
        } else if (obs.x + obs.r > this.bounds.width) {
          obs.x = this.bounds.width - obs.r;
          obs.vx = -obs.vx;
        }

        if (obs.y - obs.r < 0) {
          obs.y = obs.r;
          obs.vy = -obs.vy;
        } else if (obs.y + obs.r > this.bounds.height) {
          obs.y = this.bounds.height - obs.r;
          obs.vy = -obs.vy;
        }
      } else if (obs.type === 'slidingWall') {
        // Dinding dinamis geser vertikal berdasarkan fungsi sinus
        obs.y = obs.baseY + Math.sin(frameCount * obs.speedFactor) * obs.range;
      }
    }
  }

  /**
   * Menggambar Seluruh Dunia Simulasi
   * @param {Array<Agent>} agents - Populasi agen
   * @param {Agent} bestAgent - Agen terbaik saat ini yang sedang hidup
   */
  draw(agents, bestAgent = null) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.bounds.width, this.bounds.height);

    // Animasi rotasi ikon target
    this.targetRotation += 0.015;

    // 1. Gambar Area Pendaratan Awal (Green Spawn Dock)
    this.drawSpawnDock();

    // 2. Gambar Jalur Trail Milik Agen Terbaik Terlebih Dahulu (di belakang objek lain)
    if (bestAgent && bestAgent.trail && bestAgent.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bestAgent.trail[0].x, bestAgent.trail[0].y);
      for (let i = 1; i < bestAgent.trail.length; i++) {
        ctx.lineTo(bestAgent.trail[i].x, bestAgent.trail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Gambar Semua Rintangan (Dinding & Ranjau)
    for (const obs of this.obstacles) {
      if (obs.type === 'wall' || obs.type === 'slidingWall') {
        this.drawWall(obs);
      } else if (obs.type === 'mine') {
        this.drawMine(obs);
      }
    }

    // 4. Gambar Preview Kotak Dinding yang sedang digambar user
    if (this.isDrawing && this.activeTool === 'drawWall') {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      
      const x = Math.min(this.drawStart.x, this.drawEnd.x);
      const y = Math.min(this.drawStart.y, this.drawEnd.y);
      const w = Math.abs(this.drawEnd.x - this.drawStart.x);
      const h = Math.abs(this.drawEnd.y - this.drawStart.y);
      
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]); // Reset
    }

    // 5. Gambar Populasi Agen Aktif
    for (const agent of agents) {
      if (!agent.alive) continue;
      
      // Jika dia agen terbaik, gambar dengan sorotan khusus nanti
      if (agent === bestAgent) continue;
      
      this.drawAgent(agent, false);
    }

    // Gambar Agen Terbaik di bagian paling atas agar tidak tertutup, lengkap dengan radar sensori aktif!
    if (bestAgent && bestAgent.alive) {
      this.drawAgentSensors(bestAgent);
      this.drawAgent(bestAgent, true);
    }

    // 6. Gambar Pin Target Utama (Pink Pulsing Target)
    this.drawTargetNode();
  }

  /**
   * Menggambar Dermaga Lepas Landas (Spawn Dock)
   */
  drawSpawnDock() {
    const ctx = this.ctx;
    const { x, y } = this.spawnPoint;
    
    ctx.save();
    // Lingkaran luar berkerlip
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();

    // Lingkaran dalam
    ctx.fillStyle = 'rgba(57, 255, 20, 0.06)';
    ctx.strokeStyle = 'var(--neon-green)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Teks H (Helipad futuristik)
    ctx.fillStyle = 'var(--neon-green)';
    ctx.font = 'bold 11px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', x, y);
    ctx.restore();
  }

  /**
   * Menggambar target tujuan berputar & berkerlip neon pink
   */
  drawTargetNode() {
    const ctx = this.ctx;
    const { x, y } = this.target;
    
    ctx.save();
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 12;

    // Lingkaran pendar luar
    ctx.fillStyle = 'rgba(255, 0, 127, 0.1)';
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Roda sasaran radar berputar
    ctx.translate(x, y);
    ctx.rotate(this.targetRotation);
    
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Salib bidik radar
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0); ctx.lineTo(16, 0);
    ctx.moveTo(0, -16); ctx.lineTo(0, -8);
    ctx.moveTo(0, 8); ctx.lineTo(0, 16);
    ctx.stroke();

    // Titik pusat target
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Menggambar dinding statis solid cyberpunk
   */
  drawWall(obs) {
    const ctx = this.ctx;
    ctx.save();
    
    // Gradasi isi dinding glassmorphic
    const grad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
    grad.addColorStop(0, '#111728');
    grad.addColorStop(1, '#0b0f1a');
    
    ctx.fillStyle = grad;
    ctx.strokeStyle = obs.type === 'slidingWall' ? 'var(--neon-yellow)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    
    // Efek glow tipis pada gerbang dinamis
    if (obs.type === 'slidingWall') {
      ctx.shadowColor = 'var(--neon-yellow)';
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
    ctx.fill();
    ctx.stroke();

    // Garis diagonal arsir interior ala besi baja
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let offset = 0; offset < obs.w + obs.h; offset += 16) {
      // Potong garis agar pas di dalam persegi
      const startX = Math.max(obs.x, obs.x + offset - obs.h);
      const startY = Math.min(obs.y + obs.h, obs.y + offset);
      const endX = Math.min(obs.x + obs.w, obs.x + offset);
      const endY = Math.max(obs.y, obs.y + offset - obs.w);
      if (startX < endX) {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
      }
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Menggambar ranjau bergerak berduri neon kuning
   */
  drawMine(obs) {
    const ctx = this.ctx;
    ctx.save();
    
    ctx.shadowColor = 'var(--neon-yellow)';
    ctx.shadowBlur = 10;
    
    // Lingkaran hazard
    ctx.fillStyle = 'rgba(255, 223, 0, 0.15)';
    ctx.strokeStyle = 'var(--neon-yellow)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gambar duri/radiasi kecil menyebar
    ctx.translate(obs.x, obs.y);
    ctx.rotate(this.targetRotation * -1.5); // Berputar berlawanan arah target
    
    ctx.fillStyle = 'var(--neon-yellow)';
    const spikeCount = 6;
    for (let i = 0; i < spikeCount; i++) {
      ctx.rotate((Math.PI * 2) / spikeCount);
      ctx.beginPath();
      ctx.moveTo(-2, -obs.r);
      ctx.lineTo(2, -obs.r);
      ctx.lineTo(0, -obs.r - 5);
      ctx.closePath();
      ctx.fill();
    }

    // Pusat core ranjau
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Menggambar visualisasi pancaran Radar Sensor
   */
  drawAgentSensors(agent) {
    const ctx = this.ctx;
    ctx.save();
    
    for (const sensor of agent.sensors) {
      // Gradasi sensor memudar: hijau jika aman (1.0), merah menyala jika menabrak (0.0)
      const isDangerous = sensor.value < 0.3;
      const alpha = 0.12 + (1.0 - sensor.value) * 0.25;
      
      ctx.strokeStyle = isDangerous 
        ? `rgba(255, 0, 127, ${alpha * 1.5})` 
        : `rgba(0, 240, 255, ${alpha})`;
      ctx.lineWidth = isDangerous ? 1.5 : 1.0;
      
      // Menggambar pancaran ray
      ctx.beginPath();
      ctx.moveTo(sensor.x1, sensor.y1);
      ctx.lineTo(sensor.cx, sensor.cy);
      ctx.stroke();
      
      // Titik benturan sensor dengan penghalang
      if (sensor.value < 0.99) {
        ctx.fillStyle = isDangerous ? 'var(--neon-pink)' : 'var(--neon-cyan)';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(sensor.cx, sensor.cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Menggambar Agen (Quadcopter, Spaceship, Car, Ant) menggunakan Canvas Vector
   */
  drawAgent(agent, isBest = false) {
    const ctx = this.ctx;
    ctx.save();
    
    ctx.translate(agent.x, agent.y);
    ctx.rotate(agent.angle);

    // Tentukan skema warna
    const neonColor = isBest ? 'var(--neon-cyan)' : 'var(--neon-purple)';
    const glowColor = isBest ? '#00f0ff' : '#bd00ff';
    const fillOpacity = isBest ? 0.35 : 0.2;

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isBest ? 12 : 5;

    switch (agent.type) {
      case 'spaceship':
        this.drawSpaceshipGraphics(ctx, agent, neonColor, fillOpacity);
        break;
      case 'car':
        this.drawCarGraphics(ctx, agent, neonColor, fillOpacity);
        break;
      case 'ant':
        this.drawAntGraphics(ctx, agent, neonColor, fillOpacity);
        break;
      case 'drone':
      default:
        this.drawDroneGraphics(ctx, agent, neonColor, fillOpacity, isBest);
        break;
    }

    ctx.restore();
  }

  /**
   * Rancang Gambar Drone Quadcopter Futuristik
   */
  drawDroneGraphics(ctx, agent, color, opacity, isBest) {
    const r = agent.radius;
    
    // 1. Gambar 4 Baling-Baling Quadrotor (Lengan Bersilang)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-r, -r); ctx.lineTo(r, r);
    ctx.moveTo(-r, r); ctx.lineTo(r, -r);
    ctx.stroke();

    // 2. Lingkaran Pelindung Baling-baling (Prop Guards)
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(13, 18, 31, 0.8)';
    ctx.lineWidth = 1.2;
    
    const propPositions = [
      {x: -r, y: -r}, {x: r, y: -r},
      {x: -r, y: r}, {x: r, y: r}
    ];

    for (let pos of propPositions) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Gambar baling-baling tipis berputar di dalam
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(Date.now() * 0.08); // Efek putaran kencang
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Badan Inti Drone (Main Cockpit Capsule)
    ctx.fillStyle = `rgba(13, 21, 39, 0.9)`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -12, 16, 24, 6);
    ctx.fill();
    ctx.stroke();

    // 4. Kaca Kokpit Bersinar
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-5, -9, 10, 8, 3);
    ctx.fill();
    
    // Lampu Status LED Belakang
    ctx.fillStyle = isBest ? 'var(--neon-green)' : 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(0, 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Rancang Gambar Kapal Terbang Plasma
   */
  drawSpaceshipGraphics(ctx, agent, color, opacity) {
    const r = agent.radius;
    
    // Semburan roket plasma belakang saat akselerasi
    ctx.fillStyle = 'var(--neon-pink)';
    ctx.beginPath();
    ctx.moveTo(-5, r);
    ctx.lineTo(5, r);
    ctx.lineTo(0, r + 4 + Math.random() * 8);
    ctx.closePath();
    ctx.fill();

    // Sayap Kiri Kanan
    ctx.fillStyle = 'rgba(13, 21, 39, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    
    ctx.beginPath();
    ctx.moveTo(-r, r);
    ctx.lineTo(0, -r);
    ctx.lineTo(r, r);
    ctx.lineTo(0, r - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Panel Energi Center
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(0, -r + 5);
    ctx.lineTo(3, 0);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Rancang Gambar Mobil Balap
   */
  drawCarGraphics(ctx, agent, color, opacity) {
    const r = agent.radius;
    const w = agent.width;
    const h = agent.height;
    
    // Ban Kiri/Kanan depan belakang
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    // Kiri Depan
    ctx.fillRect(-w/2 + 2, -h/2 - 2, 6, 3);
    ctx.strokeRect(-w/2 + 2, -h/2 - 2, 6, 3);
    // Kanan Depan
    ctx.fillRect(w/2 - 8, -h/2 - 2, 6, 3);
    ctx.strokeRect(w/2 - 8, -h/2 - 2, 6, 3);
    // Kiri Belakang
    ctx.fillRect(-w/2 + 2, h/2 - 1, 6, 3);
    ctx.strokeRect(-w/2 + 2, h/2 - 1, 6, 3);
    // Kanan Belakang
    ctx.fillRect(w/2 - 8, h/2 - 1, 6, 3);
    ctx.strokeRect(w/2 - 8, h/2 - 1, 6, 3);

    // Sasis Mobil
    ctx.fillStyle = 'rgba(13, 21, 39, 0.95)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-w/2 + 2, -h/2, w - 4, h, 4);
    ctx.fill();
    ctx.stroke();

    // Kaca Depan Mobil (Windshield)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/4, -h/6);
    ctx.lineTo(w/4, -h/6);
    ctx.lineTo(w/6, -h/2.5);
    ctx.lineTo(-w/6, -h/2.5);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Rancang Gambar Semut Serangga
   */
  drawAntGraphics(ctx, agent, color, opacity) {
    const r = agent.radius;
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;

    // 1. Gambar kaki-kaki semut menyamping
    ctx.beginPath();
    // Kaki Kiri
    ctx.moveTo(0, -2); ctx.lineTo(-10, -5);
    ctx.moveTo(0, 0); ctx.lineTo(-11, 0);
    ctx.moveTo(0, 2); ctx.lineTo(-10, 5);
    // Kaki Kanan
    ctx.moveTo(0, -2); ctx.lineTo(10, -5);
    ctx.moveTo(0, 0); ctx.lineTo(11, 0);
    ctx.moveTo(0, 2); ctx.lineTo(10, 5);
    ctx.stroke();

    // 2. Tiga bagian tubuh serangga (Kepala, Dada, Abdomen)
    // Abdomen belakang besar
    ctx.fillStyle = 'rgba(13, 18, 31, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 5, 4.5, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Dada tengah
    ctx.beginPath();
    ctx.arc(0, -1, 3.2, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Kepala depan
    ctx.beginPath();
    ctx.arc(0, -6, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Antena kecil di depan kepala
    ctx.beginPath();
    ctx.moveTo(-1, -8.5); ctx.quadraticCurveTo(-3, -11, -5, -12);
    ctx.moveTo(1, -8.5); ctx.quadraticCurveTo(3, -11, 5, -12);
    ctx.stroke();
  }

  /**
   * Membersihkan seluruh rintangan buatan
   */
  clearObstacles() {
    this.obstacles = [];
  }

  /**
   * Mengisi kanvas dengan peta rintangan preset pilihan
   */
  loadPreset(presetName) {
    this.clearObstacles();
    this.resize();

    const w = this.bounds.width;
    const h = this.bounds.height;

    switch (presetName) {
      case 'empty':
        this.spawnPoint = { x: 80, y: h / 2 };
        this.target = { x: w - 80, y: h / 2 };
        break;

      case 'gauntlet':
        // Rintangan berselang-seling atas bawah S-shape
        this.spawnPoint = { x: 80, y: h / 2 };
        this.target = { x: w - 80, y: h / 2 };

        this.obstacles.push(
          { id: 'w1', type: 'wall', x: w * 0.28, y: 0, w: 40, h: h * 0.65 },
          { id: 'w2', type: 'wall', x: w * 0.52, y: h * 0.35, w: 40, h: h * 0.65 },
          { id: 'w3', type: 'wall', x: w * 0.74, y: 0, w: 40, h: h * 0.65 }
        );
        break;

      case 'maze':
        // Labirin jalur liku sempit
        this.spawnPoint = { x: 80, y: 80 };
        this.target = { x: w - 80, y: h - 80 };

        this.obstacles.push(
          // Dinding horisontal atas
          { id: 'm1', type: 'wall', x: 0, y: 150, w: w * 0.75, h: 25 },
          // Penyekat vertikal
          { id: 'm2', type: 'wall', x: w * 0.4, y: 175, w: 25, h: h * 0.5 },
          // Dinding horisontal bawah
          { id: 'm3', type: 'wall', x: w * 0.25, y: h - 150, w: w * 0.75, h: 25 }
        );
        break;

      case 'minefield':
        // Medan ranjau bergerak
        this.spawnPoint = { x: 80, y: h / 2 };
        this.target = { x: w - 80, y: h / 2 };

        // Taruh 8 ranjau mengorbit acak dengan kecepatan beragam
        for (let i = 0; i < 9; i++) {
          const rx = w * 0.25 + Math.random() * (w * 0.5);
          const ry = h * 0.15 + Math.random() * (h * 0.7);
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.0 + Math.random() * 2.2;
          
          this.obstacles.push({
            id: 'mfield_' + i,
            type: 'mine',
            x: rx,
            y: ry,
            r: 13,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed
          });
        }
        break;

      case 'gauntletDynamic':
        // Gerbang geser vertikal raksasa (dinamik)
        this.spawnPoint = { x: 80, y: h / 2 };
        this.target = { x: w - 80, y: h / 2 };

        // Dinding vertikal geser naik turun
        this.obstacles.push(
          { id: 'gw1', type: 'slidingWall', x: w * 0.30, y: 0, baseY: h * 0.05, w: 40, h: h * 0.5, speedFactor: 0.02, range: h * 0.35 },
          { id: 'gw2', type: 'slidingWall', x: w * 0.55, y: 0, baseY: h * 0.45, w: 40, h: h * 0.5, speedFactor: 0.025, range: h * 0.35 }
        );
        break;
    }
  }

  // --- GEOMETRI UTILITIES ---
  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }
}
