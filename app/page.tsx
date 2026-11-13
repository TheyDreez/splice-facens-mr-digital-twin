'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Plus,
  RotateCcw,
  Trees,
  BarChart3,
  HelpCircle,
  X,
  Eye,
  Box,
  Sparkles,
  Upload,
  Navigation,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

declare global {
  interface Window {
    THREE: any;
    fflate: any;
  }
}

interface SensorNode {
  id: string;
  code: string;
  name: string;
  nodeType: 'PREDIO_CAMPUS' | 'POSTE_SPLICE';
  sector: string;
  x: number;
  z: number;
  /** posicao do poste/sonometro no viario (se ausente usa x,z) */
  sx?: number;
  sz?: number;
  h: number;
  baseDb: number;
  noiseDb: number;
  peakDb: number;
  noiseThreshold: number;
  vehiclesCount: number;
  pedestriansCount: number;
  speedAvgKmh: number;
  historyDb: number[];
  sensorsInstalled: string[];
  aiPatternNote: string;
}

/* =====================================================================
 *  GEOMETRIA DO CAMPUS - coordenadas derivadas da imagem oficial
 *  (px, py da maquete isometrica) -> mundo (x: leste, z: sul/frente)
 *  A maquete tem dois eixos: predios na diagonal "/" (angulo DIAG) e
 *  campo/LIGA/quadra na diagonal "\" (-DIAG). 28 deg no plano da imagem
 *  (eixo y para baixo) equivalem a +0.49 rad em rotation.y do Three.js.
 * ===================================================================== */
const DIAG = 0.49;

const imgScale = (py: number) => 2.67 + (0.87 * (py - 95)) / 755;
/** converte pixel da imagem anexada em coordenada de mundo [x, z] */
const P = (px: number, py: number): [number, number] => [
  Math.round(((px - 920) / imgScale(py)) * 10) / 10,
  Math.round(((py - 472) / 2.04) * 10) / 10
];

const ISLAND = { x0: -236, x1: 236, z0: -186, z1: 170 };

// Anel viario (sentido anti-horario na tela = mao direita brasileira)
const RING_PX: [number, number][] = [
  [975, 712], [1100, 705], [1215, 690], [1300, 645], [1340, 585], [1335, 520],
  [1300, 455], [1235, 385], [1150, 305], [1050, 245], [940, 200], [830, 175],
  [710, 165], [600, 180], [520, 230], [478, 310], [485, 385], [540, 450],
  [615, 515], [705, 575], [790, 640], [840, 695], [905, 714]
];
const RING_POINTS = RING_PX.map(([a, b]) => P(a, b));

// Ramal do quiosque (lago) ate a borda oeste
const SPUR_POINTS: [number, number][] = [
  [-150, -78], [-178, -84], [-205, -70], [-236, -48]
];

const INITIAL_NODES: SensorNode[] = [
  {
    id: 'portaria-sul',
    code: 'PORTARIA-P01',
    name: 'Pórtico Principal Facens & Estacionamento',
    nodeType: 'POSTE_SPLICE',
    sector: 'Acesso Sul • Portaria Azul, Guarita & Vagas',
    x: 44, z: 140, sx: 18, sz: 128,
    h: 18, baseDb: 63, noiseDb: 68, peakDb: 76, noiseThreshold: 70,
    vehiclesCount: 218, pedestriansCount: 94, speedAvgKmh: 28,
    historyDb: [59, 62, 66, 71, 76, 73, 69, 66, 65, 68],
    sensorsInstalled: ['Câmera LPR Splice (Entrada/Saída)', 'Radar Portaria', 'Sonômetro Viário'],
    aiPatternNote: 'Física IDM: ruído modulado pela aceleração e frenagem dos veículos nas faixas da portaria.'
  },
  {
    id: 'predio-facens-leste',
    code: 'EDIF-FACENS',
    name: 'Edifício Vertical Facens (Bloco Leste)',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Leste • Fachada Principal & Praça das Bandeiras',
    x: 188, z: 38, sx: 150, sz: 58,
    h: 62, baseDb: 53, noiseDb: 57, peakDb: 64, noiseThreshold: 66,
    vehiclesCount: 74, pedestriansCount: 132, speedAvgKmh: 24,
    historyDb: [50, 52, 54, 57, 61, 63, 59, 57, 55, 57],
    sensorsInstalled: ['Sonômetro Acústico (dB)', 'Câmera Óptica Pátio Leste'],
    aiPatternNote: 'Sombra acústica ativa: o edifício atenua o ruído vindo do anel viário oeste por difração.'
  },
  {
    id: 'smart-mall-liga',
    code: 'LIGA-FABLAB',
    name: 'LIGA / Smart Mall (Fachada Azul & Laranja)',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Nordeste • Inovação, FabLab & 5G',
    x: 153, z: -99, sx: 124, sz: -62,
    h: 26, baseDb: 55, noiseDb: 59, peakDb: 66, noiseThreshold: 66,
    vehiclesCount: 52, pedestriansCount: 98, speedAvgKmh: 21,
    historyDb: [52, 54, 56, 59, 63, 65, 61, 58, 57, 59],
    sensorsInstalled: ['Sonômetro Acústico (dB)', 'Câmera PTZ TPCAM-H20S', 'Antena 5G Local'],
    aiPatternNote: 'Telemetria 5G estável no entorno do LIGA e pátio do avião AeroDesign.'
  },
  {
    id: 'complexo-solar-norte',
    code: 'BIB-SOLAR',
    name: 'Biblioteca & Complexo Solar em "L"',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Norte • Usina Fotovoltaica, Claraboias & Lago',
    x: -66, z: -102, sx: -92, sz: -126,
    h: 30, baseDb: 61, noiseDb: 69, peakDb: 77, noiseThreshold: 65,
    vehiclesCount: 95, pedestriansCount: 164, speedAvgKmh: 26,
    historyDb: [55, 58, 62, 67, 73, 77, 72, 68, 67, 69],
    sensorsInstalled: ['Radar Viário Biblioteca', 'Sonômetro Acústico (dB)', 'Câmera LPR Norte'],
    aiPatternNote: 'Pico acústico detectado quando veículos contornam a curva norte entre a Biblioteca e o Lago.'
  },
  {
    id: 'blocos-centrais',
    code: 'BLOCOS-AULA',
    name: 'Blocos Acadêmicos Centrais (Salas D29 & 13)',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Coração do Campus • Passarelas, Relógio de Sol & Ambulatório',
    x: 10, z: -12, sx: -30, sz: 4,
    h: 24, baseDb: 64, noiseDb: 71, peakDb: 80, noiseThreshold: 68,
    vehiclesCount: 64, pedestriansCount: 215, speedAvgKmh: 19,
    historyDb: [58, 62, 66, 71, 76, 80, 75, 72, 70, 71],
    sensorsInstalled: ['Sonômetros de Passarela (dB)', 'Contador Óptico de Pedestres'],
    aiPatternNote: 'Alerta Nível 4: pico acústico recorrente nas passarelas centrais em troca de turno.'
  },
  {
    id: 'lab-engenharias-oeste',
    code: 'LAB-OESTE',
    name: 'Laboratórios de Engenharia (16 Exaustores) & Campo',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Oeste • Exaustores, Quadra, Campo & Drone',
    x: -158, z: 16, sx: -122, sz: 22,
    h: 24, baseDb: 57, noiseDb: 62, peakDb: 69, noiseThreshold: 68,
    vehiclesCount: 44, pedestriansCount: 112, speedAvgKmh: 23,
    historyDb: [54, 56, 58, 61, 65, 68, 63, 60, 59, 62],
    sensorsInstalled: ['Sonômetro Industrial Oeste', 'Telemetria Drone / Campo'],
    aiPatternNote: 'Ruído contínuo dos 16 exaustores de teto somado à atividade no complexo esportivo.'
  }
];

const CAM_HOME = { theta: 0.0, phi: 0.84, radius: 530, targetX: 0, targetZ: 4 };

/* Estado compartilhado React -> motor 3D */
interface SceneState {
  simSpeed: number;
  selectedNodeId: string;
  pruneTrees: boolean;
  highlightAcoustics: boolean;
  renderStyle: 'MAQUETE_PBR' | 'CCO_CYBER' | 'BIM_XRAY';
  showProcedural: boolean;
  showFbx: boolean;
  nodes: SensorNode[];
}

/* Utilitarios numericos */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};


/* =====================================================================
 *  MOTOR DA CENA (puro Three.js r128 - sem dependencia de React)
 * ===================================================================== */
interface Occluder { x: number; z: number; w: number; d: number; rot: number; h: number; }
interface CrossingDef {
  id: string; x: number; z: number; tx: number; tz: number; nx: number; nz: number; s: number;
}

function createCampus(THREE: any, renderer: any) {
  const scene = new THREE.Scene();
  const maxAniso: number = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  const col = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();

  const pickables: any[] = [];
  const occluders: Occluder[] = [];
  const groundMats: { mat: any; day: number; night: number }[] = [];

  /* ---------------- TEXTURAS PROCEDURAIS ---------------- */
  const makeCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const canvasTex = (
    w: number,
    h: number,
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
    o: { wrap?: boolean; color?: boolean } = {}
  ) => {
    const c = makeCanvas(w, h);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = maxAniso;
    if (o.color !== false) t.encoding = THREE.sRGBEncoding;
    if (o.wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const grain = (g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, seed = 7) => {
    const r = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const v = r() > 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${r() * a})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5);
    }
  };

  // Asfalto granulado + guias de concreto + linha dupla amarela (fita da estrada: u = largura, v = comprimento)
  const asphaltRibbonTex = canvasTex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#3b3031';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 26000, 0.1, 3);
    const r = mulberry32(11);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.07})`;
      g.fillRect(w * (0.12 + r() * 0.7), r() * h, 18 + r() * 40, 90 + r() * 220);
    }
    const cw = w * 0.05;
    [0, w - cw].forEach((x) => {
      g.fillStyle = '#a49e95';
      g.fillRect(x, 0, cw, h);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x === 0 ? cw - 4 : x, 0, 4, h);
    });
    g.fillStyle = '#d3a92a';
    g.fillRect(w * 0.5 - 14, 0, 6, h);
    g.fillRect(w * 0.5 + 8, 0, 6, h);
  }, { wrap: true });

  const asphaltLotTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3b3031';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 22000, 0.1, 5);
  }, { wrap: true });

  // Telhado frisado marrom e cinza
  const roofTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6a5a51';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = '#4c403a';
      g.fillRect(0, y, w, 13);
      g.fillStyle = '#8a7568';
      g.fillRect(0, y + 14, w, 3);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      g.fillRect(0, y + 17, w, 5);
    }
    grain(g, w, h, 9000, 0.08, 9);
  }, { wrap: true });
  const roofGreyTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#9ea1a4';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 40) {
      g.fillStyle = '#8a8d90';
      g.fillRect(0, y, w, 14);
      g.fillStyle = '#c2c4c6';
      g.fillRect(0, y + 15, w, 3);
    }
    grain(g, w, h, 7000, 0.07, 19);
  }, { wrap: true });

  // Fachadas com caixilhos (um modulo = 1 vao x 1 pavimento)
  const drawGlass = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    gr.addColorStop(0, '#2f86c4');
    gr.addColorStop(0.55, '#0f4f8c');
    gr.addColorStop(1, '#0a3466');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(190,230,255,0.28)';
    g.beginPath();
    g.moveTo(x + w * 0.12, y);
    g.lineTo(x + w * 0.42, y);
    g.lineTo(x + w * 0.2, y + h);
    g.lineTo(x - w * 0.1, y + h);
    g.closePath();
    g.fill();
  };
  const facadeTile = (style: string) =>
    canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#f1f2ee';
      g.fillRect(0, 0, w, h);
      grain(g, w, h, 5000, 0.04, 21);
      if (style === 'ribbon' || style === 'brise') {
        const y0 = h * 0.3, hh = h * 0.4;
        g.fillStyle = '#d7dad6';
        g.fillRect(0, y0 - 14, w, 14);
        drawGlass(g, 0, y0, w, hh);
        g.fillStyle = '#e9ebe8';
        [0, w / 2].forEach((x) => g.fillRect(x - 5, y0, 10, hh));
        g.fillRect(0, y0 + hh * 0.5 - 3, w, 6);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(0, y0 + hh, w, 16);
        if (style === 'brise') {
          g.fillStyle = '#ffffff';
          for (let i = 0; i < 5; i++) g.fillRect(0, y0 - 10 + i * (hh / 4.2), w, 8);
        }
      } else if (style === 'punched') {
        [0.12, 0.56].forEach((fx) => {
          drawGlass(g, w * fx, h * 0.28, w * 0.32, h * 0.44);
          g.strokeStyle = '#eef0ee';
          g.lineWidth = 10;
          g.strokeRect(w * fx, h * 0.28, w * 0.32, h * 0.44);
          g.fillStyle = '#e9ebe8';
          g.fillRect(w * fx + w * 0.16 - 4, h * 0.28, 8, h * 0.44);
        });
      } else if (style === 'glass') {
        const gr = g.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#5db1e6');
        gr.addColorStop(0.5, '#1f6fb0');
        gr.addColorStop(1, '#0c3f78');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(230,248,255,0.3)';
        g.beginPath();
        g.moveTo(w * 0.1, 0); g.lineTo(w * 0.35, 0); g.lineTo(w * 0.05, h); g.lineTo(-w * 0.2, h);
        g.closePath();
        g.fill();
        g.strokeStyle = '#d9e4ec';
        g.lineWidth = 9;
        g.strokeRect(0, 0, w, h);
        g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      } else {
        g.strokeStyle = 'rgba(0,0,0,0.08)';
        g.lineWidth = 3;
        g.strokeRect(2, 2, w - 4, h - 4);
      }
    }, { wrap: true });
  const facadeBase: Record<string, any> = {};
  const facadeCache: Record<string, any> = {};
  const facadeTexture = (style: string, rx: number, ry: number) => {
    const k = `${style}|${rx}|${ry}`;
    if (facadeCache[k]) return facadeCache[k];
    if (!facadeBase[style]) facadeBase[style] = facadeTile(style);
    const t = facadeBase[style].clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.encoding = THREE.sRGBEncoding;
    t.repeat.set(rx, ry);
    facadeCache[k] = t;
    return t;
  };

  // Painel fotovoltaico com celulas prateadas
  const solarTex = canvasTex(1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#1c5fa6');
    gr.addColorStop(1, '#0d3a78');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const cols = 6, rows = 6;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i * w) / cols + 8, y = (j * h) / rows + 8, cw = w / cols - 16, ch = h / rows - 16;
        g.fillStyle = (i + j) % 2 ? '#14498a' : '#175395';
        g.fillRect(x, y, cw, ch);
        g.strokeStyle = 'rgba(200,215,235,0.75)';
        g.lineWidth = 2;
        for (let b = 1; b <= 3; b++) {
          g.beginPath(); g.moveTo(x + (cw * b) / 4, y); g.lineTo(x + (cw * b) / 4, y + ch); g.stroke();
        }
        g.strokeRect(x, y, cw, ch);
      }
    }
    g.strokeStyle = '#c8d2de';
    g.lineWidth = 14;
    g.strokeRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.7, 0); g.lineTo(0, h * 0.8); g.fill();
  });

  // Campo de futebol com faixas de corte alternadas e marcacoes completas
  const pitchTex = canvasTex(2048, 1290, (g, w, h) => {
    const stripes = 14;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? '#4a5d2b' : '#42532a';
      g.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
    }
    grain(g, w, h, 30000, 0.07, 31);
    const m = w / 105;
    const cx = w / 2, cy = h / 2;
    g.strokeStyle = '#d8dcc0';
    g.fillStyle = '#d8dcc0';
    g.lineWidth = 9;
    const pad = 30;
    g.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
    g.beginPath(); g.moveTo(cx, pad); g.lineTo(cx, h - pad); g.stroke();
    g.beginPath(); g.arc(cx, cy, 9.15 * m, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
    [0, 1].forEach((side) => {
      const dir = side ? -1 : 1;
      const x0 = side ? w - pad : pad;
      g.strokeRect(side ? x0 - 16.5 * m : x0, cy - 20.15 * m, 16.5 * m, 40.3 * m);
      g.strokeRect(side ? x0 - 5.5 * m : x0, cy - 9.16 * m, 5.5 * m, 18.32 * m);
      g.beginPath(); g.arc(x0 + dir * 11 * m, cy, 8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x0 + dir * 11 * m, cy, 9.15 * m, side ? -0.93 + Math.PI : -0.93, side ? 0.93 + Math.PI : 0.93); g.stroke();
      [pad, h - pad].forEach((yy) => {
        g.beginPath(); g.arc(x0, yy, 1.2 * m, 0, Math.PI * 2); g.stroke();
      });
    });
  });

  // Fachada frontal do Edificio Facens (proporcao 52:62 igual a face - logo sem distorcao)
  const facensFrontTex = canvasTex(1664, 1984, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#e9ecee');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    drawGlass(g, 0, h * 0.06, w * 0.085, h * 0.58);
    drawGlass(g, w * 0.1, h * 0.06, w * 0.04, h * 0.58);
    g.fillStyle = '#e9ebe8';
    for (let i = 1; i < 6; i++) g.fillRect(0, h * 0.06 + (h * 0.58 * i) / 6 - 3, w * 0.14, 6);
    g.fillStyle = '#51565c';
    g.fillRect(w * 0.02, h * 0.7, w * 0.96, h * 0.055);
    g.fillRect(w * 0.02, h * 0.8, w * 0.96, h * 0.055);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, h * 0.66, w, 8);
    const lx = w * 0.27, ly = h * 0.5, lr = w * 0.085;
    const lg = g.createLinearGradient(lx - lr, ly - lr, lx + lr, ly + lr);
    lg.addColorStop(0, '#1d9fc9');
    lg.addColorStop(1, '#0a5a8f');
    g.lineWidth = lr * 0.26;
    g.strokeStyle = lg;
    g.beginPath(); g.arc(lx, ly, lr, 0.3, Math.PI * 2 - 0.15); g.stroke();
    g.fillStyle = lg;
    g.font = `italic 900 ${lr * 1.9}px "Segoe UI", Arial, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('F', lx - lr * 0.48, ly + lr * 0.06);
    g.font = `italic 600 ${h * 0.085}px "Segoe UI", Arial, sans-serif`;
    g.fillStyle = '#0c5f86';
    g.fillText('Facens', w * 0.38, h * 0.505);
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    g.lineWidth = 3;
    g.strokeRect(2, 2, w - 4, h - 4);
  });

  // Fachada listrada LIGA (azul / laranja)
  const ligaTex = canvasTex(1024, 512, (g, w, h) => {
    const cols = ['#e97a1f', '#1b4f8f', '#e97a1f', '#163f78', '#e97a1f', '#1b4f8f', '#e97a1f', '#163f78'];
    cols.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h);
    });
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < cols.length; i++) g.fillRect((i * w) / cols.length + 4, 0, 6, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, h - 26, w, 26);
  });

  const brickTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6d2a20';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(5);
    for (let y = 0; y < h; y += 32) {
      for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) {
        const t = 160 + r() * 40;
        g.fillStyle = `rgb(${t},${50 + r() * 22},${38 + r() * 14})`;
        g.fillRect(x + 3, y + 3, 58, 26);
      }
    }
  }, { wrap: true });

  const stripeCanopyTex = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i % 2 ? '#f4f5f3' : '#9aa6ad';
      g.fillRect((i * w) / 12, 0, w / 12 + 1, h);
    }
  }, { wrap: true });

  const crosswalkTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#b8352c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7f7f4';
    for (let i = 0; i < 12; i++) g.fillRect((i * w) / 12 + 8, 0, w / 12 - 16, h);
  });

  const zebraTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a2120';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0861c';
    for (let i = -h; i < w + h; i += 64) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 + h, h); g.lineTo(i + h, h);
      g.closePath();
      g.fill();
    }
  }, { wrap: true });

  const arrowsTex = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#f5f5f2';
    g.fillStyle = '#f5f5f2';
    g.lineWidth = 26;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(180, 70);
    g.quadraticCurveTo(180, 300, 90, 360);
    g.stroke();
    g.beginPath();
    g.moveTo(40, 330); g.lineTo(130, 330); g.lineTo(70, 420); g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(380, 440);
    g.quadraticCurveTo(375, 280, 392, 150);
    g.stroke();
    g.beginPath();
    g.moveTo(340, 170); g.lineTo(440, 170); g.lineTo(392, 70); g.closePath();
    g.fill();
  });

  const parkingTex = (w: number, h: number) =>
    canvasTex(1024, 512, (g, cw, ch) => {
      g.fillStyle = '#3b3031';
      g.fillRect(0, 0, cw, ch);
      grain(g, cw, ch, 14000, 0.1, 17);
      g.strokeStyle = '#e8a317';
      g.lineWidth = 7;
      const n = Math.max(4, Math.round(w / 9));
      [ch * 0.16, ch * 0.84].forEach((yy, row) => {
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const x = (i * cw) / n;
          g.moveTo(x, yy);
          g.lineTo(x + (cw / n) * 0.45, yy + (row ? -1 : 1) * ch * 0.28);
        }
        g.stroke();
      });
    });

  const crossTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f6f6f3';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d32f2f';
    g.fillRect(w * 0.38, h * 0.14, w * 0.24, h * 0.72);
    g.fillRect(w * 0.14, h * 0.38, w * 0.72, h * 0.24);
  });

  const grassTex = canvasTex(2048, 2048, (g, w, h) => {
    g.fillStyle = '#959c44';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(77);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '120,130,48' : '168,176,76'},${0.1 + r() * 0.1})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 30 + r() * 120, 20 + r() * 70, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, w, h, 40000, 0.07, 41);
  }, { wrap: true });
  grassTex.repeat.set(1 / 150, 1 / 150);

  const gardenTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#76b83f';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(88);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '96,160,48' : '140,208,84'},${0.12 + r() * 0.12})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 20 + r() * 80, 14 + r() * 50, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, w, h, 20000, 0.06, 43);
  }, { wrap: true });

  // Corte geologico em camadas
  const soilSideTex = canvasTex(2048, 512, (g, w, h) => {
    const bands = [
      ['#7a3a1e', 0.0], ['#a94f24', 0.12], ['#c06030', 0.28], ['#b04a2a', 0.5], ['#963a22', 0.72], ['#7b2c1a', 0.88]
    ] as [string, number][];
    g.fillStyle = '#7a3a1e';
    g.fillRect(0, 0, w, h);
    bands.forEach(([c, t], i) => {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) {
        const y = h - h * (t + (i ? 0.025 * Math.sin(x * 0.012 + i * 2) : 0));
        g.lineTo(x, y);
      }
      g.lineTo(w, 0); g.lineTo(0, 0);
      g.closePath();
      g.fill();
    });
    grain(g, w, h, 8000, 0.08, 51);
  }, { wrap: true });
  soilSideTex.repeat.set(1 / 130, 1 / 19);

  const heatTex = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 2, 128, 128, 126);
    gr.addColorStop(0, 'rgba(255,255,255,0.78)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.4)');
    gr.addColorStop(0.8, 'rgba(255,255,255,0.14)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }, { color: false });
  const circleShadowTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }, { color: false });
  const rectShadowTex = canvasTex(256, 256, (g) => {
    g.fillStyle = 'rgba(0,0,0,0)';
    g.fillRect(0, 0, 256, 256);
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 38;
    g.fillStyle = 'rgba(0,0,0,0.8)';
    g.fillRect(60, 60, 136, 136);
  }, { color: false });

  /* ---------------- MATERIAIS PBR ---------------- */
  const std = (hex: number, o: any = {}) =>
    new THREE.MeshStandardMaterial({ color: col(hex), roughness: 0.65, metalness: 0.0, ...o });
  const basic = (hex: number, o: any = {}) => new THREE.MeshBasicMaterial({ color: col(hex), ...o });
  const level = (m: any, n: number) => {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -n;
    m.polygonOffsetUnits = -n;
    return m;
  };

  const mWhite = std(0xf1f2ee, { roughness: 0.55 });
  const mWhiteSoft = std(0xe4e6e2, { roughness: 0.6 });
  const mGlass = std(0x1b6aa8, { roughness: 0.08, metalness: 0.7 });
  mGlass.userData.glass = true;
  const mRoofBrown = std(0xffffff, { map: roofTex, bumpMap: roofTex, bumpScale: 1.4, roughness: 0.78 });
  const mRoofGrey = std(0xffffff, { map: roofGreyTex, bumpMap: roofGreyTex, bumpScale: 1.0, roughness: 0.7 });
  const mDarkGrey = std(0x575b60, { roughness: 0.7 });
  const mSolar = std(0xffffff, { map: solarTex, roughness: 0.22, metalness: 0.55 });
  mSolar.userData.glass = true;
  const mRed = std(0xc2382a, { roughness: 0.5 });
  const mBrick = std(0xffffff, { map: brickTex, roughness: 0.85 });
  const mCyan = std(0x00acc1, { roughness: 0.3, metalness: 0.25 });
  const mBlueWall = std(0x2e6fb5, { roughness: 0.5 });
  const mTrunk = std(0x4a2e19, { roughness: 0.9 });
  const mTeal = std(0x20a7a8, { roughness: 0.5 });
  const mStone = std(0xb7b3a8, { roughness: 0.8 });
  const mMetal = std(0xb9bec4, { roughness: 0.35, metalness: 0.7 });

  /* ---------------- HELPERS DE GEOMETRIA ---------------- */
  const grp = (parent: any, x: number, z: number, rot = 0, y = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    parent.add(g);
    return g;
  };
  const box = (
    parent: any, w: number, h: number, d: number, mat: any, x: number, y: number, z: number,
    o: { cast?: boolean; recv?: boolean; nodeId?: string } = {}
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = o.cast !== false;
    m.receiveShadow = o.recv !== false;
    if (o.nodeId) {
      m.userData.nodeId = o.nodeId;
      pickables.push(m);
    }
    parent.add(m);
    return m;
  };
  const cyl = (
    parent: any, rt: number, rb: number, h: number, mat: any, x: number, y: number, z: number, seg = 14
  ) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const wallBox = (
    parent: any, w: number, h: number, d: number, x: number, y: number, z: number,
    o: {
      floors?: number; styleFront?: string; styleSide?: string; styleBack?: string; top?: any;
      bay?: number; nodeId?: string; frontMat?: any; leftMat?: any;
    } = {}
  ) => {
    const fl = o.floors ?? Math.max(1, Math.round(h / 8));
    const bay = o.bay ?? 9;
    const front = o.frontMat ?? new THREE.MeshStandardMaterial({
      map: facadeTexture(o.styleFront ?? 'ribbon', Math.max(1, Math.round(w / bay)), fl), roughness: 0.5, color: col(0xffffff)
    });
    const back = new THREE.MeshStandardMaterial({
      map: facadeTexture(o.styleBack ?? o.styleFront ?? 'ribbon', Math.max(1, Math.round(w / bay)), fl), roughness: 0.5, color: col(0xffffff)
    });
    const sideR = new THREE.MeshStandardMaterial({
      map: facadeTexture(o.styleSide ?? 'punched', Math.max(1, Math.round(d / bay)), fl), roughness: 0.5, color: col(0xffffff)
    });
    const sideL = o.leftMat ?? sideR;
    const mats = [sideR, sideL, o.top ?? mRoofGrey, mWhiteSoft, front, back];
    return box(parent, w, h, d, mats, x, y, z, { nodeId: o.nodeId });
  };
  const registerOcc = (x: number, z: number, w: number, d: number, rot: number, h: number) => {
    occluders.push({ x, z, w, d, rot, h });
  };
  const contactShadow = (parent: any, w: number, d: number, x = 0, z = 0, op = 0.5) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 18, d + 18),
      level(new THREE.MeshBasicMaterial({ map: rectShadowTex, transparent: true, opacity: op, depthWrite: false }), 2)
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.1, z);
    m.renderOrder = 2;
    parent.add(m);
  };

  const contactShadowAt = (parent: any, x: number, z: number, r: number, op = 0.5) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2.6, r * 2.6),
      level(new THREE.MeshBasicMaterial({ map: circleShadowTex, transparent: true, opacity: op, depthWrite: false }), 2)
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.1, z);
    m.renderOrder = 2;
    parent.add(m);
  };

  const gableGeo = (len: number, wid: number, rise: number, over = 1.2, uvRep = 6) => {
    const hl = len / 2 + over, hw = wid / 2 + over;
    const slope = Math.hypot(hw, rise);
    const pos: number[] = [], uv: number[] = [];
    const tri = (a: number[], b: number[], c: number[], ua: number[], ub: number[], uc: number[]) => {
      pos.push(...a, ...b, ...c);
      uv.push(...ua, ...ub, ...uc);
    };
    const ur = (len / 14) | 0 || 1;
    const sr = Math.max(1, Math.round((slope / 14) * uvRep));
    const A = [-hl, 0, -hw], B = [hl, 0, -hw], C = [hl, rise, 0], D = [-hl, rise, 0];
    const E = [-hl, 0, hw], F = [hl, 0, hw];
    tri(A, D, B, [0, 0], [0, sr], [ur, 0]);
    tri(B, D, C, [ur, 0], [0, sr], [ur, sr]);
    tri(D, E, C, [0, sr], [0, 0], [ur, sr]);
    tri(C, E, F, [ur, sr], [0, 0], [ur, 0]);
    const nSlope = pos.length / 3;
    tri(A, E, D, [0, 0], [1, 0], [0.5, 1]);
    tri(B, C, F, [0, 0], [0.5, 1], [1, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.addGroup(0, nSlope, 0);
    g.addGroup(nSlope, pos.length / 3 - nSlope, 1);
    return g;
  };
  const gableRoof = (
    parent: any, len: number, wid: number, rise: number, x: number, y: number, z: number,
    roofMat: any, gableMat: any = mWhite, over = 1.2
  ) => {
    const roofM = roofMat.clone();
    roofM.side = THREE.DoubleSide;
    const m = new THREE.Mesh(gableGeo(len, wid, rise, over), [roofM, gableMat]);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const polyDecal = (pts: [number, number][], mat: any, y: number, uvFn?: (x: number, z: number) => [number, number]) => {
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, u = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const [a, b] = uvFn ? uvFn(p.getX(i), p.getZ(i)) : [p.getX(i) / 40, p.getZ(i) / 40];
      u.setXY(i, a, b);
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.receiveShadow = true;
    return m;
  };
  const flatPlane = (parent: any, w: number, d: number, mat: any, x: number, y: number, z: number, rot = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /* ---------------- ILUMINACAO, AMBIENTE HDR, SOMBRAS ---------------- */
  scene.background = col(0x060b14);
  scene.fog = new THREE.FogExp2(col(0x060b14), 0.00028);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const skyTex = canvasTex(32, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2f7fd0');
      gr.addColorStop(0.45, '#9fd2f5');
      gr.addColorStop(0.5, '#e8f1f5');
      gr.addColorStop(0.55, '#8f993e');
      gr.addColorStop(1, '#4b5a25');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }, { color: false });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sun.position.set(50, 62, 55);
    envScene.add(sun);
    scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  } catch (e) {
    /* PMREM indisponivel: segue so com luzes diretas */
  }

  const hemi = new THREE.HemisphereLight(col(0xdff1ff), col(0x4a5a26), 0.75);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(col(0xfff6e0), 1.55);
  sunLight.position.set(190, 300, 210);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096);
  sunLight.shadow.camera.near = 40;
  sunLight.shadow.camera.far = 900;
  const sb = 300;
  Object.assign(sunLight.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb });
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.35;
  sunLight.shadow.radius = 2.5;
  scene.add(sunLight);
  const sunDir = sunLight.position.clone().normalize();

  const underGrid = new THREE.GridHelper(780, 56, col(0x00a859), col(0x122238));
  underGrid.position.y = -21;
  scene.add(underGrid);

  /* ---------------- ILHA: CORTE GEOLOGICO ---------------- */
  const campus = new THREE.Group();
  scene.add(campus);
  const buildings = new THREE.Group();
  campus.add(buildings);
  const fbxGroup = new THREE.Group();
  campus.add(fbxGroup);
  const props = new THREE.Group();
  campus.add(props);

  const islandShape = (inset: number) => {
    const { x0, x1, z0, z1 } = ISLAND;
    const a = x0 + inset, b = x1 - inset, c = z0 + inset, d = z1 - inset;
    const rb = 8, rf = 38;
    const s = new THREE.Shape();
    s.moveTo(a + rb, c);
    s.lineTo(b - rb, c);
    s.quadraticCurveTo(b, c, b, c + rb);
    s.lineTo(b, d - rf);
    s.quadraticCurveTo(b, d, b - rf, d);
    s.lineTo(a + rf, d);
    s.quadraticCurveTo(a, d, a, d - rf);
    s.lineTo(a, c + rb);
    s.quadraticCurveTo(a, c, a + rb, c);
    return s;
  };
  const extrudeIsland = (inset: number, depth: number, capMat: any, sideMat: any, y: number) => {
    const geo = new THREE.ExtrudeGeometry(islandShape(inset), { depth, bevelEnabled: false, curveSegments: 14 });
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, [capMat, sideMat]);
    m.position.y = y;
    m.receiveShadow = true;
    m.castShadow = true;
    campus.add(m);
    return m;
  };
  const soilBottomMat = std(0x5d2316, { roughness: 0.95 });
  const soilSideMat = new THREE.MeshStandardMaterial({ map: soilSideTex, roughness: 0.92, color: col(0xffffff) });
  extrudeIsland(3, 17, soilBottomMat, soilSideMat, -3);
  const grassMat = std(0xffffff, { map: grassTex, roughness: 0.88 });
  const grassEdgeMat = std(0x7f8638, { roughness: 0.9 });
  groundMats.push({ mat: grassMat, day: 0xffffff, night: 0x2c3a52 });
  const grassMesh = extrudeIsland(0, 3, grassMat, grassEdgeMat, 0);
  const groundPick = grassMesh;

  /* ---------------- ANEL VIARIO (RIBBON CONTINUO) ---------------- */
  const ringCurve = new THREE.CatmullRomCurve3(
    RING_POINTS.map(([x, z]) => new THREE.Vector3(x, 0.2, z)), true, 'centripetal', 0.5
  );
  ringCurve.arcLengthDivisions = 1200;
  const RING_LEN: number = ringCurve.getLength();
  const ROAD_W = 15;

  const ribbonGeo = (curve: any, width: number, segs: number, tileLen: number, y: number) => {
    const L = curve.getLength();
    const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const sx = t.z, sz = -t.x;
      const l = Math.hypot(sx, sz) || 1;
      pos.push(p.x + (sx / l) * width / 2, y, p.z + (sz / l) * width / 2);
      pos.push(p.x - (sx / l) * width / 2, y, p.z - (sz / l) * width / 2);
      nor.push(0, 1, 0, 0, 1, 0);
      uv.push(0, (u * L) / tileLen, 1, (u * L) / tileLen);
      if (i < segs) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  };

  {
    const pts: [number, number][] = [];
    for (let i = 0; i < 160; i++) {
      const p = ringCurve.getPointAt(i / 160);
      pts.push([p.x, p.z]);
    }
    const gm = level(new THREE.MeshStandardMaterial({ map: gardenTex, roughness: 0.82, color: col(0xffffff) }), 1);
    gardenTex.repeat.set(1 / 40, 1 / 40);
    groundMats.push({ mat: gm, day: 0xffffff, night: 0x28506a });
    const m = polyDecal(pts, gm, 0.08, (x, z) => [x / 40, z / 40]);
    campus.add(m);
  }

  const roadMat = level(new THREE.MeshStandardMaterial({ map: asphaltRibbonTex, roughness: 0.88, metalness: 0.02, color: col(0xffffff) }), 3);
  asphaltRibbonTex.anisotropy = maxAniso;
  const ringTile = RING_LEN / Math.max(1, Math.round(RING_LEN / 46));
  const ringMesh = new THREE.Mesh(ribbonGeo(ringCurve, ROAD_W, 420, ringTile, 0.2), roadMat);
  ringMesh.receiveShadow = true;
  campus.add(ringMesh);

  const spurCurve = new THREE.CatmullRomCurve3(SPUR_POINTS.map(([x, z]) => new THREE.Vector3(x, 0.2, z)), false, 'centripetal', 0.5);
  const spurLen = spurCurve.getLength();
  const spurMat = roadMat.clone();
  level(spurMat, 3);
  const spur = new THREE.Mesh(ribbonGeo(spurCurve, 10, 60, spurLen / Math.max(1, Math.round(spurLen / 46)), 0.2), spurMat);
  spur.receiveShadow = true;
  campus.add(spur);

  // Estacionamentos
  const lotMats: any[] = [];
  const lot = (pts: [number, number][], w: number, h: number) => {
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), z0 = Math.min(...zs);
    const mat = level(new THREE.MeshStandardMaterial({ map: parkingTex(w, h), roughness: 0.88, color: col(0xffffff) }), 3);
    lotMats.push(mat);
    const m = polyDecal(pts, mat, 0.22, (x, z) => [(x - x0) / w, (z - z0) / h]);
    campus.add(m);
  };
  const lotSouth = [P(565, 735), P(945, 735), P(955, 800), P(555, 803)];
  lot(lotSouth, 108, 32);
  lot([P(1050, 200), P(1175, 200), P(1160, 268), P(1040, 262)], 52, 34); // NE (eletroposto)
  lot([P(1218, 300), P(1360, 308), P(1362, 352), P(1260, 340)], 44, 22); // LIGA
  lot([P(1272, 700), P(1420, 690), P(1445, 775), P(1285, 770)], 46, 32); // vaga leste
  lot([P(1110, 608), P(1195, 580), P(1210, 616), P(1126, 646)], 34, 18); // vaga junto as bandeiras

  // Rampa de acesso sul (entrada/saida sob o portico) + setas + ilha zebrada laranja/preta
  {
    const ramp = [[16, 112], [72, 112], [80, 170], [8, 170]] as [number, number][];
    const rm = level(new THREE.MeshStandardMaterial({ map: asphaltLotTex, roughness: 0.88, color: col(0xffffff) }), 3);
    asphaltLotTex.repeat.set(1, 1);
    campus.add(polyDecal(ramp, rm, 0.22, (x, z) => [x / 30, z / 30]));
    const zm = level(new THREE.MeshStandardMaterial({ map: zebraTex, roughness: 0.7, color: col(0xffffff) }), 5);
    campus.add(polyDecal([[44, 128], [52, 142], [51, 169], [37, 169], [36, 142]], zm, 0.26, (x, z) => [x / 8, z / 8]));
    const am = level(new THREE.MeshBasicMaterial({ map: arrowsTex, transparent: true, depthWrite: false }), 6);
    flatPlane(campus, 46, 46, am, 44, 0.3, 150, 0);
  }

  /* ---------------- PASSARELAS ROSA/TERRACOTA ---------------- */
  const walkMat = level(std(0xb9747a, { roughness: 0.8 }), 2);
  groundMats.push({ mat: walkMat, day: 0xb9747a, night: 0x5a3c44 });
  const ringNearest = (wx: number, wz: number) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < 600; i++) {
      const p = ringCurve.getPointAt(i / 600);
      const d = (p.x - wx) ** 2 + (p.z - wz) ** 2;
      if (d < bd) { bd = d; best = i / 600; }
    }
    return best;
  };
  const crossingDefs: CrossingDef[] = [];
  const crossingGuess: [string, [number, number]][] = [
    ['c1', P(1145, 372)], ['c2', P(1350, 527)], ['c3', P(745, 547)], ['c4', P(1045, 708)]
  ];
  crossingGuess.forEach(([id, [gx, gz]]) => {
    const u = ringNearest(gx, gz);
    const p = ringCurve.getPointAt(u), t = ringCurve.getTangentAt(u);
    crossingDefs.push({ id, x: p.x, z: p.z, tx: t.x, tz: t.z, nx: t.z, nz: -t.x, s: u * RING_LEN });
  });
  const cw = (id: string) => crossingDefs.find((c) => c.id === id)!;

  type WP = [number, number] | string;
  const expandPath = (wps: WP[]): [number, number][] => {
    const out: [number, number][] = [];
    wps.forEach((w) => {
      if (typeof w === 'string') {
        const c = cw(w);
        const prev = out[out.length - 1];
        const sign = prev && (prev[0] - c.x) * c.nx + (prev[1] - c.z) * c.nz > 0 ? 1 : -1;
        out.push([c.x + c.nx * 11 * sign, c.z + c.nz * 11 * sign]);
        out.push([c.x - c.nx * 11 * sign, c.z - c.nz * 11 * sign]);
      } else out.push(w);
    });
    return out;
  };
  const walkPaths: [number, number][][] = [
    expandPath([[-76, -2], [-42, -34], [-6, -50], [36, -46], [76, -50], 'c1', [138, -62]]),
    expandPath([[-36, -70], [-48, -48], [-62, -26], [-78, -6]]),
    expandPath([[-80, 6], [-46, 18], [-8, 28], [36, 28], [76, 22], [100, 28], 'c2', [160, 34]]),
    expandPath([[-36, -70], [-52, -92], [-60, -100]]),
    expandPath([[12, 74], [24, 96], 'c4', [42, 132]]),
    expandPath([[-112, 62], 'c3', [-48, 34], [-44, 18]]),
    expandPath([[96, 28], [90, 48], [98, 66]])
  ];
  walkPaths.forEach((pts) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.14, z)), false, 'catmullrom', 0.1);
    const m = new THREE.Mesh(ribbonGeo(c, 4.6, Math.max(8, pts.length * 10), 12, 0.14), walkMat);
    m.receiveShadow = true;
    campus.add(m);
  });

  // 4 faixas de pedestres vermelhas e brancas
  const crossMat = level(new THREE.MeshStandardMaterial({ map: crosswalkTex, roughness: 0.7, color: col(0xffffff) }), 5);
  crossingDefs.forEach((c) => {
    const g = grp(campus, c.x, c.z, Math.atan2(c.tx, c.tz), 0.27);
    flatPlane(g, ROAD_W - 1.2, 6, crossMat, 0, 0, 0, 0);
  });


  /* =====================================================================
   *  EDIFICIOS - geometria composta fiel a maquete
   * ===================================================================== */
  const solarCache: Record<string, any> = {};
  const solarMat = (rx: number, ry: number) => {
    const k = `${rx}|${ry}`;
    if (solarCache[k]) return solarCache[k];
    const t = solarTex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.encoding = THREE.sRGBEncoding;
    t.repeat.set(rx, ry);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.2, metalness: 0.6, color: col(0xffffff) });
    m.userData.glass = true;
    solarCache[k] = m;
    return m;
  };
  /** registra um oclusor acustico usando o referencial do grupo */
  const occOf = (g: any, lx: number, lz: number, w: number, d: number, h: number) => {
    const r = g.rotation.y, c = Math.cos(r), s = Math.sin(r);
    registerOcc(g.position.x + lx * c + lz * s, g.position.z - lx * s + lz * c, w, d, r, h);
  };
  const parapet = (g: any, w: number, d: number, y: number, t = 1.2, h = 1.8, mat: any = mWhite) => {
    box(g, w, h, t, mat, 0, y, d / 2 - t / 2);
    box(g, w, h, t, mat, 0, y, -d / 2 + t / 2);
    box(g, t, h, d - 2 * t, mat, w / 2 - t / 2, y, 0);
    box(g, t, h, d - 2 * t, mat, -w / 2 + t / 2, y, 0);
  };
  const rect = (parent: any, w: number, d: number, mat: any, x: number, z: number, y = 0.14) =>
    flatPlane(parent, w, d, mat, x, y, z, 0);

  // 1) PORTARIA PRINCIPAL - portico azul-turquesa, pilares e guaritas de tijolo aparente
  {
    const g = grp(buildings, 44, 142);
    [-31, 31].forEach((x) => [-8, 8].forEach((z) => box(g, 3.2, 15, 3.2, mWhiteSoft, x, 0, z)));
    [-13, 13].forEach((x) => {
      box(g, 9, 9, 11, mBrick, x, 0, 0, { nodeId: 'portaria-sul' });
      box(g, 10.4, 0.9, 12.4, mWhiteSoft, x, 9, 0);
      box(g, 5, 3.4, 0.3, std(0x0f4a7a, { roughness: 0.1, metalness: 0.6 }), x, 3.6, 5.6);
      occOf(g, x, 0, 9, 11, 9);
    });
    box(g, 66, 0.9, 22, mRoofGrey, 0, 14.2, 0);
    box(g, 70, 3, 24, mCyan, 0, 15, 0, { nodeId: 'portaria-sul' });
    box(g, 70.6, 1.0, 24.6, std(0x26c6da, { roughness: 0.25 }), 0, 17.6, 0);
    [-24, 24].forEach((x) => {
      box(g, 0.8, 2.6, 0.8, mWhite, x, 0, 8);
      box(g, 8, 0.5, 0.5, mRed, x + (x < 0 ? 4 : -4), 3.1, 8);
    });
    flatPlane(g, 18, 12, level(std(0x3b3031, { roughness: 0.9 }), 3), 52, 0.23, 0, 0);
  }

  // 2) EDIFICIO VERTICAL FACENS - fachada cortina de vidro espelhado + logo 2K
  {
    const g = grp(buildings, 188, 38, 0.28);
    const W = 52, H = 62, D = 42;
    contactShadow(g, W, D, 0, 0, 0.6);
    const front = new THREE.MeshStandardMaterial({ map: facensFrontTex, roughness: 0.38, color: col(0xffffff) });
    const curtain = new THREE.MeshStandardMaterial({
      map: facadeTexture('glass', 4, 10), roughness: 0.06, metalness: 0.85, color: col(0xffffff)
    });
    curtain.userData.glass = true;
    const side = new THREE.MeshStandardMaterial({ map: facadeTexture('plain', 4, 9), roughness: 0.5, color: col(0xffffff) });
    const tw = box(g, W, H, D, [side, curtain, mRoofGrey, mWhiteSoft, front, side], 0, 0, 0, { nodeId: 'predio-facens-leste' });
    tw.userData.keepGlass = true;
    parapet(g, W, D, H, 1.6, 2.4);
    box(g, 14, 3, 10, mDarkGrey, -8, H, -4);
    box(g, 8, 2.2, 8, mMetal, 12, H, 6);
    cyl(g, 0.4, 0.4, 7, mMetal, 18, H, -10, 8);
    box(g, 22, 1.0, 7, mWhite, -4, 4.6, D / 2 + 3);
    [-12, 4].forEach((x) => box(g, 1, 4.6, 1, mWhite, x, 0, D / 2 + 5.5));
    occOf(g, 0, 0, W, D, H);
  }

  // 3) BLOCO SUDESTE - telhado de duas aguas marrom, frontao azul, 2 caixas d'agua e banco
  {
    const g = grp(buildings, 200, 98, -DIAG);
    contactShadow(g, 36, 26);
    wallBox(g, 36, 14, 26, 0, 0, 0, { floors: 2, styleFront: 'punched', styleSide: 'punched', styleBack: 'plain', top: mRoofGrey, nodeId: 'predio-facens-leste' });
    gableRoof(g, 36, 26, 8.5, 0, 14, 0, mRoofBrown, mBlueWall, 1.6);
    box(g, 0.4, 4, 5, mGlass, 19.1, 14.5, 0);
    box(g, 8, 0.9, 6, mWhite, 20, 0, 4);
    occOf(g, 0, 0, 36, 26, 14);
    const tanks = new THREE.Group();
    campus.add(tanks);
    [[158, 96, 13], [160, 111, 8.5]].forEach(([x, z, h]) => {
      cyl(tanks, 3.6, 3.6, h, mWhite, x, 0, z, 20);
      cyl(tanks, 3.9, 3.9, 0.7, mWhiteSoft, x, h, z, 20);
      cyl(tanks, 3.6, 3.6, 0.4, mWhiteSoft, x, h * 0.45, z, 20);
      contactShadowAt(tanks, x, z, 11);
    });
    const bg = grp(campus, 166, 124, -DIAG);
    box(bg, 9, 0.8, 2.4, mWhiteSoft, 0, 1.6, 0);
    [-3.5, 3.5].forEach((x) => box(bg, 0.8, 1.6, 2, mWhiteSoft, x, 0, 0));
    box(bg, 9, 1.6, 0.6, mWhiteSoft, 0, 2.4, -1.2);
  }

  // 4) LIGA / SMART MALL - fachada listrada azul/laranja, telhado marrom frisado, anexo cubico branco
  {
    const g = grp(buildings, 153, -99, -DIAG);
    contactShadow(g, 46, 24);
    const stripes = new THREE.MeshStandardMaterial({ map: ligaTex, roughness: 0.45, color: col(0xffffff) });
    wallBox(g, 46, 22, 24, 0, 0, 0, {
      floors: 2, styleSide: 'punched', styleBack: 'plain', top: mRoofGrey, nodeId: 'smart-mall-liga',
      frontMat: stripes, leftMat: stripes
    });
    gableRoof(g, 46, 24, 7.5, 0, 22, 0, mRoofBrown, mWhite, 1.6);
    box(g, 14, 0.8, 5, mWhite, -8, 0, 14.5);
    occOf(g, 0, 0, 46, 24, 22);
    const a = grp(buildings, 191, -97, -DIAG);
    contactShadow(a, 22, 22);
    wallBox(a, 22, 24, 22, 0, 0, 0, { floors: 3, styleFront: 'ribbon', styleSide: 'plain', styleBack: 'plain', top: mRoofGrey, nodeId: 'smart-mall-liga' });
    parapet(a, 22, 22, 24, 1.2, 1.6);
    occOf(a, 0, 0, 22, 22, 24);
  }

  // 5) BIBLIOTECA SOLAR EM "L" + ANEXO DE CLARABOIAS + USINA FOTOVOLTAICA DE SOLO
  {
    const g = grp(buildings, -66, -102, DIAG);
    contactShadow(g, 60, 28);
    wallBox(g, 60, 28, 28, 0, 0, 0, { floors: 3, styleFront: 'ribbon', styleSide: 'punched', styleBack: 'punched', top: mRoofGrey, nodeId: 'complexo-solar-norte' });
    parapet(g, 60, 28, 28, 1.4, 2.0);
    const tilt = new THREE.Group();
    tilt.position.set(-4, 30, -1);
    tilt.rotation.x = 0.2;
    g.add(tilt);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(48, 0.9, 22), solarMat(3, 1.5));
    slab.castShadow = true;
    slab.receiveShadow = true;
    tilt.add(slab);
    box(tilt, 49, 0.5, 0.8, mMetal, 0, 0.4, 11);
    box(tilt, 49, 0.5, 0.8, mMetal, 0, 0.4, -11);
    [-18, 0, 18].forEach((x) => box(g, 1.2, 3, 1.2, mMetal, x, 28, 9));
    box(g, 12, 3, 8, mDarkGrey, 20, 28, 4);
    wallBox(g, 28, 22, 22, 16, 0, 25, { floors: 3, styleFront: 'ribbon', styleSide: 'punched', styleBack: 'plain', top: mRoofGrey, nodeId: 'complexo-solar-norte' });
    box(g, 2.4, 20, 10, mGlass, 30.5, 1, 14);
    wallBox(g, 14, 11, 12, 36, 0, -6, { floors: 1, styleFront: 'plain', styleSide: 'plain', top: mWhite });
    const rs = box(g, 16, 0.8, 14, mWhite, 36, 11, -6);
    rs.rotation.z = -0.16;
    occOf(g, 0, 0, 60, 28, 28);
    occOf(g, 16, 25, 28, 22, 22);

    const a = grp(buildings, -109, -76, DIAG);
    contactShadow(a, 52, 20);
    wallBox(a, 52, 13, 20, 0, 0, 0, { floors: 2, styleFront: 'ribbon', styleSide: 'punched', styleBack: 'plain', top: mWhite, nodeId: 'complexo-solar-norte' });
    parapet(a, 52, 20, 13, 1.0, 1.4);
    const skyMat = std(0x3a95d6, { roughness: 0.08, metalness: 0.6, emissive: col(0x0a3c6e), emissiveIntensity: 0.35 });
    skyMat.userData.glass = true;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        const x = -22 + c * 6.3, z = -4.6 + r * 9.2;
        box(a, 5.4, 0.25, 6.2, mWhite, x, 13, z);
        box(a, 4.6, 0.35, 5.2, skyMat, x, 13.1, z);
      }
    }
    occOf(a, 0, 0, 52, 20, 13);

    [[-22, 22], [-4, 22], [14, 22]].forEach(([lx, lz]) => {
      const ag = grp(a, lx, lz, 0);
      contactShadow(ag, 16, 8, 0, 0, 0.35);
      for (let i = 0; i < 2; i++) {
        const pg = new THREE.Group();
        pg.position.set(-4.2 + i * 8.4, 3.6, 0);
        pg.rotation.x = 0.55;
        const p = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 5.6), solarMat(1.5, 1));
        p.castShadow = true;
        p.receiveShadow = true;
        pg.add(p);
        ag.add(pg);
      }
      [-8, 0, 8].forEach((x) => box(ag, 0.5, 3.6, 0.5, mMetal, x, 0, 1.4));
      box(ag, 17, 0.35, 0.35, mMetal, 0, 2.4, 1.4);
    });
  }

  // 6) PREDIO BRANCO NORTE (administrativo, 2 andares)
  {
    const g = grp(buildings, -26, -168, 0.12);
    contactShadow(g, 34, 22);
    wallBox(g, 34, 17, 22, 0, 0, 0, { floors: 2, styleFront: 'punched', styleSide: 'punched', styleBack: 'plain', top: mRoofGrey });
    parapet(g, 34, 22, 17, 1.2, 1.8);
    box(g, 14, 3, 8, mWhite, -6, 18.8, -2);
    box(g, 3.2, 6, 0.6, mTeal, 2, 0, 11.2);
    occOf(g, 0, 0, 34, 22, 17);
  }

  // 7) ESTUFA AGRICOLA ABOBADADA + HORTA SUSPENSA
  {
    const g = grp(buildings, 36, -152, DIAG);
    contactShadow(g, 40, 22);
    const R = 10.5, LEN = 40;
    const skin = new THREE.MeshStandardMaterial({
      color: col(0xf4f7f8), roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88, side: THREE.DoubleSide
    });
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 32, 1, true, 0, Math.PI), skin);
    vault.rotation.z = Math.PI / 2;
    vault.position.y = 1.2;
    vault.castShadow = true;
    vault.receiveShadow = true;
    g.add(vault);
    box(g, LEN, 1.2, 0.6, mWhite, 0, 0, R);
    box(g, LEN, 1.2, 0.6, mWhite, 0, 0, -R);
    for (let i = 0; i <= 8; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 6, 28, Math.PI), mWhite);
      rib.rotation.y = Math.PI / 2;
      rib.position.set(-LEN / 2 + (i * LEN) / 8, 1.2, 0);
      rib.castShadow = true;
      g.add(rib);
    }
    [-LEN / 2, LEN / 2].forEach((x) => {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 28, 0, Math.PI), skin);
      cap.rotation.y = Math.PI / 2;
      cap.position.set(x, 1.2, 0);
      g.add(cap);
    });
    box(g, 0.5, 6.5, 4, mTeal, -LEN / 2 - 0.1, 1.2, 0);
    occOf(g, 0, 0, 40, 22, 11);
    const woodMat = std(0x8a5a2e, { roughness: 0.8 });
    const soilMat = std(0x4a3020, { roughness: 1 });
    [0, 1].forEach((i) => {
      const hg = grp(buildings, 12 + i * 7, -165 + i * 4, DIAG);
      [-4, 4].forEach((x) => box(hg, 0.7, 2.2, 3, woodMat, x, 0, 0));
      box(hg, 10.5, 1.4, 4.4, woodMat, 0, 2.2, 0);
      box(hg, 9.6, 0.4, 3.6, soilMat, 0, 3.4, 0);
      for (let k = 0; k < 6; k++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8), std(k % 2 ? 0x4f9a2c : 0x6bb33a, { roughness: 0.8 }));
        p.position.set(-4 + k * 1.6, 4.4, (k % 2 ? 1 : -1) * 0.8);
        p.castShadow = true;
        hg.add(p);
      }
    });
  }

  // 8) BLOCO NORDESTE (toldos vermelhos) + ELETROPOSTO + carrinho
  {
    const g = grp(buildings, 92, -153, -DIAG);
    contactShadow(g, 38, 20);
    wallBox(g, 38, 13, 20, 0, 0, 0, { floors: 2, styleFront: 'punched', styleSide: 'punched', styleBack: 'plain', top: mRoofGrey });
    gableRoof(g, 38, 20, 4.5, 0, 13, 0, mRoofGrey, mWhite, 1.2);
    const awn = std(0xd32f2f, { roughness: 0.6, side: THREE.DoubleSide });
    [-9, 4].forEach((x) => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 4), awn);
      a.position.set(x, 8.4, 11.8);
      a.rotation.x = 0.4;
      a.castShadow = true;
      g.add(a);
    });
    box(g, 14, 0.8, 4.5, mWhiteSoft, 12, 0, 12);
    occOf(g, 0, 0, 38, 20, 13);
    const t = grp(buildings, 72, -128, 0);
    box(t, 2, 6.5, 1.6, mWhite, 0, 0, 0);
    box(t, 2.05, 1.8, 1.65, mRed, 0, 4.2, 0);
    box(t, 1.2, 1.4, 0.2, basic(0x35d07f), 0, 2.2, 0.9);
    const cart = grp(buildings, 78, -122, 0.6);
    box(cart, 4.2, 3.2, 3.4, mWhite, 0, 0.9, 0);
    box(cart, 4.3, 1.1, 3.5, mRed, 0, 2.6, 0);
    [-1.6, 1.6].forEach((x) => [-1.5, 1.5].forEach((z) => {
      const w = cyl(cart, 0.8, 0.8, 0.6, mDarkGrey, x, 0, z, 10);
      w.rotation.z = Math.PI / 2;
    }));
  }

  // 9) OS 3 BLOCOS ACADEMICOS CENTRAIS (diagonal), brises, porticos vermelhos e patio coberto
  const centralBlock = (x: number, z: number, len: number, dep: number, h: number, patio: boolean) => {
    const g = grp(buildings, x, z, DIAG);
    contactShadow(g, len, dep);
    wallBox(g, len, h, dep, 0, 0, 0, {
      floors: 2, styleFront: 'ribbon', styleSide: 'punched', styleBack: 'punched', top: mRoofGrey, nodeId: 'blocos-centrais'
    });
    box(g, len + 0.5, 1.3, dep + 0.5, std(0x6d5a4c, { roughness: 0.85 }), 0, 0, 0);
    gableRoof(g, len, dep, 6.5, 0, h, 0, mRoofBrown, mWhite, 1.6);
    box(g, len + 2, 1.2, 3.6, mWhite, 0, h - 3.2, dep / 2 + 1.7);
    for (let i = 0; i < Math.floor(len / 6.4); i++) {
      box(g, 0.5, h - 9, 2.0, mWhite, -len / 2 + 4 + i * 6.4, 3.2, dep / 2 + 1.0);
    }
    [dep / 2 - 2.5, dep / 2 - 9.5].forEach((lz) => box(g, 2.3, h - 0.5, 2.3, mRed, len / 2 + 1.2, 0, lz));
    box(g, 2.6, 2.2, 10.4, mRed, len / 2 + 1.2, h - 2.7, dep / 2 - 6);
    if (patio) {
      const pz = dep / 2 + 9;
      box(g, 38, 0.8, 13, mWhiteSoft, -4, 9, pz);
      [-20, -4, 12].forEach((px) => [pz - 5, pz + 5].forEach((zz) => box(g, 0.9, 9, 0.9, mRed, px, 0, zz)));
      rect(g, 38, 13, walkMat, -4, pz, 0.15);
    }
    occOf(g, 0, 0, len, dep, h + 4);
    return g;
  };
  centralBlock(22, -75, 62, 26, 21, true);
  centralBlock(2, -13, 64, 25, 21, false);
  centralBlock(17, 58, 64, 25, 21, false);

  // 10) AMBULATORIO / POSTO MEDICO com cruz vermelha
  {
    const g = grp(buildings, -80, -16, DIAG);
    contactShadow(g, 24, 14);
    wallBox(g, 24, 11, 14, 0, 0, 0, { floors: 1, styleFront: 'punched', styleSide: 'plain', styleBack: 'plain', top: mDarkGrey, bay: 12 });
    box(g, 25.4, 1.4, 15.4, mDarkGrey, 0, 11, 0);
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.6, color: col(0xffffff) }));
    cm.position.set(12.06, 5.6, 0);
    cm.rotation.y = Math.PI / 2;
    g.add(cm);
    box(g, 0.3, 5.4, 4, mBlueWall, 12.05, 0, -4.4);
    occOf(g, 0, 0, 24, 14, 12);
  }

  // 11) RELOGIO DE SOL + CANTEIROS LINEARES
  {
    const g = grp(buildings, -34, -64, DIAG);
    cyl(g, 5.2, 5.6, 0.7, mStone, 0, 0, 0, 36);
    cyl(g, 4.0, 4.0, 0.2, std(0xd9d4c6, { roughness: 0.6 }), 0, 0.7, 0, 36);
    const gn = new THREE.Mesh(new THREE.ConeGeometry(1.0, 4.2, 3), mMetal);
    gn.position.set(0, 3.0, 0);
    gn.rotation.set(0.5, 0, 0);
    gn.castShadow = true;
    g.add(gn);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      box(g, 0.25, 0.1, 1.2, mDarkGrey, Math.sin(a) * 3.1, 0.9, Math.cos(a) * 3.1).rotation.y = a;
    }
    contactShadowAt(g, 0, 0, 7, 0.45);
    const bush = std(0x4f8a2e, { roughness: 0.85 });
    [[-17, 6], [-17, 11], [17, -2], [17, 3]].forEach(([x, z]) => {
      box(g, 18, 1.1, 3.6, mStone, x, 0, z);
      for (let k = 0; k < 6; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), bush);
        s.scale.y = 0.8;
        s.position.set(x - 7.5 + k * 3, 1.8, z);
        s.castShadow = true;
        g.add(s);
      }
    });
  }

  // 12) LABORATORIO DE ENGENHARIA OESTE - 16 exaustores cogumelo, marquise listrada, galpao e quadra
  {
    const g = grp(buildings, -158, 16, DIAG);
    contactShadow(g, 66, 28);
    wallBox(g, 66, 22, 28, 0, 0, 0, { floors: 2, styleFront: 'ribbon', styleSide: 'punched', styleBack: 'plain', top: mRoofGrey, nodeId: 'lab-engenharias-oeste' });
    parapet(g, 66, 28, 22, 1.2, 1.4, mWhiteSoft);
    box(g, 66, 0.35, 28, mRoofGrey, 0, 22.6, 0);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        const fx = -24.5 + c * 7, fz = r ? 6 : -6;
        cyl(g, 0.7, 0.9, 2.0, mWhite, fx, 22.5, fz, 10);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mWhite);
        cap.scale.y = 0.62;
        cap.position.set(fx, 24.4, fz);
        cap.castShadow = true;
        g.add(cap);
        cyl(g, 2.3, 2.3, 0.25, mWhiteSoft, fx, 24.35, fz, 14);
      }
    }
    const cmat = new THREE.MeshStandardMaterial({ map: stripeCanopyTex, roughness: 0.6, color: col(0xffffff), side: THREE.DoubleSide });
    stripeCanopyTex.repeat.set(3, 1);
    const can = new THREE.Mesh(new THREE.BoxGeometry(40, 0.7, 9), cmat);
    can.position.set(-6, 10.5, 18.4);
    can.rotation.x = 0.1;
    can.castShadow = true;
    can.receiveShadow = true;
    g.add(can);
    [-24, -6, 12].forEach((x) => box(g, 0.7, 10.4, 0.7, mWhite, x, 0, 22));
    wallBox(g, 22, 12, 14, -22, 0, 21, { floors: 1, styleFront: 'punched', styleSide: 'plain', top: mRoofGrey, nodeId: 'lab-engenharias-oeste' });
    for (let i = 0; i < 5; i++) box(g, 8 - i * 0.5, 0.7, 3, mStone, 34, i * 0.7, 6 + i * 0.4);
    occOf(g, 0, 0, 66, 28, 22);

    const gg = grp(buildings, -186, -38, DIAG);
    contactShadow(gg, 38, 20);
    const metalWhite = std(0xeceff0, { roughness: 0.32, metalness: 0.5, side: THREE.DoubleSide });
    box(gg, 38, 6, 20, mWhite, 0, 0, 0);
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 38, 28, 1, true, 0, Math.PI), metalWhite);
    vault.rotation.z = Math.PI / 2;
    vault.position.y = 6;
    vault.scale.set(1, 1, 0.55);
    vault.castShadow = true;
    vault.receiveShadow = true;
    gg.add(vault);
    for (let i = 0; i <= 10; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(10, 0.22, 5, 24, Math.PI), mWhiteSoft);
      rib.rotation.y = Math.PI / 2;
      rib.scale.set(1, 0.55, 1);
      rib.position.set(-19 + i * 3.8, 6, 0);
      gg.add(rib);
    }
    box(gg, 8, 5, 0.4, mDarkGrey, -6, 0, 10.1);
    occOf(gg, 0, 0, 38, 20, 11);

    const qd = grp(buildings, -208, -4, -DIAG);
    box(qd, 34, 0.35, 22, std(0x3b4a24, { roughness: 0.9 }), 0, 0.1, 0);
    const wallM = std(0xd9dcd5, { roughness: 0.7 });
    box(qd, 34, 3, 0.7, wallM, 0, 0, 11);
    box(qd, 34, 3, 0.7, wallM, 0, 0, -11);
    box(qd, 0.7, 3, 22, wallM, 17, 0, 0);
    box(qd, 0.7, 3, 22, wallM, -17, 0, 0);
    box(qd, 0.4, 0.1, 18, basic(0xd8dcc0), 0, 0.47, 0);
    [-1, 1].forEach((s) => {
      box(qd, 0.25, 3.2, 0.25, mWhite, s * 15.5, 0, -3);
      box(qd, 0.25, 3.2, 0.25, mWhite, s * 15.5, 0, 3);
      box(qd, 0.25, 0.25, 6.4, mWhite, s * 15.5, 3.2, 0);
    });
    contactShadow(qd, 34, 22, 0, 0, 0.35);
  }

  // 13) BLOCO ANEXO SUDOESTE - 2 andares, telhado marrom frisado, escadaria externa lateral
  {
    const g = grp(buildings, -110, 52, DIAG);
    contactShadow(g, 46, 22);
    wallBox(g, 46, 20, 22, 0, 0, 0, { floors: 2, styleFront: 'ribbon', styleSide: 'punched', styleBack: 'punched', top: mRoofGrey, nodeId: 'lab-engenharias-oeste' });
    gableRoof(g, 46, 22, 5.5, 0, 20, 0, mRoofBrown, mWhite, 1.6);
    box(g, 46.4, 1.2, 22.4, std(0x6d5a4c, { roughness: 0.85 }), 0, 0, 0);
    for (let i = 0; i < 9; i++) box(g, 9.5 - i * 0.2, 0.8, 3.2, mStone, 27.5, i * 0.9, 4);
    box(g, 3, 8.6, 8, mStone, 22, 0, 12);
    box(g, 6, 0.5, 11, mStone, 25, 8.6, 14);
    occOf(g, 0, 0, 46, 22, 20);
  }

  // 14) CAMPO DE FUTEBOL OFICIAL (sudoeste) - gramado listrado, marcacoes, traves com rede e alambrado
  {
    const g = grp(buildings, -165, 107, -0.62);
    const PW = 94, PD = 59;
    const turf = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PD),
      level(new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.85, color: col(0xffffff) }), 2)
    );
    groundMats.push({ mat: turf.material, day: 0xffffff, night: 0x2a3a50 });
    turf.rotation.x = -Math.PI / 2;
    turf.position.y = 0.1;
    turf.receiveShadow = true;
    g.add(turf);
    const netMat = new THREE.MeshBasicMaterial({ color: col(0xffffff), wireframe: true, transparent: true, opacity: 0.6 });
    [-1, 1].forEach((s) => {
      const gx = s * (PW / 2 - 1.6);
      const gp = std(0xffffff, { roughness: 0.35 });
      [-4, 4].forEach((z) => cyl(g, 0.22, 0.22, 3.6, gp, gx, 0, z, 8));
      const cb = cyl(g, 0.22, 0.22, 8.2, gp, gx, 3.6, 0, 8);
      cb.rotation.x = Math.PI / 2;
      cb.position.y = 3.7;
      const net = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 8, 2, 4, 8), netMat);
      net.position.set(gx + s * 1.4, 1.8, 0);
      g.add(net);
    });
    const wire = new THREE.MeshBasicMaterial({ color: col(0xcfd8b0), transparent: true, opacity: 0.55, wireframe: true });
    const fence = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d, Math.max(1, (w / 3) | 0), 2, Math.max(1, (d / 3) | 0)), wire);
      m.position.set(x, 1.7, z);
      g.add(m);
    };
    fence(PW + 4, 0.3, 0, PD / 2 + 1.5);
    fence(PW + 4, 0.3, 0, -PD / 2 - 1.5);
    fence(0.3, PD + 3, PW / 2 + 2, 0);
    fence(0.3, PD + 3, -PW / 2 - 2, 0);
    box(g, PW + 4.5, 0.7, 0.5, std(0xc9cdb8, { roughness: 0.8 }), 0, 0, PD / 2 + 1.5);
    box(g, PW + 4.5, 0.7, 0.5, std(0xc9cdb8, { roughness: 0.8 }), 0, 0, -PD / 2 - 1.5);
    contactShadow(g, PW + 2, PD + 2, 0, 0, 0.25);
  }

  // 15) PORTARIA/QUIOSQUE AZUL NA MARGEM DO LAGO (com cerca branca)
  {
    const g = grp(buildings, -197, -64, -DIAG);
    contactShadow(g, 9, 8, 0, 0, 0.5);
    box(g, 8, 5.4, 6.4, mBlueWall, 0, 0, 0);
    box(g, 9, 0.8, 7.4, mWhite, 0, 5.4, 0);
    box(g, 3, 3, 0.3, std(0xcfe9f7, { roughness: 0.1, metalness: 0.5 }), 0, 1.4, 3.3);
    for (let i = 0; i < 6; i++) box(g, 0.35, 2.4, 0.35, mWhite, -14 + i * 1.8, 0, 6);
    box(g, 10, 0.3, 0.3, mWhite, -9, 1.7, 6);
    box(g, 10, 0.3, 0.3, mWhite, -9, 0.7, 6);
    [-1, 1].forEach((s) => cyl(g, 0.2, 0.2, 3.4, mWhite, -22 + s * 3, 0, -2, 8));
    box(g, 6.2, 0.22, 0.22, mWhite, -22, 3.2, -2);
  }


  /* =====================================================================
   *  CENARIO: LAGO, PATOS, AVIAO, BANDEIRAS, DRONE, BOSQUES
   * ===================================================================== */
  const LAKE = { x: -184, z: -122, rot: -0.2, rx: 40, rz: 21 };
  const blobPts = (scale: number, n = 64): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + 0.12 * Math.sin(3 * a + 1) + 0.08 * Math.sin(5 * a + 2) + 0.06 * Math.sin(2 * a);
      const lx = Math.cos(a) * r * LAKE.rx * scale, lz = Math.sin(a) * r * LAKE.rz * scale;
      pts.push([
        LAKE.x + lx * Math.cos(LAKE.rot) + lz * Math.sin(LAKE.rot),
        LAKE.z - lx * Math.sin(LAKE.rot) + lz * Math.cos(LAKE.rot)
      ]);
    }
    return pts;
  };
  const waterUniforms = { uTime: { value: 0 }, uSun: { value: sunDir.clone() } };
  const waterMat = (deep: number, shallow: number, alpha: number, lvl: number) => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        ...waterUniforms,
        uDeep: { value: col(deep) },
        uShallow: { value: col(shallow) },
        uAlpha: { value: alpha }
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uAlpha;
        varying vec3 vWorld;
        void main() {
          vec2 p = vWorld.xz * 0.11;
          float t = uTime;
          vec3 n = normalize(vec3(
            sin(p.x * 3.1 + t * 1.3) * 0.09 + sin(p.y * 5.3 - t * 0.9 + p.x * 2.0) * 0.06,
            1.0,
            cos(p.y * 3.7 + t * 1.1) * 0.09 + sin(p.x * 6.1 + t * 1.7 + p.y) * 0.05));
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 H = normalize(V + normalize(uSun));
          float spec = pow(max(dot(n, H), 0.0), 140.0) * 1.7;
          float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
          float ripple = 0.5 + 0.5 * sin((p.x + p.y) * 9.0 + t * 1.5 + sin(p.x * 4.0 - t));
          vec3 c = mix(uDeep, uShallow, clamp(0.28 + fres * 0.7 + ripple * 0.14, 0.0, 1.0));
          c += vec3(1.0, 0.98, 0.9) * spec;
          gl_FragColor = vec4(c, uAlpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -lvl,
      polygonOffsetUnits: -lvl
    });
    return m;
  };
  const waterMats: any[] = [];
  {
    const shore = std(0x8a9040, { roughness: 1 });
    level(shore, 1);
    campus.add(polyDecal(blobPts(1.2), shore, 0.07));
    const shallow = waterMat(0x2fb8d0, 0x7fe0ec, 0.95, 2);
    const deep = waterMat(0x0b8fb5, 0x2fc3dc, 0.97, 3);
    waterMats.push(shallow, deep);
    campus.add(polyDecal(blobPts(1.06), shallow, 0.1));
    const dm = polyDecal(blobPts(0.9), deep, 0.12);
    campus.add(dm);
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 24), std(0x76b83f, { roughness: 0.85 }));
    isl.position.set(LAKE.x + 18, 0.5, LAKE.z - 9);
    isl.scale.set(1.1, 1, 0.8);
    isl.receiveShadow = true;
    isl.castShadow = true;
    campus.add(isl);
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), std(0x4f8a2e, { roughness: 0.9 }));
      b.position.set(LAKE.x + 15.5 + k * 1.8, 1.6, LAKE.z - 9 + (k % 2) * 1.6);
      b.castShadow = true;
      campus.add(b);
    }
  }

  // ---- 3 patos brancos de pescoco e cabeca pretos + aneis de onda ----
  const ducks: { g: any; rings: any[]; base: [number, number]; ph: number }[] = [];
  {
    const white = std(0xfafafa, { roughness: 0.6 });
    const black = std(0x15171a, { roughness: 0.6 });
    const beak = std(0xf29b1d, { roughness: 0.6 });
    const bases: [number, number][] = [[LAKE.x - 15, LAKE.z + 1], [LAKE.x + 1, LAKE.z - 2], [LAKE.x + 15, LAKE.z + 3]];
    bases.forEach((b, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), white);
      body.scale.set(1.6, 1.0, 2.7);
      body.position.y = 1.3;
      g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 8), white);
      tail.rotation.x = -Math.PI / 2.4;
      tail.position.set(0, 1.9, -2.7);
      g.add(tail);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.8, 10), black);
      neck.position.set(0, 3.1, 2.1);
      neck.rotation.x = -0.25;
      g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), black);
      head.position.set(0, 4.5, 2.4);
      g.add(head);
      const bk = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 8), beak);
      bk.rotation.x = Math.PI / 2;
      bk.position.set(0, 4.35, 3.4);
      g.add(bk);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), white);
      cheek.position.set(0.55, 4.45, 2.6);
      g.add(cheek);
      g.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; } });
      g.scale.setScalar(1.15);
      campus.add(g);
      const rings: any[] = [];
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(
          new THREE.RingGeometry(0.9, 1, 40),
          level(new THREE.MeshBasicMaterial({ color: col(0xffffff), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), 6)
        );
        r.rotation.x = -Math.PI / 2;
        r.position.set(b[0], 0.2, b[1]);
        campus.add(r);
        rings.push(r);
      }
      ducks.push({ g, rings, base: b, ph: i * 1.7 });
    });
  }

  // ---- Aviao AeroDesign (asas vermelha/amarela/azul, fuselagem fina) ----
  {
    const [ax, az] = P(1190, 395);
    const g = grp(props, ax, az, 0.62, 0);
    const fus = std(0xf7f7f4, { roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 17, 12), fus);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 3.0, 0);
    body.castShadow = true;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), std(0xd32f2f, { roughness: 0.4 }));
    nose.position.set(8.5, 3.0, 0);
    nose.scale.set(1.2, 1, 1);
    g.add(nose);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mGlass);
    canopy.position.set(2.5, 3.6, 0);
    canopy.scale.set(2.2, 1, 1);
    g.add(canopy);
    [[0xd32f2f, -6.5], [0xfbc02d, 0], [0x1e6fd0, 6.5]].forEach(([c, z]) => {
      box(g, 4.6, 0.35, 6.6, std(c, { roughness: 0.45 }), 1.5, 3.9, z as number, { recv: false });
    });
    box(g, 4.6, 0.2, 0.5, mWhite, 1.5, 4.25, 0);
    box(g, 2.4, 0.25, 8, std(0xfbc02d, { roughness: 0.45 }), -7.6, 3.3, 0);
    box(g, 2.4, 3.2, 0.3, std(0x1e6fd0, { roughness: 0.45 }), -7.6, 3.0, 0);
    const prop = box(g, 0.2, 4.8, 0.5, mDarkGrey, 9.6, 0.6, 0);
    prop.position.y = 3.0;
    prop.userData.spin = true;
    [[2.5, 3], [2.5, -3], [-6.8, 0]].forEach(([x, z]) => {
      box(g, 0.2, 1.7, 0.2, mDarkGrey, x, 1.0, z);
      const w = cyl(g, 0.65, 0.65, 0.4, std(0x1a1a1a, { roughness: 0.8 }), x, 0, z, 10);
      w.rotation.x = Math.PI / 2;
      w.position.y = 0.65;
    });
    contactShadow(g, 14, 20, 0, 0, 0.3);
  }

  // ---- Praca das 5 bandeiras (deformacao senoidal) ----
  const flags: { geo: any; base: Float32Array; i: number }[] = [];
  {
    const cols = [0x1fa64a, 0x1976d2, 0xfbc02d, 0xd32f2f, 0xf5f5f5];
    const [fx, fz] = P(1215, 600);
    cols.forEach((c, i) => {
      const x = fx + i * 4.6, z = fz - i * 1.4;
      const h = 30 + (i % 2) * 2;
      cyl(props, 0.28, 0.42, h, std(0xf4f4f2, { roughness: 0.3, metalness: 0.4 }), x, 0, z, 10);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), std(0xe0b030, { metalness: 0.8, roughness: 0.3 }));
      ball.position.set(x, h + 0.5, z);
      props.add(ball);
      const geo = new THREE.PlaneGeometry(8, 5, 16, 6);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.7, side: THREE.DoubleSide }));
      mesh.position.set(x + 4.2, h - 3.0, z);
      mesh.castShadow = true;
      props.add(mesh);
      flags.push({ geo, base: new Float32Array(geo.attributes.position.array), i });
      contactShadowAt(props, x, z, 2.2, 0.4);
    });
  }

  // ---- Drone quadricoptero branco pairando ----
  const drone = new THREE.Group();
  const droneRotors: any[] = [];
  let droneShadow: any;
  {
    drone.position.set(-115, 26, 86);
    const bodyMat = std(0xfafafa, { roughness: 0.22, metalness: 0.1 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), bodyMat);
    core.scale.set(1.25, 0.62, 1.25);
    drone.add(core);
    const top = box(drone, 3.6, 0.8, 3.6, mWhiteSoft, 0, 1.2, 0);
    top.castShadow = true;
    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), std(0x1a1d22, { roughness: 0.3, metalness: 0.5 }));
    gimbal.position.set(0, -1.7, 1.6);
    drone.add(gimbal);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), basic(0x4fc3f7));
    lens.position.set(0, -1.7, 2.62);
    drone.add(lens);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const arm = box(drone, 9, 0.55, 0.9, bodyMat, 0, -0.1, 0);
      arm.position.set(sx * 3.3, 0.1, sz * 3.3);
      arm.scale.set(1.03, 1, 1);
      arm.rotation.y = Math.atan2(-sz, sx);
      const mx = sx * 6.6, mz = sz * 6.6;
      cyl(drone, 1.0, 1.0, 1.1, std(0x30343a, { roughness: 0.4, metalness: 0.5 }), mx, -0.4, mz, 12);
      const rotor = new THREE.Group();
      rotor.position.set(mx, 1.0, mz);
      [0, Math.PI / 2].forEach((a) => {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.7), std(0x2d3138, { roughness: 0.4 }));
        bl.rotation.y = a;
        rotor.add(bl);
      });
      const blur = new THREE.Mesh(
        new THREE.CircleGeometry(3.5, 24),
        new THREE.MeshBasicMaterial({ color: col(0xdbe9f5), transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
      );
      blur.rotation.x = -Math.PI / 2;
      rotor.add(blur);
      drone.add(rotor);
      droneRotors.push(rotor);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), basic(sz < 0 ? 0x35e07a : 0xff3b3b));
      led.position.set(mx, -1.0, mz);
      drone.add(led);
    });
    drone.traverse((o: any) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    campus.add(drone);
    droneShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      level(new THREE.MeshBasicMaterial({ map: circleShadowTex, transparent: true, opacity: 0.55, depthWrite: false }), 2)
    );
    droneShadow.rotation.x = -Math.PI / 2;
    droneShadow.position.set(-115, 0.12, 86);
    campus.add(droneShadow);
  }

  /* ---------------- BOSQUES (InstancedMesh) ---------------- */
  const treesGroup = new THREE.Group();
  campus.add(treesGroup);
  const exclusions: Occluder[] = [
    { x: -165, z: 107, w: 100, d: 66, rot: -0.62, h: 0 },
    { x: -208, z: -4, w: 40, d: 28, rot: -DIAG, h: 0 },
    { x: -48, z: 147, w: 116, d: 38, rot: 0, h: 0 },
    { x: 44, z: 140, w: 74, d: 64, rot: 0, h: 0 },
    { x: 66, z: -118, w: 60, d: 46, rot: 0, h: 0 },
    { x: 126, z: -72, w: 52, d: 30, rot: 0, h: 0 },
    { x: 127, z: 130, w: 50, d: 40, rot: 0, h: 0 },
    { x: 166, z: 112, w: 20, d: 28, rot: 0, h: 0 },
    { x: 100, z: 56, w: 34, d: 28, rot: 0, h: 0 },
    { x: 90, z: -38, w: 30, d: 28, rot: 0, h: 0 },
    { x: -197, z: -64, w: 40, d: 20, rot: 0, h: 0 },
    { x: 20, z: -168, w: 60, d: 40, rot: 0, h: 0 }
  ];
  const inObb = (o: Occluder, px: number, pz: number, margin: number) => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    const dx = px - o.x, dz = pz - o.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < o.w / 2 + margin && Math.abs(lz) < o.d / 2 + margin;
  };
  const ringSamples: [number, number][] = [];
  for (let i = 0; i < 300; i++) {
    const p = ringCurve.getPointAt(i / 300);
    ringSamples.push([p.x, p.z]);
  }
  const spurSamples: [number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const p = spurCurve.getPointAt(i / 40);
    spurSamples.push([p.x, p.z]);
  }
  const nearRoad = (x: number, z: number, d: number) =>
    ringSamples.some(([a, b]) => (a - x) ** 2 + (b - z) ** 2 < d * d) ||
    spurSamples.some(([a, b]) => (a - x) ** 2 + (b - z) ** 2 < (d - 2) ** 2) ||
    (x > 8 && x < 82 && z > 100);
  const blockedTree = (x: number, z: number) => {
    if (x < ISLAND.x0 + 8 || x > ISLAND.x1 - 8 || z < ISLAND.z0 + 8 || z > ISLAND.z1 - 7) return true;
    if (nearRoad(x, z, 12)) return true;
    const lx = ((x - LAKE.x) * Math.cos(LAKE.rot) - (z - LAKE.z) * Math.sin(LAKE.rot)) / (LAKE.rx * 1.3);
    const lz = ((x - LAKE.x) * Math.sin(LAKE.rot) + (z - LAKE.z) * Math.cos(LAKE.rot)) / (LAKE.rz * 1.45);
    if (lx * lx + lz * lz < 1) return true;
    if (occluders.some((o) => inObb(o, x, z, 4))) return true;
    if (exclusions.some((o) => inObb(o, x, z, 3))) return true;
    if (walkPaths.some((p) => p.some(([a, b], i) => i > 0 && Math.hypot((a + p[i - 1][0]) / 2 - x, (b + p[i - 1][1]) / 2 - z) < 5))) return true;
    return false;
  };
  type TreeSpec = { x: number; z: number; s: number; kind: 'pine' | 'cyp' | 'dec'; c: number };
  const treeSpecs: TreeSpec[] = [];
  const rnd = mulberry32(2026);
  const PINE_C = [0x2f4a22, 0x3d5a24, 0x4a6428, 0x35501f];
  const DEC_C = [0x9c3b27, 0xb85d27, 0xc4852a, 0x7d8a2e, 0xa5482e, 0xb5973a];
  const CYP_C = [0x46531f, 0x55612a, 0x3f4a1c];
  const pick = (a: number[]) => a[Math.floor(rnd() * a.length)];
  const addTree = (x: number, z: number, kind: TreeSpec['kind'], s = 1, c?: number) => {
    if (blockedTree(x, z)) return;
    treeSpecs.push({ x, z, s, kind, c: c ?? (kind === 'pine' ? pick(PINE_C) : kind === 'cyp' ? pick(CYP_C) : pick(DEC_C)) });
  };
  for (let x = -230; x <= -64; x += 10) {
    for (let z = -182; z <= -138; z += 10) {
      const r = rnd();
      addTree(x + rnd() * 6 - 3, z + rnd() * 6 - 3, r < 0.42 ? 'pine' : r < 0.78 ? 'dec' : 'cyp', 0.85 + rnd() * 0.5);
    }
  }
  for (let x = 118; x <= 230; x += 10) {
    for (let z = -182; z <= -108; z += 10) {
      const r = rnd();
      addTree(x + rnd() * 6 - 3, z + rnd() * 6 - 3, r < 0.45 ? 'pine' : r < 0.8 ? 'dec' : 'cyp', 0.85 + rnd() * 0.5);
    }
  }
  ([
    ['p', 430, 300], ['p', 378, 305], ['d', 745, 355, 0xc4692a], ['p', 770, 415], ['c', 790, 470], ['d', 845, 490, 0xb85d27],
    ['c', 1045, 375], ['d', 1075, 360, 0x9c3b27], ['c', 1160, 280], ['c', 1190, 320], ['c', 1205, 300], ['c', 1045, 205], ['c', 1070, 225],
    ['d', 1190, 445, 0xc4852a], ['c', 1110, 470], ['c', 1195, 545], ['d', 1275, 490, 0xc4852a], ['d', 1390, 560, 0x9c3b27],
    ['c', 1420, 600], ['d', 1490, 580, 0xa5482e], ['d', 1100, 590, 0xb85d27], ['d', 1040, 610, 0xc4852a], ['d', 690, 650, 0x9c3b27],
    ['c', 715, 620], ['c', 745, 650], ['c', 775, 640], ['c', 440, 590], ['c', 385, 560], ['d', 385, 540, 0x7d8a2e], ['c', 255, 530],
    ['d', 290, 500, 0x7d8a2e], ['c', 200, 470], ['c', 185, 440], ['d', 160, 680, 0x9c3b27], ['d', 360, 790, 0xa5482e],
    ['d', 1530, 505, 0x9c3b27], ['d', 1650, 480, 0xb85d27], ['c', 1640, 520]
  ] as any[]).forEach(([k, px, py, c]) => {
    const [x, z] = P(px, py);
    addTree(x, z, k === 'p' ? 'pine' : k === 'c' ? 'cyp' : 'dec', 0.95 + rnd() * 0.35, c);
  });
  [[92, 152], [102, 158], [112, 150], [122, 159], [132, 151], [168, 152], [178, 160], [188, 150], [198, 158], [208, 148], [218, 156],
   [-103, 163], [-24, 163], [-5, 162], [-215, 150], [-210, 128], [-196, 160]].forEach(([x, z], i) =>
    addTree(x, z, i < 11 ? 'cyp' : 'dec', 1.15 + rnd() * 0.3, i < 11 ? undefined : 0x9c3b27));

  const tcount = { pine: 0, cyp: 0, dec: 0 };
  treeSpecs.forEach((t) => tcount[t.kind]++);
  const nTree = treeSpecs.length;
  const iTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.3, 7, 8), mTrunk, nTree);
  const iPineLo = new THREE.InstancedMesh(new THREE.ConeGeometry(5.4, 11, 10), std(0xffffff, { roughness: 0.85 }), Math.max(1, tcount.pine));
  const iPineUp = new THREE.InstancedMesh(new THREE.ConeGeometry(3.9, 9, 10), std(0xffffff, { roughness: 0.85 }), Math.max(1, tcount.pine));
  const iCyp = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), std(0xffffff, { roughness: 0.85 }), Math.max(1, tcount.cyp));
  const iDecLo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std(0xffffff, { roughness: 0.85 }), Math.max(1, tcount.dec));
  const iDecUp = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std(0xffffff, { roughness: 0.85 }), Math.max(1, tcount.dec));
  const iShadow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    level(new THREE.MeshBasicMaterial({ map: circleShadowTex, transparent: true, opacity: 0.55, depthWrite: false }), 2),
    nTree
  );
  [iTrunk, iPineLo, iPineUp, iCyp, iDecLo, iDecUp].forEach((m: any) => { m.castShadow = true; m.receiveShadow = true; });
  {
    const dummy = new THREE.Object3D();
    const cc = new THREE.Color();
    let ip = 0, ic = 0, id = 0;
    const put = (m: any, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, ry = 0) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (color >= 0) m.setColorAt(i, cc.copy(col(color)));
    };
    treeSpecs.forEach((t, i) => {
      const s = t.s, ry = rnd() * 6;
      const tv = t.kind === 'cyp' ? 0.5 : 1;
      put(iTrunk, i, t.x, 3.5 * s * tv, t.z, s, s * tv, s, -1);
      if (t.kind === 'pine') {
        put(iPineLo, ip, t.x, 8.5 * s, t.z, s, s, s, t.c, ry);
        put(iPineUp, ip, t.x, 14.5 * s, t.z, s, s, s, t.c, ry);
        ip++;
      } else if (t.kind === 'cyp') {
        put(iCyp, ic, t.x, 12.5 * s, t.z, 3.1 * s, 12.5 * s, 3.1 * s, t.c, ry);
        ic++;
      } else {
        put(iDecLo, id, t.x, 10.5 * s, t.z, 5.8 * s, 5.0 * s, 5.8 * s, t.c, ry);
        put(iDecUp, id, t.x + 1.4 * s, 15.5 * s, t.z - 0.8 * s, 4.3 * s, 3.8 * s, 4.3 * s, t.c, ry);
        id++;
      }
      dummy.position.set(t.x + 1.5, 0.12, t.z + 1.2);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      const r = (t.kind === 'cyp' ? 4.6 : 8) * s;
      dummy.scale.set(r, r, 1);
      dummy.updateMatrix();
      iShadow.setMatrixAt(i, dummy.matrix);
    });
    iPineLo.count = tcount.pine; iPineUp.count = tcount.pine; iCyp.count = tcount.cyp;
    iDecLo.count = tcount.dec; iDecUp.count = tcount.dec;
    [iTrunk, iPineLo, iPineUp, iCyp, iDecLo, iDecUp, iShadow].forEach((m: any) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      treesGroup.add(m);
    });
    iShadow.renderOrder = 2;
  }


  /* =====================================================================
   *  VEICULOS ESTACIONADOS + TRAFEGO IDM + PEDESTRES + POSTES + ACUSTICA
   * ===================================================================== */
  const wheelMat = std(0x181b20, { roughness: 0.78 });
  const hubMat = std(0xd8dde4, { roughness: 0.35, metalness: 0.6 });
  const winTintMat = std(0x102840, { roughness: 0.1, metalness: 0.8 });
  winTintMat.userData.glass = true;
  const rubberMat = std(0x22252a, { roughness: 0.85 });

  const makeWheel = (radius: number, width: number) => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.06, 12), hubMat);
    hub.rotation.z = Math.PI / 2;
    wg.add(hub);
    // raios escuros para evidenciar a rotacao fisica v = w * r
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, radius * 1.4, radius * 0.28), rubberMat);
    wg.add(spoke);
    return wg;
  };

  const addVehicleShadow = (parent: any, w: number, d: number) => {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      level(new THREE.MeshBasicMaterial({ map: circleShadowTex, transparent: true, opacity: 0.55, depthWrite: false }), 4)
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.04;
    sh.renderOrder = 2;
    parent.add(sh);
  };

  interface VehicleBuild {
    root: any;
    bodyTilt: any;
    wheels: any[];
    brakeMat: any;
    wheelRadius: number;
  }

  const makeCompactCar = (colorHex: number): VehicleBuild => {
    const root = new THREE.Group();
    const bodyTilt = new THREE.Group();
    root.add(bodyTilt);
    const rW = 0.72;
    const paint = std(colorHex, { roughness: 0.25, metalness: 0.35 });
    const brakeMat = new THREE.MeshStandardMaterial({
      color: col(0x5a1010),
      emissive: col(0x000000),
      emissiveIntensity: 0,
      roughness: 0.2
    });

    // Chassi inferior + arcos arredondados estilo maquete
    const base = box(bodyTilt, 3.3, 1.35, 6.2, paint, 0, rW * 0.6, 0);
    base.castShadow = true;
    const hood = box(bodyTilt, 3.0, 0.55, 2.0, paint, 0, rW * 0.6 + 1.2, 1.8);
    hood.rotation.x = 0.18;

    // Cabine arredondada + vidros
    const cab = box(bodyTilt, 2.75, 1.35, 3.4, winTintMat, 0, rW * 0.6 + 1.25, -0.35);
    cab.castShadow = true;
    const roofCap = new THREE.Mesh(new THREE.SphereGeometry(1.45, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), paint);
    roofCap.scale.set(0.96, 0.45, 1.18);
    roofCap.position.set(0, rW * 0.6 + 2.55, -0.35);
    roofCap.castShadow = true;
    bodyTilt.add(roofCap);

    // Parachoques
    box(bodyTilt, 3.35, 0.45, 0.35, rubberMat, 0, rW * 0.5, 3.12);
    box(bodyTilt, 3.35, 0.45, 0.35, rubberMat, 0, rW * 0.5, -3.12);

    // Farois dianteiros + lanternas de freio traseiras
    const hlMat = basic(0xfff5c0);
    [-1.05, 1.05].forEach((lx) => {
      box(bodyTilt, 0.65, 0.4, 0.2, hlMat, lx, rW * 0.6 + 0.72, 3.12);
      box(bodyTilt, 0.72, 0.42, 0.2, brakeMat, lx, rW * 0.6 + 0.72, -3.14);
    });

    const wheels: any[] = [];
    [[-1.68, 1.85], [1.68, 1.85], [-1.68, -1.85], [1.68, -1.85]].forEach(([wx, wz]) => {
      const wh = makeWheel(rW, 0.52);
      wh.position.set(wx, rW, wz);
      root.add(wh);
      wheels.push(wh);
    });

    addVehicleShadow(root, 6.2, 8.8);
    return { root, bodyTilt, wheels, brakeMat, wheelRadius: rW };
  };

  const makeBajaBuggy = (colorHex = 0xd32f2f): VehicleBuild => {
    const root = new THREE.Group();
    const bodyTilt = new THREE.Group();
    root.add(bodyTilt);
    const rW = 0.85;
    const paint = std(colorHex, { roughness: 0.28, metalness: 0.4 });
    const cageMat = std(0x1f242b, { roughness: 0.5, metalness: 0.6 });
    const brakeMat = new THREE.MeshStandardMaterial({
      color: col(0x5a1010),
      emissive: col(0x000000),
      emissiveIntensity: 0,
      roughness: 0.2
    });

    // Bico esportivo + laterais baixas
    const chassis = box(bodyTilt, 2.2, 0.9, 5.4, paint, 0, rW * 0.55, 0);
    chassis.castShadow = true;
    const nose = box(bodyTilt, 1.6, 0.65, 1.9, paint, 0, rW * 0.55 + 0.5, 2.0);
    nose.rotation.x = 0.22;
    // Gaiola tubular (Santantonio)
    [-0.85, 0.85].forEach((rx) => {
      box(bodyTilt, 0.22, 1.75, 0.22, cageMat, rx, rW * 0.55 + 0.8, -0.8);
      const bar = box(bodyTilt, 0.2, 0.2, 2.6, cageMat, rx, rW * 0.55 + 2.05, 0.2);
      bar.rotation.x = 0.38;
    });
    box(bodyTilt, 1.9, 0.22, 0.22, cageMat, 0, rW * 0.55 + 2.45, -0.8);
    // Capacete do piloto + asa traseira
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), basic(0xfacc15));
    helmet.position.set(0, rW * 0.55 + 1.55, 0.0);
    bodyTilt.add(helmet);
    box(bodyTilt, 2.8, 0.2, 1.0, paint, 0, rW * 0.55 + 1.95, -2.5);
    box(bodyTilt, 1.8, 0.35, 0.25, brakeMat, 0, rW * 0.55 + 1.0, -2.78);
    box(bodyTilt, 1.1, 0.3, 0.2, basic(0xfff5c0), 0, rW * 0.55 + 0.55, 2.95);

    const wheels: any[] = [];
    [[-1.75, 1.85], [1.75, 1.85], [-1.85, -1.75], [1.85, -1.75]].forEach(([wx, wz], idx) => {
      const wr = idx < 2 ? 0.72 : rW;
      const wh = makeWheel(wr, 0.72);
      wh.position.set(wx, wr, wz);
      root.add(wh);
      wheels.push(wh);
    });

    addVehicleShadow(root, 6.4, 8.6);
    return { root, bodyTilt, wheels, brakeMat, wheelRadius: rW };
  };

  const makeUtilityCart = (colorHex: number): VehicleBuild => {
    const root = new THREE.Group();
    const bodyTilt = new THREE.Group();
    root.add(bodyTilt);
    const rW = 0.65;
    const paint = std(colorHex, { roughness: 0.35 });
    const brakeMat = new THREE.MeshStandardMaterial({
      color: col(0x5a1010),
      emissive: col(0x000000),
      emissiveIntensity: 0
    });

    box(bodyTilt, 2.9, 1.1, 5.2, paint, 0, rW * 0.6, 0);
    box(bodyTilt, 2.5, 0.9, 1.8, std(0x28323e, { roughness: 0.8 }), 0, rW * 0.6 + 1.05, -1.4);
    // Cobertura leve sobre 4 pilares
    [[-1.1, -0.6], [1.1, -0.6], [-1.1, 1.4], [1.1, 1.4]].forEach(([px, pz]) =>
      box(bodyTilt, 0.18, 2.1, 0.18, mWhiteSoft, px, rW * 0.6 + 1.0, pz)
    );
    box(bodyTilt, 2.6, 0.25, 2.5, mWhite, 0, rW * 0.6 + 3.05, 0.4);
    box(bodyTilt, 0.65, 0.35, 0.2, basic(0xfef08a), -0.9, rW * 0.6 + 0.65, 2.62);
    box(bodyTilt, 0.65, 0.35, 0.2, basic(0xfef08a), 0.9, rW * 0.6 + 0.65, 2.62);
    [-0.9, 0.9].forEach((lx) => box(bodyTilt, 0.65, 0.35, 0.2, brakeMat, lx, rW * 0.6 + 0.65, -2.62));

    const wheels: any[] = [];
    [[-1.48, 1.6], [1.48, 1.6], [-1.48, -1.6], [1.48, -1.6]].forEach(([wx, wz]) => {
      const wh = makeWheel(rW, 0.48);
      wh.position.set(wx, rW, wz);
      root.add(wh);
      wheels.push(wh);
    });

    addVehicleShadow(root, 5.4, 7.6);
    return { root, bodyTilt, wheels, brakeMat, wheelRadius: rW };
  };

  const makeSplicePatrolCar = (): VehicleBuild => {
    const v = makeCompactCar(0xf8fafc);
    // Faixa Splice verde + giroflex e pod LPR no teto
    const greenBar = std(0x00a859, { roughness: 0.3, emissive: col(0x004d29), emissiveIntensity: 0.25 });
    box(v.bodyTilt, 3.36, 0.38, 6.24, greenBar, 0, 1.25, 0);
    box(v.bodyTilt, 1.4, 0.32, 0.55, basic(0x38bdf8), 0, 3.45, -0.3);
    box(v.bodyTilt, 0.6, 0.34, 0.6, basic(0x00e676), 0, 3.45, 0.2);
    return v;
  };

  const makeMiniExcavator = () => {
    const g = new THREE.Group();
    const yMat = std(0xf2a900, { roughness: 0.35, metalness: 0.15 });
    // Esteiras laterais
    [-1.4, 1.4].forEach((ex) => box(g, 0.9, 1.1, 4.6, rubberMat, ex, 0, 0));
    box(g, 3.0, 0.7, 3.4, yMat, 0, 1.0, -0.4);
    box(g, 2.2, 2.2, 2.3, winTintMat, 0, 1.7, -0.4);
    box(g, 2.35, 0.28, 2.45, yMat, 0, 3.85, -0.4);
    // Braco articulado + concha dianteira
    const boom = box(g, 0.55, 3.4, 0.65, yMat, 0.6, 1.6, 1.7);
    boom.rotation.x = 0.65;
    const stick = box(g, 0.45, 2.4, 0.5, yMat, 0.6, 2.2, 3.6);
    stick.rotation.x = -0.55;
    box(g, 1.2, 1.0, 1.1, rubberMat, 0.6, 0.7, 4.3);
    addVehicleShadow(g, 7, 9.5);
    return g;
  };

  // Veiculos estacionados nos locais exatos da foto
  const parkAt = (mesh: any, px: number, py: number, rot: number, y = 0.22) => {
    const [wx, wz] = P(px, py);
    mesh.position.set(wx, y, wz);
    mesh.rotation.y = rot;
    props.add(mesh);
  };
  parkAt(makeMiniExcavator(), 600, 770, -0.55);
  parkAt(makeCompactCar(0x1fa4c4).root, 670, 745, -0.42);
  parkAt(makeCompactCar(0xf2b729).root, 745, 765, -0.42);
  parkAt(makeCompactCar(0x1fa4c4).root, 1155, 620, -0.48);
  parkAt(makeCompactCar(0xd94b64).root, 1305, 325, -0.52);
  parkAt(makeCompactCar(0xd94b64).root, 1400, 690, -0.35);
  {
    const gateCar = makeCompactCar(0x1fa4c4).root;
    gateCar.position.set(96, 0.23, 142);
    gateCar.rotation.y = 0.15;
    props.add(gateCar);
  }
  parkAt(makeUtilityCart(0x1976d2).root, 545, 205, 2.3);

  /* ---------------- VEICULOS EM MOVIMENTO (IDM + FAIXAS) ---------------- */
  interface MovingVehicle extends VehicleBuild {
    s: number;
    speed: number;
    maxSpeed: number;
    braking: boolean;
    wx: number;
    wz: number;
  }

  const movingSpecs: { frac: number; speed: number; build: () => VehicleBuild }[] = [
    { frac: 0.04, speed: 24, build: () => makeBajaBuggy(0xd32f2f) },
    { frac: 0.21, speed: 19, build: () => makeCompactCar(0x1fa4c4) },
    { frac: 0.37, speed: 21, build: () => makeSplicePatrolCar() },
    { frac: 0.54, speed: 18, build: () => makeCompactCar(0xf2b729) },
    { frac: 0.71, speed: 20, build: () => makeCompactCar(0xd94b64) },
    { frac: 0.86, speed: 17, build: () => makeUtilityCart(0x0284c7) }
  ];

  const vehiclesPhysics: MovingVehicle[] = movingSpecs.map((sp) => {
    const vb = sp.build();
    campus.add(vb.root);
    return {
      ...vb,
      s: sp.frac * RING_LEN,
      speed: sp.speed,
      maxSpeed: sp.speed,
      braking: false,
      wx: 0,
      wz: 0
    };
  });

  /* ---------------- 25 PEDESTRES ARTICULADOS NAS PASSARELAS ---------------- */
  interface PedestrianAgent {
    mesh: any;
    legL: any;
    legR: any;
    armL: any;
    armR: any;
    curve: any;
    u: number;
    dir: number;
    speed: number;
    wx: number;
    wz: number;
  }

  const walkCurves = walkPaths.map(
    (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.15, z)), false, 'catmullrom', 0.1)
  );
  const shirtPalette = [0x0ea5e9, 0x00a859, 0xf43f5e, 0xf59e0b, 0xa855f7, 0xf8fafc, 0x14b8a6];
  const skinMat = std(0xf4c29f, { roughness: 0.7 });
  const pantsMat = std(0x1e293b, { roughness: 0.85 });
  const hairMat = std(0x2a1d17, { roughness: 0.9 });

  const pedestriansPhysics: PedestrianAgent[] = [];
  for (let i = 0; i < 25; i++) {
    const curve = walkCurves[i % walkCurves.length];
    const len = curve.getLength();
    const ped = new THREE.Group();
    const shirt = std(shirtPalette[i % shirtPalette.length], { roughness: 0.65 });

    const legL = new THREE.Group();
    legL.position.set(-0.28, 1.35, 0);
    box(legL, 0.36, 1.35, 0.38, pantsMat, 0, -1.35, 0);
    ped.add(legL);

    const legR = new THREE.Group();
    legR.position.set(0.28, 1.35, 0);
    box(legR, 0.36, 1.35, 0.38, pantsMat, 0, -1.35, 0);
    ped.add(legR);

    box(ped, 0.95, 1.35, 0.55, shirt, 0, 1.35, 0);
    // mochila nas costas
    box(ped, 0.7, 0.9, 0.3, std(0x334155, { roughness: 0.7 }), 0, 1.55, -0.4);

    const armL = new THREE.Group();
    armL.position.set(-0.62, 2.55, 0);
    box(armL, 0.28, 1.05, 0.28, shirt, 0, -1.05, 0);
    ped.add(armL);

    const armR = new THREE.Group();
    armR.position.set(0.62, 2.55, 0);
    box(armR, 0.28, 1.05, 0.28, shirt, 0, -1.05, 0);
    ped.add(armR);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), skinMat);
    head.position.set(0, 3.12, 0);
    head.castShadow = true;
    ped.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.set(0, 3.18, -0.02);
    ped.add(cap);

    const pSh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      level(new THREE.MeshBasicMaterial({ map: circleShadowTex, transparent: true, opacity: 0.45, depthWrite: false }), 2)
    );
    pSh.rotation.x = -Math.PI / 2;
    pSh.position.y = 0.04;
    pSh.renderOrder = 2;
    ped.add(pSh);

    ped.scale.setScalar(0.95);
    campus.add(ped);

    pedestriansPhysics.push({
      mesh: ped,
      legL,
      legR,
      armL,
      armR,
      curve,
      u: (i * 0.17) % 1,
      dir: i % 2 === 0 ? 1 : -1,
      speed: (3.2 + (i % 4) * 0.7) / Math.max(10, len),
      wx: 0,
      wz: 0
    });
  }

  /* ---------------- POSTES SPLICE & DISCOS DE HEATMAP ACUSTICO ---------------- */
  const heatDiscs: Record<string, any> = {};
  const pulseRings: Record<string, any> = {};
  const fovCones: any[] = [];
  const poleMastMat = std(0x1e293b, { metalness: 0.65, roughness: 0.3 });

  const attachSensorVisuals = (node: SensorNode, radius = 32) => {
    const px = node.sx ?? node.x;
    const pz = node.sz ?? node.z;

    // Disco radial suave de calor acustico no solo
    const og = new THREE.Group();
    og.position.set(px, 0.25, pz);

    const discMat = level(
      new THREE.MeshBasicMaterial({
        map: heatTex,
        color: col(0x00a859),
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      }),
      4
    );
    const discMesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.1, radius * 2.1), discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.renderOrder = 4;
    og.add(discMesh);
    heatDiscs[node.id] = discMesh;

    const ringMat = level(
      new THREE.MeshBasicMaterial({
        color: col(0x00a859),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
      }),
      5
    );
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(radius * 0.72, radius * 0.77, 44), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.04;
    ringMesh.renderOrder = 5;
    og.add(ringMesh);
    pulseRings[node.id] = ringMesh;
    campus.add(og);

    // Poste inteligente Splice com LPR + Cone laser optico apontando para o viario
    const pole = new THREE.Group();
    pole.position.set(px, 0, pz);
    pole.rotation.y = Math.atan2(-px, -pz);

    const mast = cyl(pole, 0.35, 0.55, 14, poleMastMat, 0, 0, 0, 10);
    mast.userData.nodeId = node.id;
    pickables.push(mast);

    const arm = box(pole, 0.38, 0.38, 4.2, poleMastMat, 0, 13.4, 1.8, { nodeId: node.id });
    arm.castShadow = true;

    const ledMat = new THREE.MeshStandardMaterial({
      color: col(0x00a859),
      emissive: col(0x00a859),
      emissiveIntensity: 0.55,
      roughness: 0.25
    });
    box(pole, 1.1, 0.9, 1.5, ledMat, 0, 12.9, 3.9, { nodeId: node.id });

    const fovMat = new THREE.MeshBasicMaterial({
      color: col(0x00a859),
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6.5, 16, 16, 1, true), fovMat);
    cone.position.set(0, 6.2, 7.6);
    cone.rotation.x = -Math.PI / 4;
    cone.renderOrder = 6;
    pole.add(cone);
    fovCones.push(fovMat);

    contactShadowAt(pole, 0, 0, 2.4, 0.4);
    campus.add(pole);
  };

  INITIAL_NODES.forEach((n) => attachSensorVisuals(n, n.id === 'blocos-centrais' ? 38 : 30));

  /* ---------------- TESTE DE OCLUSAO ACUSTICA (OBB vs SEGMENTO) ---------------- */
  const segmentHitsObb = (ax: number, az: number, bx: number, bz: number, o: Occluder) => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    const adx = ax - o.x, adz = az - o.z;
    const bdx = bx - o.x, bdz = bz - o.z;
    const lx0 = adx * c - adz * s, lz0 = adx * s + adz * c;
    const lx1 = bdx * c - bdz * s, lz1 = bdx * s + bdz * c;
    const hw = o.w * 0.5, hd = o.d * 0.5;
    let t0 = 0, t1 = 1;
    const dx = lx1 - lx0, dz = lz1 - lz0;
    const clip = (p: number, q: number) => {
      if (Math.abs(p) < 1e-6) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    return (
      clip(-dx, lx0 + hw) &&
      clip(dx, hw - lx0) &&
      clip(-dz, lz0 + hd) &&
      clip(dz, hd - lz0)
    );
  };

  /* ---------------- ALTERNANCIA DE SHADER (PBR / CCO / XRAY) ---------------- */
  let appliedStyle: string = '';
  const applyRenderStyle = (style: 'MAQUETE_PBR' | 'CCO_CYBER' | 'BIM_XRAY') => {
    if (appliedStyle === style) return;
    appliedStyle = style;

    const isCyber = style === 'CCO_CYBER';
    const isXray = style === 'BIM_XRAY';

    const bgHex = isCyber ? 0x030711 : isXray ? 0x050814 : 0x060b14;
    scene.background.copy(col(bgHex));
    if (scene.fog) scene.fog.color.copy(col(bgHex));

    hemi.intensity = isCyber ? 0.35 : isXray ? 0.65 : 0.75;
    hemi.color.copy(col(isCyber ? 0x38bdf8 : 0xdff1ff));
    sunLight.intensity = isCyber ? 0.48 : isXray ? 0.85 : 1.55;
    sunLight.color.copy(col(isCyber ? 0x7dd3fc : 0xfff6e0));

    groundMats.forEach((gm) => gm.mat.color.copy(col(isCyber || isXray ? gm.night : gm.day)));
    lotMats.forEach((lm) => lm.color.copy(col(isCyber ? 0x8fa3bf : 0xffffff)));
    underGrid.visible = true;
    fovCones.forEach((fm) => { fm.opacity = isCyber ? 0.22 : 0.08; });

    const updateTreeWire = (rootObj: any) => {
      rootObj.traverse((obj: any) => {
        if (!obj.isMesh || !obj.material || obj.renderOrder === 2) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: any) => {
          if (!m) return;
          m.wireframe = isXray;
          if (m.userData?.glass && m.emissive) {
            m.emissive.copy(col(isCyber ? 0x0ea5e9 : 0x0a3c6e));
            m.emissiveIntensity = isCyber ? 0.7 : 0.12;
          }
        });
      });
    };
    updateTreeWire(buildings);
    updateTreeWire(fbxGroup);
  };

  /* ---------------- STEP DA SIMULACAO (CHAMADO A 60 FPS) ---------------- */
  const step = (now: number, dt: number, state: SceneState, camera: any, container: HTMLElement) => {
    const tSec = now * 0.001;
    const dtSim = dt * state.simSpeed;

    treesGroup.visible = !state.pruneTrees;
    buildings.visible = state.showProcedural;
    fbxGroup.visible = state.showFbx;
    applyRenderStyle(state.renderStyle);

    // 1. Agua do lago & patos com ondas concentricas
    waterUniforms.uTime.value = tSec;
    ducks.forEach((dk, idx) => {
      const ang = tSec * 0.45 + dk.ph;
      const dx = Math.sin(ang) * 4.5;
      const dz = Math.cos(ang * 0.85) * 2.4;
      const vx = Math.cos(ang) * 4.5 * 0.45;
      const vz = -Math.sin(ang * 0.85) * 2.4 * 0.85 * 0.45;
      const x = dk.base[0] + dx;
      const z = dk.base[1] + dz;
      dk.g.position.set(x, 0.05 + Math.sin(tSec * 3.2 + idx) * 0.08, z);
      dk.g.rotation.y = Math.atan2(vx, vz);
      dk.rings.forEach((rg, ri) => {
        const phase = (tSec * 0.45 + idx * 0.31 + ri / dk.rings.length) % 1;
        const sc = 1.2 + phase * 4.2;
        rg.position.set(x, 0.2, z);
        rg.scale.set(sc, sc, 1);
        rg.material.opacity = (1 - phase) * 0.42;
      });
    });

    // 2. Helice AeroDesign + 5 bandeiras senoidais + drone quadricoptero
    props.traverse((o: any) => {
      if (o.userData?.spin) o.rotation.x += dt * 18;
    });
    flags.forEach((f) => {
      const pos = f.geo.attributes.position;
      const arr = pos.array as Float32Array;
      const base = f.base;
      for (let k = 0; k < pos.count; k++) {
        const ix = k * 3;
        const bx = base[ix];
        const by = base[ix + 1];
        const frac = (bx + 4) / 8;
        arr[ix + 2] = base[ix + 2] + Math.sin(bx * 0.85 - tSec * 6.5 + f.i * 1.1 + by * 0.25) * 1.05 * frac;
        arr[ix + 1] = by + Math.cos(bx * 0.7 - tSec * 5.0 + f.i) * 0.16 * frac;
      }
      pos.needsUpdate = true;
    });
    {
      const dx = -115 + Math.sin(tSec * 0.75) * 5.5;
      const dz = 86 + Math.cos(tSec * 0.55) * 4.0;
      drone.position.set(dx, 26 + Math.sin(tSec * 2.2) * 1.8, dz);
      drone.rotation.z = Math.sin(tSec * 1.1) * 0.05;
      drone.rotation.x = Math.cos(tSec * 0.8) * 0.04;
      droneShadow.position.set(dx, 0.12, dz);
      droneRotors.forEach((r) => { r.rotation.y += dt * 32; });
    }

    // 3. Pedestres articulados caminhando pelas 7 passarelas
    pedestriansPhysics.forEach((p, idx) => {
      if (dtSim > 0) {
        p.u += p.dir * p.speed * dtSim;
        if (p.u >= 1) { p.u = 1; p.dir = -1; }
        else if (p.u <= 0) { p.u = 0; p.dir = 1; }
      }
      const su = clamp(p.u, 0, 0.99999);
      const pos = p.curve.getPointAt(su);
      const tan = p.curve.getTangentAt(su);
      p.wx = pos.x;
      p.wz = pos.z;
      p.mesh.position.set(pos.x, pos.y, pos.z);
      p.mesh.rotation.y = Math.atan2(tan.x * p.dir, tan.z * p.dir);
      const gait = dtSim > 0 ? Math.sin(tSec * state.simSpeed * 6.5 + idx * 1.3) * 0.55 : 0;
      p.legL.rotation.x = gait;
      p.legR.rotation.x = -gait;
      p.armL.rotation.x = -gait * 0.7;
      p.armR.rotation.x = gait * 0.7;
    });

    // 4. Fisica veicular IDM + parada nas 4 faixas + rotacao v = w * r + roll centripeto + luz de freio
    vehiclesPhysics.forEach((v, idx) => {
      let targetSpeed = v.maxSpeed;
      if (dtSim > 0) {
        const ahead = vehiclesPhysics[(idx + 1) % vehiclesPhysics.length];
        const gapS = (((ahead.s - v.s) % RING_LEN) + RING_LEN) % RING_LEN;
        if (gapS < 26) {
          targetSpeed = Math.min(targetSpeed, v.maxSpeed * clamp((gapS - 12) / 14, 0, 1));
        }
        // Verifica pedestres nas 4 faixas vermelhas
        for (const cr of crossingDefs) {
          const dCross = (((cr.s - v.s) % RING_LEN) + RING_LEN) % RING_LEN;
          if (dCross > 3.5 && dCross < 26) {
            const pedNear = pedestriansPhysics.some(
              (p) => Math.hypot(p.wx - cr.x, p.wz - cr.z) < 10.5
            );
            if (pedNear) {
              targetSpeed = Math.min(targetSpeed, dCross < 11 ? 0 : v.maxSpeed * ((dCross - 11) / 15));
            }
          }
        }
        const accel = targetSpeed < v.speed ? 34 : 18;
        v.speed += clamp(targetSpeed - v.speed, -accel * dtSim, accel * dtSim);
        v.braking = targetSpeed < v.maxSpeed * 0.65 || v.speed < v.maxSpeed * 0.45;

        const ds = v.speed * dtSim;
        v.s = (((v.s + ds) % RING_LEN) + RING_LEN) % RING_LEN;
        const dOmega = ds / v.wheelRadius;
        v.wheels.forEach((wh) => { wh.rotation.x += dOmega; });
      }

      const u = clamp(v.s / RING_LEN, 0, 0.99999);
      const uNext = clamp((v.s + 6) / RING_LEN, 0, 0.99999);
      const pos = ringCurve.getPointAt(u);
      const tan = ringCurve.getTangentAt(u);
      const tan2 = ringCurve.getTangentAt(uNext);
      const curv = tan.x * tan2.z - tan.z * tan2.x;

      // Faixa da direita (mao brasileira): (-tan.z, +tan.x)
      const laneOff = 3.3;
      const vx = pos.x - tan.z * laneOff;
      const vz = pos.z + tan.x * laneOff;
      v.wx = vx;
      v.wz = vz;
      v.root.position.set(vx, 0.22, vz);
      v.root.rotation.y = Math.atan2(tan.x, tan.z);
      v.bodyTilt.rotation.z = clamp(-curv * v.speed * 0.012, -0.13, 0.13);

      v.brakeMat.color.copy(col(v.braking ? 0xff1f1f : 0x5a1010));
      v.brakeMat.emissive.copy(col(v.braking ? 0xff0000 : 0x000000));
      v.brakeMat.emissiveIntensity = v.braking ? 1.6 : 0;
    });

    // 5. Propagacao acustica fisica (1/r^2 + difracao por oclusao OBB) + heatmaps + projecao de pins
    const pulseScale = 0.86 + ((tSec * 0.65) % 1) * 0.5;
    const liveAcoustic: Record<string, number> = {};
    const pins: { id: string; x: number; y: number; visible: boolean }[] = [];
    const hasContainer = container && container.clientWidth > 0 && container.clientHeight > 0;

    state.nodes.forEach((n) => {
      const sx = n.sx ?? n.x;
      const sz = n.sz ?? n.z;
      let energy = Math.pow(10, n.baseDb / 10);

      for (const v of vehiclesPhysics) {
        const dist = Math.max(8, Math.hypot(v.wx - sx, v.wz - sz));
        const lw = 76 + (v.speed / v.maxSpeed) * 7 + (v.braking ? 3.5 : 0);
        let blockers = 0;
        for (const o of occluders) {
          if (o.h >= 8 && segmentHitsObb(sx, sz, v.wx, v.wz, o)) blockers++;
        }
        const occLoss = Math.min(12, blockers * 5.5);
        const spl = lw - 20 * Math.log10(dist / 8) - occLoss;
        if (spl > 38) energy += Math.pow(10, spl / 10);
      }

      for (const p of pedestriansPhysics) {
        const dp = Math.hypot(p.wx - n.x, p.wz - n.z);
        if (dp < 42) {
          const pspl = 58 - 20 * Math.log10(Math.max(5, dp) / 5);
          if (pspl > 36) energy += Math.pow(10, pspl / 10);
        }
      }

      liveAcoustic[n.id] = 10 * Math.log10(energy);

      const disc = heatDiscs[n.id];
      const ring = pulseRings[n.id];
      const isAlert = n.noiseDb > n.noiseThreshold;
      const isSel = n.id === state.selectedNodeId;
      if (disc && ring) {
        disc.visible = state.highlightAcoustics;
        ring.visible = state.highlightAcoustics;
        const cHex = isAlert ? 0xf43f5e : isSel ? 0x00a859 : 0x38bdf8;
        disc.material.color.copy(col(cHex));
        disc.material.opacity = isSel ? 0.92 : isAlert ? 0.85 : 0.5;
        ring.material.color.copy(col(cHex));
        ring.scale.set(pulseScale, pulseScale, 1);
      }

      if (hasContainer) {
        const wp = new THREE.Vector3(n.x, n.h + 10, n.z);
        wp.project(camera);
        pins.push({
          id: n.id,
          x: (wp.x * 0.5 + 0.5) * container.clientWidth,
          y: (-(wp.y * 0.5) + 0.5) * container.clientHeight,
          visible: wp.z < 1
        });
      }
    });

    return { pins, liveAcoustic };
  };

  return {
    scene,
    groundPick,
    pickables,
    buildings,
    fbxGroup,
    attachSensorVisuals,
    step
  };
}

/* =====================================================================
 *  COMPONENTE REACT PRINCIPAL (VIEWPORT WEBGL + UI RETRATIL / CINEMA)
 * ===================================================================== */
export default function FacensHighEndDigitalShadow() {
  const [threeLoaded, setThreeLoaded] = useState<boolean>(false);
  const [fbxStatus, setFbxStatus] = useState<string>('Maquete 1:1 PBR + IDM');
  const [showProceduralBuildings, setShowProceduralBuildings] = useState<boolean>(true);
  const [hasImportedFbx, setHasImportedFbx] = useState<boolean>(false);
  const [showImportedFbx, setShowImportedFbx] = useState<boolean>(true);

  const [cinemaMode, setCinemaMode] = useState<boolean>(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState<boolean>(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(true);

  const [simSpeed, setSimSpeed] = useState<0 | 1 | 3 | 5>(1);
  const [simSeconds, setSimSeconds] = useState<number>(10 * 3600 + 30 * 60);
  const [nodes, setNodes] = useState<SensorNode[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('blocos-centrais');
  const [placingSensorMode, setPlacingSensorMode] = useState<boolean>(false);
  const [droneCameraMode, setDroneCameraMode] = useState<boolean>(false);

  const [renderStyle, setRenderStyle] = useState<'MAQUETE_PBR' | 'CCO_CYBER' | 'BIM_XRAY'>('MAQUETE_PBR');
  const [labelMode, setLabelMode] = useState<'SMART' | 'ALL' | 'NONE'>('SMART');
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);

  const [pruneTrees, setPruneTrees] = useState<boolean>(false);
  const [highlightAcoustics, setHighlightAcoustics] = useState<boolean>(true);

  const [screenPins, setScreenPins] = useState<
    { id: string; x: number; y: number; visible: boolean }[]
  >([]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const fbxInputRef = useRef<HTMLInputElement | null>(null);
  const fbxGroupRef = useRef<any>(null);
  const pickablesRef = useRef<any[]>([]);
  const campusCtrlRef = useRef<any>(null);
  const liveAcousticLevelsRef = useRef<Record<string, number>>({});

  const sceneStateRef = useRef<SceneState>({
    simSpeed: 1,
    selectedNodeId: 'blocos-centrais',
    pruneTrees: false,
    highlightAcoustics: true,
    renderStyle: 'MAQUETE_PBR',
    showProcedural: true,
    showFbx: true,
    nodes: INITIAL_NODES
  });
  sceneStateRef.current = {
    simSpeed,
    selectedNodeId,
    pruneTrees,
    highlightAcoustics,
    renderStyle,
    showProcedural: showProceduralBuildings,
    showFbx: showImportedFbx,
    nodes
  };

  const placingModeRef = useRef<boolean>(placingSensorMode);
  placingModeRef.current = placingSensorMode;

  const droneCamRef = useRef<boolean>(droneCameraMode);
  droneCamRef.current = droneCameraMode;

  const camTargetStateRef = useRef({ ...CAM_HOME });
  const camCurrentStateRef = useRef({ ...CAM_HOME });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // Carrega Three.js + fflate + FBXLoader via CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadFbxDeps = () => {
      if (window.THREE && window.THREE.FBXLoader) return;
      const fflateScript = document.createElement('script');
      fflateScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/fflate.min.js';
      fflateScript.async = true;
      fflateScript.onload = () => {
        const fbxScript = document.createElement('script');
        fbxScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js';
        fbxScript.async = true;
        document.head.appendChild(fbxScript);
      };
      document.head.appendChild(fflateScript);
    };

    if (window.THREE) {
      setThreeLoaded(true);
      loadFbxDeps();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => {
      setThreeLoaded(true);
      loadFbxDeps();
    };
    document.head.appendChild(script);
  }, []);

  // Telemetria sincronizada com a fisica acustica 3D
  useEffect(() => {
    if (simSpeed === 0) return;
    const interval = setInterval(() => {
      setSimSeconds((prev) => (prev + simSpeed * 5) % 86400);
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const physicalDb = liveAcousticLevelsRef.current[node.id] ?? node.noiseDb;
          const nextDb = Math.max(48, Math.min(86, Math.round(physicalDb)));
          const nextPeak = Math.max(node.peakDb, nextDb);
          const nextHistory = [...node.historyDb.slice(1), nextDb];
          return {
            ...node,
            noiseDb: nextDb,
            peakDb: nextPeak,
            historyDb: nextHistory,
            vehiclesCount: node.vehiclesCount + (Math.random() > 0.62 ? 1 : 0),
            pedestriansCount: node.pedestriansCount + (Math.random() > 0.68 ? 1 : 0)
          };
        })
      );
    }, 900);
    return () => clearInterval(interval);
  }, [simSpeed]);

  const formatClock = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const focusCameraOnNode = (node: SensorNode) => {
    setDroneCameraMode(false);
    setSelectedNodeId(node.id);
    camTargetStateRef.current.targetX = node.x * 0.72;
    camTargetStateRef.current.targetZ = node.z * 0.72;
    camTargetStateRef.current.radius = 235;
    camTargetStateRef.current.phi = 0.76;
  };

  const handleFbxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !window.THREE || !window.THREE.FBXLoader || !fbxGroupRef.current) return;

    setFbxStatus(`Importando ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result;
        if (!buffer) return;
        const THREE = window.THREE;
        const loader = new THREE.FBXLoader();
        const object = loader.parse(buffer, '');

        while (fbxGroupRef.current.children.length > 0) {
          fbxGroupRef.current.remove(fbxGroupRef.current.children[0]);
        }

        const b = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        b.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        object.scale.setScalar(340 / maxDim);

        const scaledBox = new THREE.Box3().setFromObject(object);
        const center = new THREE.Vector3();
        scaledBox.getCenter(center);

        object.position.x -= center.x;
        object.position.z -= center.z;
        object.position.y -= scaledBox.min.y;

        object.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({
              color: 0xf8fafc,
              roughness: 0.35,
              metalness: 0.25,
              wireframe: sceneStateRef.current.renderStyle === 'BIM_XRAY'
            });
            pickablesRef.current.push(child);
          }
        });

        fbxGroupRef.current.add(object);
        setHasImportedFbx(true);
        setShowImportedFbx(true);
        setShowProceduralBuildings(false);
        setFbxStatus(`Malha Oficial Ativa (${file.name})`);
      } catch (err) {
        console.error('Erro ao ler FBX:', err);
        setFbxStatus('Erro ao processar FBX');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Inicializa renderer + createCampus + loop 60 FPS
  useEffect(() => {
    if (!threeLoaded || !mountRef.current) return;
    const THREE = window.THREE;
    const container = mountRef.current;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      1,
      2400
    );

    const campusCtrl = createCampus(THREE, renderer);
    campusCtrlRef.current = campusCtrl;
    fbxGroupRef.current = campusCtrl.fbxGroup;
    pickablesRef.current = campusCtrl.pickables;

    // Controles Orbit + Pan + Zoom + Raycasting 3D
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isPointerDown = false;
    let pointerButton = 0;
    let startX = 0;
    let startY = 0;
    let movedDistance = 0;

    const onPointerDown = (e: MouseEvent) => {
      isPointerDown = true;
      pointerButton = e.button;
      startX = e.clientX;
      startY = e.clientY;
      movedDistance = 0;
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movedDistance += Math.hypot(dx, dy);
      startX = e.clientX;
      startY = e.clientY;

      if (pointerButton === 2 || e.shiftKey) {
        camTargetStateRef.current.targetX -= dx * 0.32;
        camTargetStateRef.current.targetZ -= dy * 0.32;
      } else {
        camTargetStateRef.current.theta -= dx * 0.0062;
        camTargetStateRef.current.phi = clamp(camTargetStateRef.current.phi - dy * 0.0052, 0.3, 1.38);
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      isPointerDown = false;
      if (movedDistance >= 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (placingModeRef.current) {
        const hits = raycaster.intersectObject(campusCtrl.groundPick);
        if (hits.length > 0) {
          const pt = hits[0].point;
          const idxNum = sceneStateRef.current.nodes.length + 1;
          const newId = `post-${Date.now()}`;
          const newNode: SensorNode = {
            id: newId,
            code: `POSTE-${idxNum < 10 ? '0' : ''}${idxNum}`,
            name: `Spot Acústico & LPR #${idxNum}`,
            nodeType: 'POSTE_SPLICE',
            sector: 'Novo Ponto Instalado na Malha 3D',
            x: Math.round(pt.x),
            z: Math.round(pt.z),
            h: 16,
            baseDb: 58,
            noiseDb: 63,
            peakDb: 70,
            noiseThreshold: 68,
            vehiclesCount: 54,
            pedestriansCount: 41,
            speedAvgKmh: 26,
            historyDb: [56, 58, 61, 63, 66, 68, 65, 63, 62, 63],
            sensorsInstalled: ['Sonômetro Acústico (dB)', 'Câmera LPR 5G'],
            aiPatternNote: 'Sensor posicionado em tempo real captando física acústica com oclusão do entorno.'
          };
          campusCtrl.attachSensorVisuals(newNode, 28);
          setNodes((prev) => [...prev, newNode]);
          setSelectedNodeId(newId);
          setPlacingSensorMode(false);
        }
        return;
      }

      const intersects = raycaster.intersectObjects(campusCtrl.pickables, false);
      if (intersects.length > 0) {
        const hitNodeId = intersects[0].object.userData.nodeId;
        if (hitNodeId) setSelectedNodeId(hitNodeId);
      }
    };

    const onWheel = (e: WheelEvent) => {
      camTargetStateRef.current.radius = clamp(camTargetStateRef.current.radius + e.deltaY * 0.16, 125, 620);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('wheel', onWheel);
    domElem.addEventListener('contextmenu', onContextMenu);

    let animFrameId: number;
    let lastClock = performance.now();
    let lastPinUpdate = 0;

    const animate = (now: number) => {
      try {
        const dt = Math.min(0.1, Math.max(0, (now - lastClock) / 1000));
        lastClock = now;

        if (droneCamRef.current) {
          camTargetStateRef.current.theta = now * 0.00028;
          camTargetStateRef.current.phi = 0.82;
          camTargetStateRef.current.radius = 390;
          camTargetStateRef.current.targetX = 0;
          camTargetStateRef.current.targetZ = -6;
        }

        const cur = camCurrentStateRef.current;
        const tgt = camTargetStateRef.current;
        const damp = Math.min(1, dt * 8.5);
        cur.theta += (tgt.theta - cur.theta) * damp;
        cur.phi += (tgt.phi - cur.phi) * damp;
        cur.radius += (tgt.radius - cur.radius) * damp;
        cur.targetX += (tgt.targetX - cur.targetX) * damp;
        cur.targetZ += (tgt.targetZ - cur.targetZ) * damp;

        camera.position.x = cur.targetX + cur.radius * Math.sin(cur.phi) * Math.sin(cur.theta);
        camera.position.y = cur.radius * Math.cos(cur.phi);
        camera.position.z = cur.targetZ + cur.radius * Math.sin(cur.phi) * Math.cos(cur.theta);
        camera.lookAt(cur.targetX, 6, cur.targetZ);

        const res = campusCtrl.step(now, dt, sceneStateRef.current, camera, container);
        liveAcousticLevelsRef.current = res.liveAcoustic;
        if (now - lastPinUpdate >= 20 || lastPinUpdate === 0) {
          lastPinUpdate = now;
          setScreenPins(res.pins);
        }

        renderer.render(campusCtrl.scene, camera);
      } catch (renderErr) {
        console.error('Three.js render error:', renderErr);
      }
      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElem.removeEventListener('mousedown', onPointerDown);
      domElem.removeEventListener('wheel', onWheel);
      domElem.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
    };
  }, [threeLoaded]);

  const showLeft = !cinemaMode && leftDrawerOpen;
  const showRight = !cinemaMode && rightDrawerOpen;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060b14] select-none">
      {/* VIEWPORT WEBGL THREE.JS EM TELA CHEIA */}
      <div
        ref={mountRef}
        className={`w-full h-full ${
          placingSensorMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* PINS DE CALLOUT 3D FLUTUANTES COM HASTE LASER VERTICAL */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {screenPins.map((pin) => {
          if (!pin.visible || labelMode === 'NONE') return null;
          const node = nodes.find((n) => n.id === pin.id);
          if (!node) return null;

          const isSelected = node.id === selectedNodeId;
          const isPeak = node.noiseDb > node.noiseThreshold;
          const showCompactOnly = labelMode === 'SMART' && !isSelected && !isPeak;

          return (
            <div
              key={pin.id}
              style={{
                transform: `translate3d(${pin.x}px, ${pin.y}px, 0)`
              }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group"
            >
              <button
                type="button"
                onClick={() => focusCameraOnNode(node)}
                className={`transition-all shadow-xl backdrop-blur-md rounded-lg border px-2.5 py-1 text-left ${
                  isSelected
                    ? 'bg-[#041e16]/95 border-[#00A859] ring-2 ring-[#00A859]/40 scale-105'
                    : isPeak
                    ? 'bg-rose-950/90 border-rose-500/80'
                    : 'bg-[#0b1322]/85 border-sky-500/40 hover:border-sky-400'
                }`}
              >
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPeak ? 'bg-rose-500 animate-ping' : 'bg-[#00A859]'
                    }`}
                  />
                  <span className="text-[10px] font-mono font-bold text-white">
                    {node.code}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                      isPeak ? 'bg-rose-500/30 text-rose-200' : 'bg-[#00A859]/25 text-emerald-300'
                    }`}
                  >
                    {node.noiseDb} dB
                  </span>
                </div>

                {!showCompactOnly && (
                  <div className="mt-1 pt-1 border-t border-white/10 text-[9px] text-slate-300 font-mono flex items-center justify-between gap-3">
                    <span>LPR: {node.vehiclesCount}</span>
                    <span>Pessoas: {node.pedestriansCount}</span>
                  </div>
                )}
              </button>

              <div
                className={`w-[1.5px] h-4 ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#00A859] to-transparent'
                    : isPeak
                    ? 'bg-gradient-to-b from-rose-500 to-transparent'
                    : 'bg-gradient-to-b from-sky-400/70 to-transparent'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* BARRA SUPERIOR SLIM + BOTAO MODO CINEMA (TELA CHEIA) */}
      <div className="pointer-events-none absolute top-2.5 left-0 right-0 flex justify-center z-20 px-4">
        <div className="pointer-events-auto bg-[#0b1322]/90 backdrop-blur-md border border-[#00A859]/50 px-3.5 py-1.5 rounded-2xl shadow-2xl flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00A859] animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#00A859] font-bold">
              FACENS 3D • DIGITAL SHADOW SPLICE
            </span>
          </div>

          <span className="text-slate-600 hidden md:inline">|</span>

          <button
            type="button"
            onClick={() => setCinemaMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition ${
              cinemaMode
                ? 'bg-[#00A859] text-slate-950 border-emerald-300'
                : 'bg-[#132038] text-emerald-300 border-[#00A859]/40 hover:bg-[#1b2e50]'
            }`}
          >
            {cinemaMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {cinemaMode ? 'Mostrar Painéis' : 'Modo Cinema (Tela Cheia)'}
          </button>

          <button
            type="button"
            onClick={() => setDroneCameraMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition ${
              droneCameraMode
                ? 'bg-[#00A859] text-slate-950 border-emerald-300'
                : 'bg-[#132038] text-sky-300 border-sky-500/40 hover:bg-[#1b2e50]'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            {droneCameraMode ? 'Voo Drone: ON' : 'Voo Drone 360°'}
          </button>

          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="px-2.5 py-1 rounded-lg bg-[#004B8D] hover:bg-[#0059A8] text-white text-[11px] font-semibold flex items-center gap-1.5 border border-sky-400/40 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#00A859]" />
            Plano & Arquitetura
          </button>
        </div>
      </div>

      {/* BOTAO DE REABRIR PAINEL ESQUERDO */}
      {!cinemaMode && !leftDrawerOpen && (
        <button
          type="button"
          onClick={() => setLeftDrawerOpen(true)}
          className="absolute top-16 left-3 z-20 bg-[#0b1322]/90 border border-[#1d3154] hover:border-[#00A859] text-white p-2.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs"
        >
          <ChevronRight className="w-4 h-4 text-[#00A859]" />
          <span>Controles 3D</span>
        </button>
      )}

      {/* PAINEL ESQUERDO COMPACTO E RETRATIL */}
      {showLeft && (
        <aside className="absolute top-14 left-3 w-68 max-w-[272px] bg-[#0b1322]/88 backdrop-blur-md border border-[#1d3154] rounded-2xl p-3.5 flex flex-col gap-2.5 z-20 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#004B8D] to-[#00A859] flex items-center justify-center shrink-0">
                <Box className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xs font-bold text-white leading-tight">
                  Engine Facens 3D
                </h1>
                <p className="text-[10px] text-sky-300 truncate max-w-[140px]">
                  {fbxStatus}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLeftDrawerOpen(false)}
              title="Recolher painel esquerdo"
              className="p-1 rounded-lg bg-[#132038] text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* IMPORTADOR NATIVO DO ARQUIVO PREDIOS_MESH.FBX */}
          <div className="bg-[#0f1a2e]/90 border border-[#1f345a] rounded-xl p-2 space-y-1.5">
            <button
              type="button"
              onClick={() => fbxInputRef.current?.click()}
              className="w-full py-1.5 px-2.5 rounded-lg bg-[#004B8D] hover:bg-[#0059A8] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 border border-sky-400/40 transition"
            >
              <Upload className="w-3.5 h-3.5 text-[#00A859]" />
              Importar Predios_Mesh.fbx
            </button>
            <input
              ref={fbxInputRef}
              type="file"
              accept=".fbx"
              onChange={handleFbxUpload}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setShowProceduralBuildings((p) => !p)}
                className={`py-1 px-1.5 rounded border font-medium transition ${
                  showProceduralBuildings
                    ? 'bg-[#00A859]/20 border-[#00A859] text-emerald-200'
                    : 'bg-[#09101d] border-[#1b2c4b] text-slate-400'
                }`}
              >
                Maquete: {showProceduralBuildings ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                disabled={!hasImportedFbx}
                onClick={() => setShowImportedFbx((p) => !p)}
                className={`py-1 px-1.5 rounded border font-medium transition ${
                  !hasImportedFbx
                    ? 'bg-[#09101d] border-[#1b2c4b] text-slate-600 cursor-not-allowed'
                    : showImportedFbx
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-[#09101d] border-[#1b2c4b] text-slate-400'
                }`}
              >
                .FBX: {hasImportedFbx && showImportedFbx ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* SHADER / MODO DO MOTOR 3D */}
          <div className="bg-[#0f1a2e]/90 border border-[#1f345a] rounded-xl p-2 space-y-1">
            <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#00A859]" /> Shader / Iluminação
            </span>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setRenderStyle('MAQUETE_PBR')}
                className={`py-1 px-1 rounded font-semibold border transition ${
                  renderStyle === 'MAQUETE_PBR'
                    ? 'bg-[#00A859]/25 text-emerald-200 border-[#00A859]'
                    : 'bg-[#09101d] text-slate-400 border-[#1b2c4b]'
                }`}
              >
                PBR Dia
              </button>
              <button
                type="button"
                onClick={() => setRenderStyle('CCO_CYBER')}
                className={`py-1 px-1 rounded font-semibold border transition ${
                  renderStyle === 'CCO_CYBER'
                    ? 'bg-[#004B8D]/50 text-sky-200 border-sky-400'
                    : 'bg-[#09101d] text-slate-400 border-[#1b2c4b]'
                }`}
              >
                CCO Noite
              </button>
              <button
                type="button"
                onClick={() => setRenderStyle('BIM_XRAY')}
                className={`py-1 px-1 rounded font-semibold border transition ${
                  renderStyle === 'BIM_XRAY'
                    ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                    : 'bg-[#09101d] text-slate-400 border-[#1b2c4b]'
                }`}
              >
                Raio-X
              </button>
            </div>
          </div>

          {/* DENSIDADE DE PINS */}
          <div className="bg-[#0f1a2e]/90 border border-[#1f345a] rounded-xl p-2 space-y-1">
            <span className="text-[9px] font-mono uppercase text-slate-400 flex items-center gap-1">
              <Eye className="w-3 h-3 text-sky-400" /> Rótulos sobre Prédios
            </span>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setLabelMode('SMART')}
                className={`py-1 px-1 rounded font-semibold border transition ${
                  labelMode === 'SMART'
                    ? 'bg-[#00A859]/25 text-emerald-200 border-[#00A859]'
                    : 'bg-[#09101d] text-slate-400 border-[#1b2c4b]'
                }`}
              >
                Compacto
              </button>
              <button
                type="button"
                onClick={() => setLabelMode('ALL')}
                className={`py-1 px-1 rounded font-semibold border transition ${
                  labelMode === 'ALL'
                    ? 'bg-[#004B8D]/50 text-sky-200 border-sky-400'
                    : 'bg-[#09101d] text-slate-400 border-[#1b2c4b]'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setLabelMode('NONE')}
                className={`py-1 px-1 rounded font-semibold border transition ${
                  labelMode === 'NONE'
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400'
                    : 'bg-[#09101d] text-slate-400 border-[#1b2c4b]'
                }`}
              >
                Limpo
              </button>
            </div>
          </div>

          {/* FISICA DE TRAFEGO & SOM */}
          <div className="bg-[#0f1a2e]/90 border border-[#1f345a] rounded-xl p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="text-sky-300">FÍSICA IDM</span>
              <span>{formatClock(simSeconds)}</span>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { s: 0, label: '0x' },
                  { s: 1, label: '1x' },
                  { s: 3, label: '3x' },
                  { s: 5, label: '5x' }
                ] as const
              ).map((btn) => (
                <button
                  key={btn.s}
                  type="button"
                  onClick={() => setSimSpeed(btn.s)}
                  className={`py-1 rounded text-[11px] font-semibold border transition ${
                    simSpeed === btn.s
                      ? 'bg-[#004B8D] text-white border-sky-400'
                      : 'bg-[#09101d] text-slate-400 border-[#1b2c4b] hover:text-white'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* ADICIONAR SENSOR + RESETAR CAMERA */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlacingSensorMode((prev) => !prev)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow ${
                placingSensorMode
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {placingSensorMode ? 'Clique no Mapa...' : 'Instalar Sensor'}
            </button>

            <button
              type="button"
              onClick={() => {
                setDroneCameraMode(false);
                camTargetStateRef.current = { ...CAM_HOME };
              }}
              title="Visão Panorâmica Oficial Facens"
              className="p-2 rounded-xl bg-[#0f1a2e] hover:bg-[#162642] text-slate-300 border border-[#1f345a]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CAMADAS */}
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setHighlightAcoustics((p) => !p)}
              className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition ${
                highlightAcoustics
                  ? 'bg-[#00A859]/20 border-[#00A859] text-emerald-200'
                  : 'bg-[#09101d] border-[#1b2c4b] text-slate-400'
              }`}
            >
              <Volume2 className="w-3 h-3 shrink-0 text-[#00A859]" />
              <span className="truncate">Heatmap dB</span>
            </button>

            <button
              type="button"
              onClick={() => setPruneTrees((p) => !p)}
              className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition ${
                pruneTrees
                  ? 'bg-[#004B8D]/40 border-sky-400 text-sky-200'
                  : 'bg-[#09101d] border-[#1b2c4b] text-slate-300'
              }`}
            >
              <Trees className="w-3 h-3 shrink-0 text-sky-400" />
              <span className="truncate">{pruneTrees ? 'Sem Árvores' : 'Bosques 3D'}</span>
            </button>
          </div>
        </aside>
      )}

      {/* BOTAO DE REABRIR PAINEL DIREITO */}
      {!cinemaMode && !rightDrawerOpen && (
        <button
          type="button"
          onClick={() => setRightDrawerOpen(true)}
          className="absolute top-16 right-3 z-20 bg-[#0b1322]/90 border border-[#1d3154] hover:border-[#00A859] text-white p-2.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs"
        >
          <span>Telemetria Setor</span>
          <ChevronLeft className="w-4 h-4 text-[#00A859]" />
        </button>
      )}

      {/* PAINEL DIREITO COMPACTO E RETRATIL */}
      {showRight && selectedNode && (
        <aside className="absolute top-14 right-3 w-76 max-w-[308px] bg-[#0b1322]/90 backdrop-blur-md border border-[#00A859]/60 rounded-2xl p-3.5 space-y-2.5 z-20 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#004B8D]/50 text-sky-200 border border-sky-500/40">
                  {selectedNode.code}
                </span>
                {selectedNode.noiseDb > selectedNode.noiseThreshold && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 animate-pulse">
                    PICO dB
                  </span>
                )}
              </div>
              <h3 className="text-xs font-bold text-white mt-1 leading-snug">
                {selectedNode.name}
              </h3>
              <p className="text-[10px] text-slate-400">{selectedNode.sector}</p>
            </div>
            <button
              type="button"
              onClick={() => setRightDrawerOpen(false)}
              title="Recolher telemetria"
              className="p-1 rounded-lg bg-[#132038] text-slate-300 hover:text-white shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-[#0f1a2e] border border-[#1f345a] rounded-xl p-1.5">
              <span className="text-[9px] text-slate-400 block">Sonômetro</span>
              <span
                className={`text-xs font-bold font-mono ${
                  selectedNode.noiseDb > selectedNode.noiseThreshold
                    ? 'text-rose-400'
                    : 'text-[#00A859]'
                }`}
              >
                {selectedNode.noiseDb} dB
              </span>
              <span className="text-[8px] text-slate-500 block">
                Pico: {selectedNode.peakDb}dB
              </span>
            </div>

            <div className="bg-[#0f1a2e] border border-[#1f345a] rounded-xl p-1.5">
              <span className="text-[9px] text-slate-400 block">Fluxo LPR</span>
              <span className="text-xs font-bold text-sky-300 font-mono">
                {selectedNode.vehiclesCount}
              </span>
              <span className="text-[8px] text-slate-500 block">
                {selectedNode.speedAvgKmh} km/h
              </span>
            </div>

            <div className="bg-[#0f1a2e] border border-[#1f345a] rounded-xl p-1.5">
              <span className="text-[9px] text-slate-400 block">Pedestres</span>
              <span className="text-xs font-bold text-purple-300 font-mono">
                {selectedNode.pedestriansCount}
              </span>
              <span className="text-[8px] text-slate-500 block">No setor</span>
            </div>
          </div>

          <div className="bg-[#091322] border border-[#1f3a60] rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-sky-300 flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-[#00A859]" />
                SÉRIE ACÚSTICA (dB)
              </span>
              <span className="text-slate-400">
                Lim: {selectedNode.noiseThreshold}dB
              </span>
            </div>

            <div className="h-14 flex items-end gap-1 pt-1 px-0.5">
              {selectedNode.historyDb.map((val, i) => {
                const pct = Math.min(100, Math.max(15, ((val - 40) / 45) * 100));
                const isHigh = val > selectedNode.noiseThreshold;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full bg-[#132038] rounded-t h-10 flex items-end overflow-hidden">
                      <div
                        className={`w-full transition-all rounded-t ${
                          isHigh ? 'bg-rose-500' : 'bg-[#00A859]'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-slate-400">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#0f1a2e] border border-[#1f345a] text-[10px] text-slate-300 leading-relaxed">
            <strong className="text-[#00A859] block text-[9px] font-mono uppercase mb-0.5">
              Diagnóstico Físico (Nível 4):
            </strong>
            {selectedNode.aiPatternNote}
          </div>
        </aside>
      )}

      {/* DOCK INFERIOR SLIM DE NAVEGACAO RAPIDA */}
      <footer className="pointer-events-none absolute bottom-2.5 left-0 right-0 flex justify-center z-20 px-4">
        <div className="pointer-events-auto bg-[#0b1322]/90 backdrop-blur-md border border-[#1d3154] px-3 py-1.5 rounded-2xl shadow-2xl flex items-center gap-2 overflow-x-auto max-w-full">
          <span className="text-[10px] font-mono uppercase text-slate-400 px-1.5 hidden sm:inline">
            Setores:
          </span>
          {nodes.map((node) => {
            const isSel = node.id === selectedNode.id;
            const isPeak = node.noiseDb > node.noiseThreshold;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => focusCameraOnNode(node)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-2 shrink-0 ${
                  isSel
                    ? 'bg-[#004B8D]/60 border-[#00A859] text-white shadow'
                    : 'bg-[#0f1a2e]/90 border-[#1f345a] text-slate-300 hover:border-sky-500/50'
                }`}
              >
                <span className="font-mono text-[11px] font-bold">{node.code}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    isPeak
                      ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                      : 'bg-[#00A859]/20 text-[#00A859]'
                  }`}
                >
                  {node.noiseDb} dB
                </span>
              </button>
            );
          })}
        </div>
      </footer>

      {/* MODAL DE ARQUITETURA & PLANO DE TRABALHO */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1322] border border-[#1f3a60] rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#1d3154] pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#00A859] block">
                  ARQUITETURA OFICIAL DO PROJETO - GT1_SPLICE FACENS
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Maquete 1:1 PBR, Física IDM, Difração OBB & Modo Cinema
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="p-1.5 rounded-lg bg-[#132038] text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  1. GEOMETRIA COMPOSTA 1:1 & HDR (PMREM)
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Coordenadas derivadas da maquete oficial com 15 edificações detalhadas (portaria, torre Facens, LIGA, Biblioteca Solar, 16 exaustores, estufa, campo e lago com shader especular).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  2. FÍSICA VEICULAR IDM & FAIXAS
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Veículos (Baja, elétricos e viatura Splice) na faixa direita brasileira, com rotação de rodas v = w * r, roll centrípeto e parada automática para os 25 pedestres nas 4 faixas.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  3. ACÚSTICA 1/r² COM OCLUSÃO OBB REAL
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Soma logarítmica de decibéis (dB) em tempo real com interseção de raio vs caixas orientadas (OBB) de cada edifício para calcular sombra acústica física por difração.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  4. VIEWPORT AMPLO & IMPORTADOR .FBX
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Painéis retráteis, Modo Cinema em tela cheia, 3 modos de shader (PBR Dia, CCO Noite, Raio-X) e importação nativa de malha externa Predios_Mesh.fbx.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
