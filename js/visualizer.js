/**
 * ActiveNNVisualizer
 * Menggambar diagram jaringan saraf aktif milik agen terbaik secara real-time pada Canvas.
 * Menampilkan aktivasi node, bobot koneksi positif/negatif, dan denyut aliran sinyal (animasi).
 */
class ActiveNNVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Label node untuk dipasang pada diagram
    this.inputLabels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'SPD', 'T-ANG', 'T-DST'];
    this.outputLabels = ['KEMUDI', 'GAS'];
    
    this.animationOffset = 0;
    this.resize();
    this.initEvents();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.width = rect.width;
    this.height = rect.height;
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Menggambar struktur saraf
   * @param {NeuralNetwork} nn - Objek Jaringan Saraf Agen Terbaik
   * @param {Object} activeState - State aktivasi hasil feedforward {inputs, hidden, outputs}
   */
  draw(nn, activeState = null) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    
    if (!nn) {
      ctx.font = '12px "Inter"';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Belum ada data agen terbaik...', this.width / 2, this.height / 2);
      return;
    }

    // Animasi denyut sinyal
    this.animationOffset = (this.animationOffset + 0.02) % 1.0;

    // 1. Tentukan posisi koordinat Node tiap Layer
    const layerX = {
      input: 50,
      hidden: this.width / 2,
      output: this.width - 50
    };

    const nodeRadius = 10;
    
    // Hitung koordinat Y untuk Input Layer
    const inputNodesCount = nn.inputNodes;
    const inputSpacing = (this.height - 30) / inputNodesCount;
    const inputY = [];
    for (let i = 0; i < inputNodesCount; i++) {
      inputY.push(15 + i * inputSpacing + inputSpacing / 2);
    }

    // Hitung koordinat Y untuk Hidden Layer
    const hiddenNodesCount = nn.hiddenNodes;
    const hiddenSpacing = (this.height - 30) / hiddenNodesCount;
    const hiddenY = [];
    for (let i = 0; i < hiddenNodesCount; i++) {
      hiddenY.push(15 + i * hiddenSpacing + hiddenSpacing / 2);
    }

    // Hitung koordinat Y untuk Output Layer
    const outputNodesCount = nn.outputNodes;
    const outputSpacing = (this.height - 30) / outputNodesCount;
    const outputY = [];
    for (let i = 0; i < outputNodesCount; i++) {
      outputY.push(15 + i * outputSpacing + outputSpacing / 2);
    }

    // 2. GAMBAR KONEKSI SINAPIS (Garis Bobot) & ANIMASI PULSE
    // Koneksi 1: Input -> Hidden
    for (let i = 0; i < hiddenNodesCount; i++) {
      for (let j = 0; j < inputNodesCount; j++) {
        const weight = nn.weights_ih[i][j];
        const startX = layerX.input;
        const startY = inputY[j];
        const endX = layerX.hidden;
        const endY = hiddenY[i];
        
        this.drawSynapse(startX, startY, endX, endY, weight);
      }
    }

    // Koneksi 2: Hidden -> Output
    for (let i = 0; i < outputNodesCount; i++) {
      for (let j = 0; j < hiddenNodesCount; j++) {
        const weight = nn.weights_ho[i][j];
        const startX = layerX.hidden;
        const startY = hiddenY[j];
        const endX = layerX.output;
        const endY = outputY[i];
        
        this.drawSynapse(startX, startY, endX, endY, weight);
      }
    }

    // 3. GAMBAR PULSE ELEKTRON (Aliran sinyal bergerak)
    if (activeState) {
      // Aliran Input -> Hidden
      for (let i = 0; i < hiddenNodesCount; i++) {
        for (let j = 0; j < inputNodesCount; j++) {
          const weight = nn.weights_ih[i][j];
          if (Math.abs(weight) > 0.3) { // Hanya koneksi kuat yang digambar pulsanya
            const val = activeState.inputs[j] || 0.0;
            if (Math.abs(val) > 0.1) {
              const startX = layerX.input;
              const startY = inputY[j];
              const endX = layerX.hidden;
              const endY = hiddenY[i];
              
              this.drawSignalPulse(startX, startY, endX, endY, weight, val);
            }
          }
        }
      }

      // Aliran Hidden -> Output
      for (let i = 0; i < outputNodesCount; i++) {
        for (let j = 0; j < hiddenNodesCount; j++) {
          const weight = nn.weights_ho[i][j];
          if (Math.abs(weight) > 0.3) {
            const val = activeState.hidden[j] || 0.0;
            if (Math.abs(val) > 0.1) {
              const startX = layerX.hidden;
              const startY = hiddenY[j];
              const endX = layerX.output;
              const endY = outputY[i];
              
              this.drawSignalPulse(startX, startY, endX, endY, weight, val);
            }
          }
        }
      }
    }

    // 4. GAMBAR NODE NEURON DENGAN GRADASI GLOW
    // Layer Input
    ctx.textAlign = 'right';
    ctx.font = '8px "JetBrains Mono"';
    for (let i = 0; i < inputNodesCount; i++) {
      const val = activeState ? activeState.inputs[i] : 0.0;
      this.drawNeuronNode(layerX.input, inputY[i], nodeRadius, val);
      
      // Gambar Teks Label Input
      ctx.fillStyle = '#64748b';
      ctx.fillText(this.inputLabels[i] || `In-${i}`, layerX.input - 15, inputY[i] + 3);
    }

    // Layer Hidden
    for (let i = 0; i < hiddenNodesCount; i++) {
      const val = activeState ? activeState.hidden[i] : 0.0;
      this.drawNeuronNode(layerX.hidden, hiddenY[i], nodeRadius, val);
    }

    // Layer Output
    ctx.textAlign = 'left';
    for (let i = 0; i < outputNodesCount; i++) {
      const val = activeState ? activeState.outputs[i] : 0.0;
      this.drawNeuronNode(layerX.output, outputY[i], nodeRadius, val);
      
      // Gambar Teks Label Output
      ctx.fillStyle = '#64748b';
      ctx.fillText(this.outputLabels[i] || `Out-${i}`, layerX.output + 15, outputY[i] + 3);
    }
  }

  /**
   * Menggambar garis koneksi sinapsis
   */
  drawSynapse(x1, y1, x2, y2, weight) {
    const ctx = this.ctx;
    const absW = Math.abs(weight);
    
    // Tentukan warna berdasarkan tanda bobot (+ Cyan, - Pink)
    ctx.strokeStyle = weight > 0 ? 'rgba(0, 240, 255, ' + (absW * 0.45) + ')' 
                                : 'rgba(255, 0, 127, ' + (absW * 0.45) + ')';
    ctx.lineWidth = absW * 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /**
   * Menggambar elektron sinyal mengalir sepanjang sinapsis
   */
  drawSignalPulse(x1, y1, x2, y2, weight, activation) {
    const ctx = this.ctx;
    
    // Hitung posisi interpolasi linear (lerp) pulse saat ini
    const t = this.animationOffset;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;

    // Warna pulse menyesuaikan jenis bobot
    ctx.fillStyle = weight > 0 ? 'rgba(0, 240, 255, 0.95)' : 'rgba(255, 0, 127, 0.95)';
    
    ctx.save();
    ctx.shadowColor = weight > 0 ? '#00f0ff' : '#ff007f';
    ctx.shadowBlur = 6;
    
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Menggambar Node Saraf (Neuron) dengan pendaran glow
   */
  drawNeuronNode(x, y, r, value) {
    const ctx = this.ctx;
    
    ctx.save();
    
    // Nilai aktivasi ternormalisasi untuk intensitas cahaya
    const absVal = Math.min(1.0, Math.max(0.0, Math.abs(value)));
    
    // Skema Warna: Positif Cyan, Negatif Pink, Netral Abu-abu
    let color = 'rgba(100, 116, 139, 0.2)'; // Netral
    let glowColor = '';
    
    if (value > 0.05) {
      color = `rgba(0, 240, 255, ${0.1 + absVal * 0.7})`;
      glowColor = '#00f0ff';
    } else if (value < -0.05) {
      color = `rgba(255, 0, 127, ${0.1 + absVal * 0.7})`;
      glowColor = '#ff007f';
    }

    // Set pendaran bayangan
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 4 + absVal * 8;
    }

    // Gambar lingkaran inti neuron
    ctx.fillStyle = color;
    ctx.strokeStyle = glowColor ? glowColor : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = glowColor ? 1.8 : 1.0;
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gambar bulatan putih kecil di pusat jika aktif tinggi
    if (absVal > 0.6) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
