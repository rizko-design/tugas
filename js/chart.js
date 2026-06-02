/**
 * PerformanceChart
 * Chart interaktif berbasis HTML5 Canvas yang dibuat khusus (Zero-Dependency).
 * Menggambar kurva kemajuan evolusi dengan efek neon glow dan interaksi hover presisi.
 */
class PerformanceChart {
  constructor(canvasId, tooltipId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById(tooltipId);
    
    this.history = []; // Array of { gen: X, max: Y, avg: Z }
    
    // Konfigurasi Margin Gambar
    this.margin = { top: 25, right: 25, bottom: 35, left: 50 };
    
    this.hoveredIndex = -1;
    
    this.initEvents();
    this.resize();
  }

  /**
   * Mengatur deteksi ukuran dinamis (responsif)
   */
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.width = rect.width;
    this.height = rect.height;
    
    this.draw();
  }

  /**
   * Inisialisasi event mouse hover untuk menampilkan tooltip interaktif
   */
  initEvents() {
    window.addEventListener('resize', () => this.resize());
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.history.length === 0) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Temukan titik terdekat berdasarkan koordinat X
      const chartWidth = this.width - this.margin.left - this.margin.right;
      const xRatio = chartWidth / Math.max(1, this.history.length - 1);
      
      let index = Math.round((mouseX - this.margin.left) / xRatio);
      index = Math.max(0, Math.min(index, this.history.length - 1));
      
      // Hitung posisi visual titik data
      const xPos = this.margin.left + index * xRatio;
      
      // Jika kursor berada di dekat titik data secara horizontal, tampilkan tooltip
      if (Math.abs(mouseX - xPos) < xRatio * 0.8) {
        this.hoveredIndex = index;
        this.showTooltip(e.clientX, e.clientY, index);
      } else {
        this.hoveredIndex = -1;
        this.tooltip.style.display = 'none';
      }
      
      this.draw();
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredIndex = -1;
      this.tooltip.style.display = 'none';
      this.draw();
    });
  }

  /**
   * Menambahkan data baru dan menggambar ulang
   */
  addData(generation, maxFitness, avgFitness) {
    this.history.push({
      gen: generation,
      max: maxFitness,
      avg: avgFitness
    });
    this.draw();
  }

  clear() {
    this.history = [];
    this.hoveredIndex = -1;
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.draw();
  }

  /**
   * Menampilkan popup tooltip glassmorphism di atas kursor
   */
  showTooltip(clientX, clientY, index) {
    const data = this.history[index];
    if (!data) return;

    this.tooltip.innerHTML = `
      <div style="font-weight: 700; color: var(--neon-cyan); border-bottom: 1px solid rgba(0,240,255,0.2); padding-bottom: 4px; margin-bottom: 6px;">GENERASI ${data.gen}</div>
      <div><span style="color: var(--text-secondary)">Fitness Maks:</span> <span style="color: var(--neon-pink); font-weight:700;">${data.max.toFixed(1)}</span></div>
      <div><span style="color: var(--text-secondary)">Fitness Rerata:</span> <span style="color: var(--neon-purple); font-weight:700;">${data.avg.toFixed(1)}</span></div>
    `;

    this.tooltip.style.display = 'block';
    
    // Atur posisi tooltip agar tidak keluar layar
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    
    let left = clientX + 15;
    let top = clientY - tooltipHeight - 10;
    
    if (left + tooltipWidth > window.innerWidth) {
      left = clientX - tooltipWidth - 15;
    }
    if (top < 0) {
      top = clientY + 15;
    }
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  /**
   * Fungsi Gambar Utama
   */
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    
    const chartWidth = this.width - this.margin.left - this.margin.right;
    const chartHeight = this.height - this.margin.top - this.margin.bottom;
    
    // Jika tidak ada data, gambar teks panduan awal
    if (this.history.length === 0) {
      ctx.font = `12px "Inter"`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Menunggu data evolusi...', this.width / 2, this.height / 2);
      return;
    }

    // 1. Hitung Rentang Skala Sumbu X & Y
    const maxVal = Math.max(...this.history.map(d => d.max)) * 1.1 || 10;
    const minVal = 0;
    const valRange = maxVal - minVal;
    
    const dataLen = this.history.length;
    const xRatio = chartWidth / Math.max(1, dataLen - 1);

    // 2. Gambar Gridlines & Label Sumbu Y (Faktor Fitness)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono"';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const yVal = minVal + (valRange / yTicks) * i;
      const yPos = this.height - this.margin.bottom - (yVal / maxVal) * chartHeight;
      
      // Garis horizontal grid
      ctx.beginPath();
      ctx.moveTo(this.margin.left, yPos);
      ctx.lineTo(this.width - this.margin.right, yPos);
      ctx.stroke();
      
      // Label teks di kiri sumbu Y
      ctx.fillText(yVal.toFixed(0), this.margin.left - 10, yPos);
    }

    // 3. Gambar Label Sumbu X (Generasi)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Pilih lompatan label jika generasi sudah terlampau banyak
    const xStep = Math.max(1, Math.ceil(dataLen / 6));
    for (let i = 0; i < dataLen; i += xStep) {
      const xPos = this.margin.left + i * xRatio;
      ctx.fillText(`G${this.history[i].gen}`, xPos, this.height - this.margin.bottom + 8);
      
      // Garis vertikal grid halus
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.beginPath();
      ctx.moveTo(xPos, this.margin.top);
      ctx.lineTo(xPos, this.height - this.margin.bottom);
      ctx.stroke();
    }

    // Border Sumbu Utama
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.margin.left, this.margin.top);
    ctx.lineTo(this.margin.left, this.height - this.margin.bottom);
    ctx.lineTo(this.width - this.margin.right, this.height - this.margin.bottom);
    ctx.stroke();

    // 4. Gambar Garis Kurva Keberhasilan
    this.drawLineCurve(maxVal, chartHeight, xRatio, 'max', 'rgba(255, 0, 127, 0.85)', '#ff007f'); // Max Fitness = Neon Pink
    this.drawLineCurve(maxVal, chartHeight, xRatio, 'avg', 'rgba(189, 0, 255, 0.85)', '#bd00ff'); // Avg Fitness = Neon Purple

    // 5. Gambar Efek Hover Vertikal & Sorotan Node
    if (this.hoveredIndex !== -1) {
      const idx = this.hoveredIndex;
      const xPos = this.margin.left + idx * xRatio;
      
      // Garis vertikal indikator cursor
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xPos, this.margin.top);
      ctx.lineTo(xPos, this.height - this.margin.bottom);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Sorotan lingkaran pada kurva MAX
      const yPosMax = this.height - this.margin.bottom - (this.history[idx].max / maxVal) * chartHeight;
      this.drawNodeHighlight(xPos, yPosMax, '#ff007f');

      // Sorotan lingkaran pada kurva AVG
      const yPosAvg = this.height - this.margin.bottom - (this.history[idx].avg / maxVal) * chartHeight;
      this.drawNodeHighlight(xPos, yPosAvg, '#bd00ff');
    }
  }

  /**
   * Menggambar kurva berjalur halus (Cubic Spline/Bezier)
   */
  drawLineCurve(maxVal, chartHeight, xRatio, propName, strokeColor, glowColor) {
    const ctx = this.ctx;
    ctx.save();
    
    // Set Neon Glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    
    for (let i = 0; i < this.history.length; i++) {
      const x = this.margin.left + i * xRatio;
      const y = this.height - this.margin.bottom - (this.history[i][propName] / maxVal) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Gunakan interpolasi kubik buatan sendiri yang sederhana dan mulus
        const prevX = this.margin.left + (i - 1) * xRatio;
        const prevY = this.height - this.margin.bottom - (this.history[i - 1][propName] / maxVal) * chartHeight;
        
        const cpX1 = prevX + (x - prevX) / 2;
        const cpY1 = prevY;
        const cpX2 = prevX + (x - prevX) / 2;
        const cpY2 = y;
        
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y);
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Sorotan Node Data Lingkaran saat di-hover
   */
  drawNodeHighlight(x, y, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    
    // Bulatan Luar Transparan
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Bulatan Inti
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  }
}
