'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
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
  Focus,
  Upload,
  Layers,
  Navigation,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Video
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

// Traçado fiel do anel viário da Facens em escala ampla (Ilha 520 x 390)
const FACENS_ROAD_CONTROL_POINTS = [
  { x: 48, z: 168 },    // Entrada Portaria Azul (Sul-Direita)
  { x: 92, z: 128 },    // Subida das 5 Bandeiras
  { x: 112, z: 62 },    // Reta Pátio Leste / Edifício Facens
  { x: 94, z: -12 },    // Curva Avião AeroDesign
  { x: 106, z: -68 },   // Acesso LIGA / Smart Mall
  { x: 38, z: -118 },   // Contorno Estufa Agrícola
  { x: -42, z: -145 },  // Topo Norte (Atrás da Biblioteca Solar)
  { x: -118, z: -115 }, // Curva Lago dos Patos (Noroeste)
  { x: -138, z: -52 },  // Passagem Usina Fotovoltaica de Solo
  { x: -108, z: 18 },   // Eixo Laboratórios c/ Exaustores
  { x: -48, z: 82 },    // Descida Central (Ao lado do Bloco Sul)
  { x: -4, z: 136 },    // Entroncamento Estacionamento Diagonal
  { x: 24, z: 168 }     // Saída Portaria Azul
];

const INITIAL_NODES: SensorNode[] = [
  {
    id: 'portaria-sul',
    code: 'PORTARIA-P01',
    name: 'Pórtico Principal Facens & Estacionamento',
    nodeType: 'POSTE_SPLICE',
    sector: 'Acesso Sul • Portaria Azul, Guarita & Vagas',
    x: 36,
    z: 164,
    h: 18,
    baseDb: 63,
    noiseDb: 68,
    peakDb: 76,
    noiseThreshold: 70,
    vehiclesCount: 218,
    pedestriansCount: 94,
    speedAvgKmh: 28,
    historyDb: [59, 62, 66, 71, 76, 73, 69, 66, 65, 68],
    sensorsInstalled: ['Câmera LPR Splice (Entrada/Saída)', 'Radar Portaria', 'Sonômetro Viário'],
    aiPatternNote: 'Física IDM: Ruído modulado pela aceleração e frenagem dos veículos nas faixas da portaria.'
  },
  {
    id: 'predio-facens-leste',
    code: 'EDIF-FACENS',
    name: 'Edifício Vertical Facens (Bloco Leste)',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Leste • Fachada Principal & Praça das Bandeiras',
    x: 168,
    z: 38,
    h: 52,
    baseDb: 53,
    noiseDb: 57,
    peakDb: 64,
    noiseThreshold: 66,
    vehiclesCount: 74,
    pedestriansCount: 132,
    speedAvgKmh: 24,
    historyDb: [50, 52, 54, 57, 61, 63, 59, 57, 55, 57],
    sensorsInstalled: ['Sonômetro Acústico (dB)', 'Câmera Óptica Pátio Leste'],
    aiPatternNote: 'Sombra acústica ativa: Edifício atenua em -5 dB o ruído vindo do anel viário oeste.'
  },
  {
    id: 'smart-mall-liga',
    code: 'LIGA-FABLAB',
    name: 'LIGA / Smart Mall (Fachada Azul & Laranja)',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Nordeste • Inovação, FabLab & 5G',
    x: 154,
    z: -66,
    h: 30,
    baseDb: 55,
    noiseDb: 59,
    peakDb: 66,
    noiseThreshold: 66,
    vehiclesCount: 52,
    pedestriansCount: 98,
    speedAvgKmh: 21,
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
    x: -52,
    z: -94,
    h: 32,
    baseDb: 61,
    noiseDb: 69,
    peakDb: 77,
    noiseThreshold: 65,
    vehiclesCount: 95,
    pedestriansCount: 164,
    speedAvgKmh: 26,
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
    x: 12,
    z: 18,
    h: 25,
    baseDb: 64,
    noiseDb: 71,
    peakDb: 80,
    noiseThreshold: 68,
    vehiclesCount: 64,
    pedestriansCount: 215,
    speedAvgKmh: 19,
    historyDb: [58, 62, 66, 71, 76, 80, 75, 72, 70, 71],
    sensorsInstalled: ['Sonômetros de Passarela (dB)', 'Contador Óptico de Pedestres'],
    aiPatternNote: 'Alerta Nível 4: Pico acústico recorrente nas passarelas centrais em troca de turno.'
  },
  {
    id: 'lab-engenharias-oeste',
    code: 'LAB-OESTE',
    name: 'Laboratórios de Engenharia (16 Domos) & Campo',
    nodeType: 'PREDIO_CAMPUS',
    sector: 'Setor Oeste • Exaustores, Ginásio, Campo & Drone',
    x: -132,
    z: 32,
    h: 23,
    baseDb: 57,
    noiseDb: 62,
    peakDb: 69,
    noiseThreshold: 68,
    vehiclesCount: 44,
    pedestriansCount: 112,
    speedAvgKmh: 23,
    historyDb: [54, 56, 58, 61, 65, 68, 63, 60, 59, 62],
    sensorsInstalled: ['Sonômetro Industrial Oeste', 'Telemetria Drone / Campo'],
    aiPatternNote: 'Ruído contínuo dos 16 exaustores de teto somado à atividade no complexo esportivo.'
  }
];

export default function FacensHighEndDigitalShadow() {
  const [threeLoaded, setThreeLoaded] = useState<boolean>(false);
  const [fbxLoaderReady, setFbxLoaderReady] = useState<boolean>(false);
  const [fbxStatus, setFbxStatus] = useState<string>('Engine PBR + Física IDM Ativa');
  const [showProceduralBuildings, setShowProceduralBuildings] = useState<boolean>(true);
  const [hasImportedFbx, setHasImportedFbx] = useState<boolean>(false);
  const [showImportedFbx, setShowImportedFbx] = useState<boolean>(true);

  // Controles de Espaço de Tela (Modo Cinema / Painéis Retráteis)
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
  const proceduralBuildingsGroupRef = useRef<any>(null);
  const pickableMeshesRef = useRef<any[]>([]);
  const liveAcousticLevelsRef = useRef<Record<string, number>>({});

  const nodesRef = useRef<SensorNode[]>(nodes);
  nodesRef.current = nodes;

  const selectedNodeIdRef = useRef<string>(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  const simSpeedRef = useRef<number>(simSpeed);
  simSpeedRef.current = simSpeed;

  const placingModeRef = useRef<boolean>(placingSensorMode);
  placingModeRef.current = placingSensorMode;

  const renderStyleRef = useRef(renderStyle);
  renderStyleRef.current = renderStyle;

  const pruneTreesRef = useRef(pruneTrees);
  pruneTreesRef.current = pruneTrees;

  const highlightAcousticsRef = useRef(highlightAcoustics);
  highlightAcousticsRef.current = highlightAcoustics;

  const showProceduralRef = useRef(showProceduralBuildings);
  showProceduralRef.current = showProceduralBuildings;

  const showImportedFbxRef = useRef(showImportedFbx);
  showImportedFbxRef.current = showImportedFbx;

  const droneCamRef = useRef(droneCameraMode);
  droneCamRef.current = droneCameraMode;

  // Câmera perfeitamente enquadrada para mostrar toda a ilha 520x390 sem cortar nas laterais
  const camTargetStateRef = useRef({
    theta: 0.0,
    phi: 0.86,
    radius: 390,
    targetX: 0,
    targetZ: 14
  });
  const camCurrentStateRef = useRef({
    theta: 0.0,
    phi: 0.86,
    radius: 390,
    targetX: 0,
    targetZ: 14
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // Carrega Three.js + fflate + FBXLoader via CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadFbxDeps = () => {
      if (window.THREE && window.THREE.FBXLoader) {
        setFbxLoaderReady(true);
        return;
      }
      const fflateScript = document.createElement('script');
      fflateScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/fflate.min.js';
      fflateScript.async = true;
      fflateScript.onload = () => {
        const fbxScript = document.createElement('script');
        fbxScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js';
        fbxScript.async = true;
        fbxScript.onload = () => setFbxLoaderReady(true);
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

  // Atualiza telemetria com base no motor de física acústica 3D
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

        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        object.scale.setScalar(320 / maxDim);

        const scaledBox = new THREE.Box3().setFromObject(object);
        const center = new THREE.Vector3();
        scaledBox.getCenter(center);

        object.position.x -= center.x;
        object.position.z -= center.z;
        object.position.y -= scaledBox.min.y - 1.5;

        object.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({
              color: 0xf8fafc,
              roughness: 0.35,
              metalness: 0.25,
              wireframe: renderStyleRef.current === 'BIM_XRAY'
            });
            pickableMeshesRef.current.push(child);
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

  // MOTOR GRÁFICO WEBGL THREE.JS + PBR ENVIRONMENT + CONTINUOUS RIBBON ROAD + FÍSICA IDM
  useEffect(() => {
    if (!threeLoaded || !mountRef.current) return;
    const THREE = window.THREE;
    const container = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b14);
    scene.fog = new THREE.FogExp2(0x060b14, 0.00075);

    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      1,
      2200
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 0. MAPA DE AMBIENTE HDR PROCEDURAL (PMREMGenerator) PARA REFLEXOS REALISTAS EM VIDROS E ÁGUA
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      const skyDome = new THREE.Mesh(
        new THREE.SphereGeometry(100, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.BackSide })
      );
      envScene.add(skyDome);
      const groundBounce = new THREE.Mesh(
        new THREE.SphereGeometry(98, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x8f993e, side: THREE.BackSide })
      );
      envScene.add(groundBounce);
      const sunOrb = new THREE.Mesh(
        new THREE.SphereGeometry(12, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      sunOrb.position.set(50, 70, 50);
      envScene.add(sunOrb);
      scene.environment = pmremGenerator.fromScene(envScene, 0.04).texture;
    } catch {
      // Fallback caso navegador restrinja PMREM
    }

    // TEXTURAS PROCEDURAIS DE ALTA RESOLUÇÃO
    const maxAniso = renderer.capabilities.getMaxAnisotropy() || 4;

    // Textura da Estrada Contínua (Asfalto + Faixa Tracejada Amarela + Guias Brancas)
    const createRoadRibbonTexture = () => {
      const cvs = document.createElement('canvas');
      cvs.width = 512;
      cvs.height = 512;
      const c = cvs.getContext('2d')!;
      c.fillStyle = '#2b2726';
      c.fillRect(0, 0, 512, 512);

      // Granulação sutil de asfalto
      c.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 600; i++) {
        c.fillRect((i * 73) % 512, (i * 137) % 512, 3, 3);
      }

      // Guias laterais brancas/cinzas
      c.fillStyle = '#94a3b8';
      c.fillRect(10, 0, 14, 512);
      c.fillRect(488, 0, 14, 512);

      // Faixa central amarela tracejada
      c.fillStyle = '#facc15';
      c.fillRect(250, 40, 12, 180);
      c.fillRect(250, 300, 12, 180);

      const tex = new THREE.CanvasTexture(cvs);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 36);
      tex.anisotropy = maxAniso;
      return tex;
    };

    // Textura de Heatmap Radial Suave para Sensores (Substitui as gaiolas de arame feias!)
    const createHeatmapDiscTexture = (hexColor: string) => {
      const cvs = document.createElement('canvas');
      cvs.width = 256;
      cvs.height = 256;
      const c = cvs.getContext('2d')!;
      const grad = c.createRadialGradient(128, 128, 8, 128, 128, 124);
      grad.addColorStop(0, hexColor + '66');
      grad.addColorStop(0.55, hexColor + '28');
      grad.addColorStop(0.88, hexColor + '88');
      grad.addColorStop(1, hexColor + '00');
      c.fillStyle = grad;
      c.fillRect(0, 0, 256, 256);

      // Anel técnico tracejado fino
      c.strokeStyle = hexColor;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(128, 128, 112, 0, Math.PI * 2);
      c.stroke();

      return new THREE.CanvasTexture(cvs);
    };

    const createFacensLogoTexture = () => {
      const cvs = document.createElement('canvas');
      cvs.width = 512;
      cvs.height = 256;
      const c = cvs.getContext('2d')!;
      c.fillStyle = '#f8fafc';
      c.fillRect(0, 0, 512, 256);

      c.fillStyle = '#334155';
      c.fillRect(24, 172, 464, 28);
      c.fillRect(24, 214, 464, 28);

      c.strokeStyle = '#0284c7';
      c.lineWidth = 11;
      c.beginPath();
      c.arc(125, 95, 36, 0, Math.PI * 2);
      c.stroke();

      c.fillStyle = '#004B8D';
      c.font = 'italic bold 66px sans-serif';
      c.fillText('Facens', 178, 116);

      const tex = new THREE.CanvasTexture(cvs);
      tex.anisotropy = maxAniso;
      return tex;
    };

    const createSolarGridTexture = () => {
      const cvs = document.createElement('canvas');
      cvs.width = 256;
      cvs.height = 256;
      const c = cvs.getContext('2d')!;
      c.fillStyle = '#0369a1';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#7dd3fc';
      c.lineWidth = 3;
      for (let i = 0; i <= 256; i += 32) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, 256);
        c.stroke();
        c.beginPath();
        c.moveTo(0, i);
        c.lineTo(256, i);
        c.stroke();
      }
      const tex = new THREE.CanvasTexture(cvs);
      tex.anisotropy = maxAniso;
      return tex;
    };

    const roadRibbonTex = createRoadRibbonTexture();
    const texGreenHeat = createHeatmapDiscTexture('#00A859');
    const texRedHeat = createHeatmapDiscTexture('#f43f5e');
    const texBlueHeat = createHeatmapDiscTexture('#38bdf8');
    const facensLogoTex = createFacensLogoTexture();
    const solarGridTex = createSolarGridTexture();

    // 1. ILUMINAÇÃO SOLAR FÍSICA + SOMBRAS SUAVES
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3b4d24, 0.82);
    hemiLight.position.set(0, 260, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
    sunLight.position.set(170, 280, 180);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 30;
    sunLight.shadow.camera.far = 800;
    const dBox = 270;
    sunLight.shadow.camera.left = -dBox;
    sunLight.shadow.camera.right = dBox;
    sunLight.shadow.camera.top = dBox;
    sunLight.shadow.camera.bottom = -dBox;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    const underGrid = new THREE.GridHelper(780, 60, 0x00a859, 0x102038);
    underGrid.position.y = -15;
    scene.add(underGrid);

    // 2. ILHA AMPLA DO CAMPUS FACENS (460 x 370) - ESPAÇAMENTO REALISTA ENTRE PRÉDIOS
    const campusGroup = new THREE.Group();
    scene.add(campusGroup);

    const proceduralBuildingsGroup = new THREE.Group();
    proceduralBuildingsGroupRef.current = proceduralBuildingsGroup;
    campusGroup.add(proceduralBuildingsGroup);

    const fbxGroup = new THREE.Group();
    fbxGroupRef.current = fbxGroup;
    campusGroup.add(fbxGroup);

    const soilDarkMat = new THREE.MeshStandardMaterial({ color: 0x5c2c18, roughness: 0.92 });
    const soilMidMat = new THREE.MeshStandardMaterial({ color: 0x7a3e24, roughness: 0.9 });
    const soilBottom = new THREE.Mesh(new THREE.BoxGeometry(444, 8, 354), soilDarkMat);
    soilBottom.position.y = -10.5;
    campusGroup.add(soilBottom);

    const soilTop = new THREE.Mesh(new THREE.BoxGeometry(454, 7, 364), soilMidMat);
    soilTop.position.y = -4;
    campusGroup.add(soilTop);

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x959c44, roughness: 0.86 });
    const grassMesh = new THREE.Mesh(new THREE.BoxGeometry(460, 2.5, 370), grassMat);
    grassMesh.position.y = 0;
    grassMesh.receiveShadow = true;
    campusGroup.add(grassMesh);

    const centralGardenMat = new THREE.MeshStandardMaterial({ color: 0x76b83f, roughness: 0.78 });
    const centralGarden = new THREE.Mesh(new THREE.BoxGeometry(165, 0.45, 160), centralGardenMat);
    centralGarden.position.set(-10, 1.3, -10);
    centralGarden.rotation.y = -0.45;
    centralGarden.receiveShadow = true;
    campusGroup.add(centralGarden);

    // 3. MALHA DE ESTRADA CONTÍNUA (RIBBON BUFFERGEOMETRY - ZERO Z-FIGHTING!)
    const roadCurvePoints = FACENS_ROAD_CONTROL_POINTS.map((p) => new THREE.Vector3(p.x, 1.42, p.z));
    const roadSpline = new THREE.CatmullRomCurve3(roadCurvePoints, true, 'centripetal', 0.5);

    const buildContinuousRoadRibbon = (curve: any, width: number, segments: number) => {
      const pts = curve.getSpacedPoints(segments);
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      const up = new THREE.Vector3(0, 1, 0);

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const pt = pts[i % segments];
        const tangent = curve.getTangentAt(u).normalize();
        const side = new THREE.Vector3().crossVectors(up, tangent).normalize();

        const left = pt.clone().addScaledVector(side, width * 0.5);
        const right = pt.clone().addScaledVector(side, -width * 0.5);

        positions.push(left.x, 1.42, left.z);
        positions.push(right.x, 1.42, right.z);
        normals.push(0, 1, 0, 0, 1, 0);
        uvs.push(0, u, 1, u);

        if (i < segments) {
          const base = i * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      return geo;
    };

    const roadRibbonGeo = buildContinuousRoadRibbon(roadSpline, 20, 260);
    const roadRibbonMat = new THREE.MeshStandardMaterial({
      map: roadRibbonTex,
      roughness: 0.85,
      metalness: 0.05
    });
    const roadRibbonMesh = new THREE.Mesh(roadRibbonGeo, roadRibbonMat);
    roadRibbonMesh.receiveShadow = true;
    campusGroup.add(roadRibbonMesh);

    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x2b2726, roughness: 0.88 });
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // Rampa de Entrada/Saída da Portaria Principal + Zebrado Laranja
    const entranceApron = new THREE.Mesh(new THREE.BoxGeometry(44, 0.35, 36), asphaltMat);
    entranceApron.position.set(36, 1.28, 166);
    entranceApron.receiveShadow = true;
    campusGroup.add(entranceApron);

    const medianOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    for (let mz = 154; mz <= 182; mz += 4.5) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(8, 0.42, 1.8), medianOrangeMat);
      stripe.position.set(36, 1.32, mz);
      campusGroup.add(stripe);
    }

    // Estacionamento Diagonal Sul (à esquerda da Portaria) + Carros Estacionados + Trator Amarelo
    const southParking = new THREE.Mesh(new THREE.BoxGeometry(92, 0.35, 26), asphaltMat);
    southParking.position.set(-54, 1.28, 166);
    southParking.receiveShadow = true;
    campusGroup.add(southParking);

    for (let px = -92; px <= -16; px += 10) {
      const bayLine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 18), yellowLineMat);
      bayLine.position.set(px, 1.32, 166);
      bayLine.rotation.y = 0.42;
      campusGroup.add(bayLine);
    }

    // Passarelas de Pedestres Terracota/Rosa + Faixas de Pedestres Vermelhas
    const walkwayTerracottaMat = new THREE.MeshStandardMaterial({ color: 0xc87a65, roughness: 0.75 });
    [
      { x: 14, z: 52, w: 135, d: 5.5, rot: -0.45 },
      { x: 8, z: -6, w: 135, d: 5.5, rot: -0.45 },
      { x: -24, z: 16, w: 5.5, d: 135, rot: -0.45 },
      { x: 108, z: 44, w: 68, d: 5.5, rot: 0.15 }
    ].forEach((wp) => {
      const wk = new THREE.Mesh(new THREE.BoxGeometry(wp.w, 0.32, wp.d), walkwayTerracottaMat);
      wk.position.set(wp.x, 1.28, wp.z);
      wk.rotation.y = wp.rot;
      wk.receiveShadow = true;
      campusGroup.add(wk);
    });

    const redCrossMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const whiteCrossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [
      { x: 34, z: 134, rot: 0.2 },
      { x: 112, z: 48, rot: 0.05 },
      { x: 96, z: -22, rot: -0.45 },
      { x: -82, z: 26, rot: -0.45 }
    ].forEach((cw) => {
      const cwGrp = new THREE.Group();
      cwGrp.position.set(cw.x, 1.46, cw.z);
      cw.rot && (cwGrp.rotation.y = cw.rot);
      cwGrp.add(new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 6.5), redCrossMat));
      for (let sx = -6; sx <= 6; sx += 2.4) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 5.6), whiteCrossMat);
        bar.position.x = sx;
        cwGrp.add(bar);
      }
      campusGroup.add(cwGrp);
    });

    // 4. LAGO AZUL NOROESTE + ILHOTA + 3 PATINHOS 3D + QUIOSQUE AZUL
    const lakeGeo = new THREE.CylinderGeometry(38, 38, 0.8, 40);
    lakeGeo.scale(1.45, 1, 0.68);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.08,
      metalness: 0.65
    });
    const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
    lakeMesh.position.set(-154, 1.3, -124);
    lakeMesh.rotation.y = -0.25;
    campusGroup.add(lakeMesh);

    const lakeIsland = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 7.5, 1.8, 20),
      centralGardenMat
    );
    lakeIsland.position.set(-134, 1.6, -128);
    campusGroup.add(lakeIsland);

    const ducksGroup = new THREE.Group();
    const duckBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const duckBeakMat = new THREE.MeshStandardMaterial({ color: 0xf97316 });
    for (let dk = 0; dk < 3; dk++) {
      const duck = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 12), duckBodyMat);
      body.scale.set(1.45, 0.8, 1);
      duck.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 12), duckBodyMat);
      head.position.set(1.8, 1.4, 0);
      duck.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8), duckBeakMat);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(2.7, 1.4, 0);
      duck.add(beak);
      duck.position.set(-168 + dk * 14, 2.0, -122 + (dk % 2) * 6);
      ducksGroup.add(duck);
    }
    campusGroup.add(ducksGroup);

    // 5. CAMPO DE FUTEBOL OFICIAL (SUDOESTE) + DRONE QUADRICÓPTERO 3D
    const pitchGroup = new THREE.Group();
    pitchGroup.position.set(-156, 1.35, 118);
    pitchGroup.rotation.y = -0.42;
    const pitchTurf = new THREE.Mesh(
      new THREE.BoxGeometry(92, 0.4, 56),
      new THREE.MeshStandardMaterial({ color: 0x557a2b, roughness: 0.82 })
    );
    pitchTurf.receiveShadow = true;
    pitchGroup.add(pitchTurf);

    [
      { w: 86, d: 0.8, x: 0, z: -25 },
      { w: 86, d: 0.8, x: 0, z: 25 },
      { w: 0.8, d: 50, x: -43, z: 0 },
      { w: 0.8, d: 50, x: 43, z: 0 },
      { w: 0.8, d: 50, x: 0, z: 0 }
    ].forEach((ln) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ln.w, 0.5, ln.d), whiteCrossMat);
      m.position.set(ln.x, 0.05, ln.z);
      pitchGroup.add(m);
    });

    const pitchCircle = new THREE.Mesh(
      new THREE.RingGeometry(7.5, 8.3, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    pitchCircle.rotation.x = -Math.PI / 2;
    pitchCircle.position.y = 0.32;
    pitchGroup.add(pitchCircle);

    [-43, 43].forEach((gx) => {
      const goal = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.5, 12), whiteCrossMat);
      goal.position.set(gx, 2.8, 0);
      pitchGroup.add(goal);
    });
    campusGroup.add(pitchGroup);

    // Drone Quadricóptero 3D
    const droneGroup = new THREE.Group();
    const droneBody = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 1.8, 6.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
    );
    droneGroup.add(droneBody);
    const droneRotors: any[] = [];
    [
      [-5.2, -5.2],
      [5.2, -5.2],
      [-5.2, 5.2],
      [5.2, 5.2]
    ].forEach(([rx, rz]) => {
      const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 0.25, 0.7),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      rotor.position.set(rx, 1.2, rz);
      droneGroup.add(rotor);
      droneRotors.push(rotor);
    });
    droneGroup.position.set(-98, 26, 94);
    campusGroup.add(droneGroup);

    // 6. PRÉDIOS DETALHADOS COM ARQUITETURA FIEL (MULLIONS, PILARES, BRISE-SOLEIL E HEATMAPS DE SOLO)
    const wallWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 });
    const roofDarkBrownMat = new THREE.MeshStandardMaterial({ color: 0x574c44, roughness: 0.62 });
    const roofSlateMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.52 });
    const glassBlueMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.08,
      metalness: 0.85
    });
    const solarRoofMat = new THREE.MeshStandardMaterial({
      map: solarGridTex,
      roughness: 0.18,
      metalness: 0.75
    });

    const pickableMeshes: any[] = [];
    pickableMeshesRef.current = pickableMeshes;
    const groundHeatDiscsMap: Record<string, any> = {};
    const pulseRingsMap: Record<string, any> = {};

    const registerSensorHeatmap = (nodeId: string, x: number, z: number, radius: number) => {
      const overlayGrp = new THREE.Group();
      overlayGrp.position.set(x, 1.48, z);

      // Disco de Heatmap Radial Suave no Solo (Zero poluição de arame!)
      const discGeo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
      const discMat = new THREE.MeshBasicMaterial({
        map: texGreenHeat,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.x = -Math.PI / 2;
      overlayGrp.add(discMesh);
      groundHeatDiscsMap[nodeId] = discMesh;

      // Anel de Pulso Expansivo Fino
      const ringGeo = new THREE.RingGeometry(radius * 0.72, radius * 0.78, 40);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00a859,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.05;
      overlayGrp.add(ringMesh);
      pulseRingsMap[nodeId] = ringMesh;

      campusGroup.add(overlayGrp);
    };

    const addDetailedFacade = (parent: any, w: number, h: number, d: number, floors: number) => {
      for (let f = 0; f < floors; f++) {
        const wy = 5.2 + f * 7.5;
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.5, 3.0, d + 0.5),
          glassBlueMat
        );
        band.position.y = wy;
        parent.add(band);

        // Lajes horizontais (Brise-soleil brancos entre andares)
        const ledge = new THREE.Mesh(
          new THREE.BoxGeometry(w + 1.4, 0.7, d + 1.4),
          wallWhiteMat
        );
        ledge.position.y = wy + 1.8;
        parent.add(ledge);
      }

      // Pilares estruturais verticais (Mullions)
      for (let px = -w / 2 + 6; px <= w / 2 - 6; px += 12) {
        const mullion = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, h - 1, d + 0.8),
          wallWhiteMat
        );
        mullion.position.set(px, h / 2, 0);
        parent.add(mullion);
      }
    };

    // 6.1. PORTARIA PRINCIPAL AZUL-TURQUESA (Sul-Direita)
    {
      const portGrp = new THREE.Group();
      portGrp.position.set(36, 1.25, 164);
      const brickMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.75 });
      [-22, 0, 22].forEach((px) => {
        const booth = new THREE.Mesh(new THREE.BoxGeometry(7.5, 13, 11), brickMat);
        booth.position.set(px, 6.5, 0);
        booth.castShadow = true;
        booth.userData.nodeId = 'portaria-sul';
        portGrp.add(booth);
        pickableMeshes.push(booth);
      });
      const cyanRoof = new THREE.Mesh(
        new THREE.BoxGeometry(70, 4.2, 19),
        new THREE.MeshStandardMaterial({ color: 0x00acc1, roughness: 0.22, metalness: 0.3 })
      );
      cyanRoof.position.set(0, 15, 0);
      cyanRoof.castShadow = true;
      cyanRoof.userData.nodeId = 'portaria-sul';
      portGrp.add(cyanRoof);
      pickableMeshes.push(cyanRoof);
      proceduralBuildingsGroup.add(portGrp);
      registerSensorHeatmap('portaria-sul', 36, 164, 34);
    }

    // 6.2. EDIFÍCIO VERTICAL BRANCO "FACENS" (Direita / Leste) + BLOCO SUDESTE + CAIXAS D'ÁGUA
    {
      const edifGrp = new THREE.Group();
      edifGrp.position.set(168, 1.25, 38);
      edifGrp.rotation.y = -0.38;

      const materials = [
        new THREE.MeshStandardMaterial({ map: facensLogoTex, roughness: 0.32 }),
        wallWhiteMat,
        roofSlateMat,
        wallWhiteMat,
        new THREE.MeshStandardMaterial({ map: facensLogoTex, roughness: 0.32 }),
        wallWhiteMat
      ];
      const tower = new THREE.Mesh(new THREE.BoxGeometry(48, 50, 40), materials);
      tower.position.y = 25;
      tower.castShadow = true;
      tower.receiveShadow = true;
      tower.userData.nodeId = 'predio-facens-leste';
      edifGrp.add(tower);
      pickableMeshes.push(tower);

      const glassCurtain = new THREE.Mesh(new THREE.BoxGeometry(1.4, 38, 32), glassBlueMat);
      glassCurtain.position.set(-24.2, 24, 0);
      edifGrp.add(glassCurtain);

      proceduralBuildingsGroup.add(edifGrp);
      registerSensorHeatmap('predio-facens-leste', 168, 38, 42);

      // Bloco Sudeste com telhado de duas águas + Caixas d'Água
      const seBlock = new THREE.Group();
      seBlock.position.set(182, 1.25, 118);
      seBlock.rotation.y = -0.42;
      const seBody = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 26), wallWhiteMat);
      seBody.position.y = 8;
      seBody.castShadow = true;
      seBlock.add(seBody);
      const seRoof = new THREE.Mesh(new THREE.ConeGeometry(26, 8, 4), roofDarkBrownMat);
      seRoof.position.y = 20;
      seRoof.rotation.y = Math.PI / 4;
      seBlock.add(seRoof);
      proceduralBuildingsGroup.add(seBlock);

      [148, 156].forEach((tx, idx) => {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2, 3.2, 12 - idx * 3, 16),
          wallWhiteMat
        );
        tank.position.set(tx, 7, 112 + idx * 6);
        tank.castShadow = true;
        proceduralBuildingsGroup.add(tank);
      });
    }

    // 6.3. LIGA / SMART MALL (Nordeste - Fachada Listrada Azul e Laranja + Anexo Branco)
    {
      const ligaGrp = new THREE.Group();
      ligaGrp.position.set(154, 1.25, -66);
      ligaGrp.rotation.y = -0.45;

      const ligaBody = new THREE.Mesh(new THREE.BoxGeometry(52, 28, 30), wallWhiteMat);
      ligaBody.position.y = 14;
      ligaBody.castShadow = true;
      ligaBody.userData.nodeId = 'smart-mall-liga';
      ligaGrp.add(ligaBody);
      pickableMeshes.push(ligaBody);

      const stripes = 9;
      for (let s = 0; s < stripes; s++) {
        const stCol = s % 2 === 0 ? 0x00529b : 0xea580c;
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(52 / stripes - 0.35, 26, 30.8),
          new THREE.MeshStandardMaterial({ color: stCol, roughness: 0.35 })
        );
        panel.position.set(-26 + (s + 0.5) * (52 / stripes), 14, 0);
        ligaGrp.add(panel);
      }

      const ligaRoof = new THREE.Mesh(new THREE.BoxGeometry(54, 2.2, 32), roofDarkBrownMat);
      ligaRoof.position.y = 29;
      ligaGrp.add(ligaRoof);

      const annex = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), wallWhiteMat);
      annex.position.set(34, 12, 10);
      annex.castShadow = true;
      ligaGrp.add(annex);

      proceduralBuildingsGroup.add(ligaGrp);
      registerSensorHeatmap('smart-mall-liga', 154, -66, 38);
    }

    // 6.4. BIBLIOTECA & COMPLEXO SOLAR EM "L" (Norte - Teto Solar Azul + Bloco de Claraboias + Usina Solar)
    {
      const bibGrp = new THREE.Group();
      bibGrp.position.set(-52, 1.25, -94);
      bibGrp.rotation.y = -0.45;

      const mainWing = new THREE.Mesh(new THREE.BoxGeometry(68, 28, 30), wallWhiteMat);
      mainWing.position.set(0, 14, -10);
      mainWing.castShadow = true;
      mainWing.userData.nodeId = 'complexo-solar-norte';
      bibGrp.add(mainWing);
      pickableMeshes.push(mainWing);
      addDetailedFacade(mainWing, 68, 28, 30, 3);

      const sideWing = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 44), wallWhiteMat);
      sideWing.position.set(28, 11, 10);
      sideWing.castShadow = true;
      sideWing.userData.nodeId = 'complexo-solar-norte';
      bibGrp.add(sideWing);
      pickableMeshes.push(sideWing);

      const solarRoof = new THREE.Mesh(new THREE.BoxGeometry(50, 2.0, 26), solarRoofMat);
      solarRoof.position.set(-4, 29.5, -10);
      solarRoof.rotation.x = 0.18;
      bibGrp.add(solarRoof);

      const skylightBlock = new THREE.Mesh(new THREE.BoxGeometry(54, 16, 24), wallWhiteMat);
      skylightBlock.position.set(-14, 8, 22);
      skylightBlock.castShadow = true;
      bibGrp.add(skylightBlock);

      const skylightTop = new THREE.Mesh(new THREE.BoxGeometry(50, 1.4, 20), solarRoofMat);
      skylightTop.position.set(-14, 16.5, 22);
      bibGrp.add(skylightTop);

      proceduralBuildingsGroup.add(bibGrp);
      registerSensorHeatmap('complexo-solar-norte', -52, -94, 46);

      // Usina Fotovoltaica de Solo
      [-115, -98, -81].forEach((sx, idx) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(20, 0.9, 11), solarRoofMat);
        panel.position.set(sx, 5.2, -52 + idx * 10);
        panel.rotation.y = -0.45;
        panel.rotation.x = 0.42;
        panel.castShadow = true;
        proceduralBuildingsGroup.add(panel);
      });

      // Estufa Agrícola Branca Abobadada + Prédios Norte
      const greenhouseGrp = new THREE.Group();
      greenhouseGrp.position.set(44, 1.25, -126);
      greenhouseGrp.rotation.y = -0.45;
      const ghBase = new THREE.Mesh(new THREE.BoxGeometry(42, 8, 22), wallWhiteMat);
      ghBase.position.y = 4;
      greenhouseGrp.add(ghBase);
      const ghVault = new THREE.Mesh(
        new THREE.CylinderGeometry(11, 11, 42, 16, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25 })
      );
      ghVault.rotation.z = Math.PI / 2;
      ghVault.position.y = 8;
      greenhouseGrp.add(ghVault);
      proceduralBuildingsGroup.add(greenhouseGrp);

      const northAdmin = new THREE.Mesh(new THREE.BoxGeometry(34, 17, 22), wallWhiteMat);
      northAdmin.position.set(-22, 9.5, -158);
      northAdmin.rotation.y = -0.15;
      northAdmin.castShadow = true;
      proceduralBuildingsGroup.add(northAdmin);

      const neBuilding = new THREE.Mesh(new THREE.BoxGeometry(38, 16, 22), wallWhiteMat);
      neBuilding.position.set(96, 9, -134);
      neBuilding.rotation.y = -0.45;
      neBuilding.castShadow = true;
      proceduralBuildingsGroup.add(neBuilding);
    }

    // 6.5. OS 3 BLOCOS ACADÊMICOS CENTRAIS NA DIAGONAL + AMBULATÓRIO (+)
    {
      const centralCoords = [
        { x: 34, z: -38, w: 62, d: 26, h: 25 },
        { x: 6, z: 18, w: 64, d: 25, h: 23 },
        { x: 18, z: 76, w: 64, d: 25, h: 23 }
      ];

      centralCoords.forEach((cb) => {
        const cGrp = new THREE.Group();
        cGrp.position.set(cb.x, 1.25, cb.z);
        cGrp.rotation.y = -0.45;

        const body = new THREE.Mesh(new THREE.BoxGeometry(cb.w, cb.h, cb.d), wallWhiteMat);
        body.position.y = cb.h / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        body.userData.nodeId = 'blocos-centrais';
        cGrp.add(body);
        pickableMeshes.push(body);

        addDetailedFacade(body, cb.w, cb.h, cb.d, 2);

        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(cb.w + 2.5, 2.0, cb.d + 2.5),
          roofDarkBrownMat
        );
        roof.position.y = cb.h + 1.0;
        cGrp.add(roof);

        const redAccent = new THREE.Mesh(
          new THREE.BoxGeometry(3.0, cb.h - 2, 5),
          new THREE.MeshStandardMaterial({ color: 0xdc2626 })
        );
        redAccent.position.set(cb.w / 2 + 0.5, cb.h / 2, 0);
        cGrp.add(redAccent);

        proceduralBuildingsGroup.add(cGrp);
      });

      const medGrp = new THREE.Group();
      medGrp.position.set(-64, 1.25, 6);
      medGrp.rotation.y = -0.45;
      const medBody = new THREE.Mesh(new THREE.BoxGeometry(22, 13, 16), wallWhiteMat);
      medBody.position.y = 6.5;
      medBody.castShadow = true;
      medGrp.add(medBody);
      const medRoof = new THREE.Mesh(new THREE.BoxGeometry(23, 1.4, 17), roofDarkBrownMat);
      medRoof.position.y = 13.7;
      medGrp.add(medRoof);
      proceduralBuildingsGroup.add(medGrp);

      registerSensorHeatmap('blocos-centrais', 12, 18, 48);
    }

    // 6.6. LABORATÓRIOS DE ENGENHARIA OESTE (16 EXAUSTORES BRANCOS NO TETO + ANEXO + GINÁSIO)
    {
      const westGrp = new THREE.Group();
      westGrp.position.set(-132, 1.25, 32);
      westGrp.rotation.y = -0.45;

      const mainLab = new THREE.Mesh(new THREE.BoxGeometry(68, 21, 30), wallWhiteMat);
      mainLab.position.y = 10.5;
      mainLab.castShadow = true;
      mainLab.userData.nodeId = 'lab-engenharias-oeste';
      westGrp.add(mainLab);
      pickableMeshes.push(mainLab);
      addDetailedFacade(mainLab, 68, 21, 30, 2);

      const labRoof = new THREE.Mesh(new THREE.BoxGeometry(70, 1.6, 32), roofSlateMat);
      labRoof.position.y = 21.8;
      westGrp.add(labRoof);

      for (let dx = -26; dx <= 26; dx += 7.4) {
        for (let dz = -6; dz <= 6; dz += 12) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.5, 8), wallWhiteMat);
          stem.position.set(dx, 23.2, dz);
          westGrp.add(stem);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12), wallWhiteMat);
          cap.scale.set(1, 0.55, 1);
          cap.position.set(dx, 24.6, dz);
          westGrp.add(cap);
        }
      }

      const frontAnnex = new THREE.Mesh(new THREE.BoxGeometry(44, 17, 24), wallWhiteMat);
      frontAnnex.position.set(28, 8.5, 30);
      frontAnnex.castShadow = true;
      westGrp.add(frontAnnex);
      const frontRoof = new THREE.Mesh(new THREE.BoxGeometry(46, 1.7, 26), roofDarkBrownMat);
      frontRoof.position.set(28, 17.8, 30);
      westGrp.add(frontRoof);

      proceduralBuildingsGroup.add(westGrp);
      registerSensorHeatmap('lab-engenharias-oeste', -132, 32, 44);
    }

    // 7. POSTES INTELIGENTES SPLICE 3D (COM CÂMERAS LPR E CONES ÓPTICOS LASER AO LONGO DO VIÁRIO)
    [
      { x: 54, z: 148, rot: -0.6 },
      { x: 98, z: 22, rot: -1.5 },
      { x: -18, z: -132, rot: 3.1 },
      { x: -115, z: -22, rot: 1.5 }
    ].forEach((sp) => {
      const poleGrp = new THREE.Group();
      poleGrp.position.set(sp.x, 1.35, sp.z);
      poleGrp.rotation.y = sp.rot;

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.7, 19, 10),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
      );
      mast.position.y = 9.5;
      mast.castShadow = true;
      poleGrp.add(mast);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 0.45, 0.45), mast.material);
      arm.position.set(2.2, 18.5, 0);
      poleGrp.add(arm);

      const camBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.1, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x00a859, emissive: 0x00a859, emissiveIntensity: 0.3 })
      );
      camBox.position.set(4.5, 18.2, 0);
      poleGrp.add(camBox);

      // Cone de leitura óptica LPR translúcido
      const fovCone = new THREE.Mesh(
        new THREE.ConeGeometry(8, 22, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x00a859,
          transparent: true,
          opacity: 0.09,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      fovCone.position.set(9, 8.5, 0);
      fovCone.rotation.z = Math.PI / 4;
      poleGrp.add(fovCone);

      campusGroup.add(poleGrp);
    });

    // 8. AVIÃO AERODESIGN + 5 BANDEIRAS TREMULANDO
    {
      const aeroGrp = new THREE.Group();
      aeroGrp.position.set(84, 2.4, -18);
      aeroGrp.rotation.y = 0.55;
      aeroGrp.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(17, 2.0, 2.5),
          new THREE.MeshStandardMaterial({ color: 0xfacc15 })
        )
      );
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 0.45, 24),
        new THREE.MeshStandardMaterial({ color: 0xef4444 })
      );
      wing.position.set(1, 1.0, 0);
      aeroGrp.add(wing);
      campusGroup.add(aeroGrp);

      const flagColors = [0x00a859, 0x0284c7, 0xfacc15, 0xef4444, 0xffffff];
      flagColors.forEach((fc, idx) => {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.4, 20, 8),
          wallWhiteMat
        );
        pole.position.set(74 + idx * 5.2, 11, 92 - idx * 2.2);
        campusGroup.add(pole);

        const flag = new THREE.Mesh(
          new THREE.BoxGeometry(4.8, 3.0, 0.25),
          new THREE.MeshStandardMaterial({ color: fc })
        );
        flag.position.set(76.5 + idx * 5.2, 19.5, 92 - idx * 2.2);
        campusGroup.add(flag);
      });
    }

    // 9. BOSQUES MULTI-CAMADAS 3D (COPAS COMPOSTAS DE PINHEIROS E ÁRVORES OUTONAIS)
    const treesGroup = new THREE.Group();
    const treePalette = [0x3b5323, 0x4d6b2c, 0x8d3b28, 0xb85d27, 0xc27d2c];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e19 });

    const addMultiTierTree = (tx: number, tz: number, scale = 1.0, isCypress = false, colorHex?: number) => {
      const col = colorHex ?? treePalette[Math.floor(Math.abs(tx * tz) % treePalette.length)];
      const tGrp = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 6 * scale, 8), trunkMat);
      trunk.position.y = 3 * scale;
      tGrp.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
      if (isCypress) {
        const cyp = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4 * scale, 3.6 * scale, 21 * scale, 10),
          leafMat
        );
        cyp.position.y = 12 * scale;
        cyp.castShadow = true;
        tGrp.add(cyp);
      } else {
        // Árvore rica de 2 camadas de copa
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(6.2 * scale, 12 * scale, 10), leafMat);
        c1.position.y = 9 * scale;
        c1.castShadow = true;
        tGrp.add(c1);
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(4.6 * scale, 10 * scale, 10), leafMat);
        c2.position.y = 14.5 * scale;
        c2.castShadow = true;
        tGrp.add(c2);
      }

      tGrp.position.set(tx, 1.25, tz);
      treesGroup.add(tGrp);
    };

    for (let x = -215; x <= -65; x += 17) {
      for (let z = -175; z <= -148; z += 14) {
        addMultiTierTree(x + (z % 6), z, 0.95 + (Math.abs(x) % 3) * 0.18);
      }
    }
    for (let x = 112; x <= 215; x += 16) {
      for (let z = -172; z <= -102; z += 16) {
        addMultiTierTree(x, z + (x % 5), 1.0 + (x % 3) * 0.15);
      }
    }
    [88, 104, 120, 136, 162, 180, 198].forEach((cxPos) => {
      addMultiTierTree(cxPos, 172, 1.15, true, 0x3b5323);
    });
    [
      [-205, 55], [-208, 162], [-125, 168], [-32, 118], [54, 48],
      [-18, -18], [62, -62], [78, -72], [-96, -18], [-68, 62]
    ].forEach(([ix, iz]) => addMultiTierTree(ix, iz, 0.92, true));

    campusGroup.add(treesGroup);

    // 10. FÍSICA REAL DE TRÁFEGO (IDM: DISTÂNCIA DE SEGURANÇA, LUZ DE FREIO E ROTAÇÃO DE RODAS)
    const vehiclesPhysics: {
      mesh: any;
      wheels: any[];
      brakeLightMat: any;
      t: number;
      speed: number;
      maxSpeed: number;
      worldPos: any;
    }[] = [];

    const vehicleSpecs = [
      { t: 0.04, maxSpeed: 0.052, color: 0xef4444 },
      { t: 0.22, maxSpeed: 0.046, color: 0x38bdf8 },
      { t: 0.42, maxSpeed: 0.050, color: 0x00a859 },
      { t: 0.64, maxSpeed: 0.044, color: 0xf59e0b },
      { t: 0.82, maxSpeed: 0.048, color: 0xe2e8f0 }
    ];

    const wheelGeo = new THREE.CylinderGeometry(1.25, 1.25, 1.1, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827 });

    vehicleSpecs.forEach((spec) => {
      const carGrp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(6.0, 2.4, 10.8),
        new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.22, metalness: 0.55 })
      );
      body.position.y = 2.1;
      body.castShadow = true;
      carGrp.add(body);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 2.0, 5.6),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.8 })
      );
      cabin.position.y = 3.9;
      carGrp.add(cabin);

      // Faróis Dianteiros e Lanternas de Freio Traseiras Reativas
      const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const headL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.3), headLightMat);
      headL.position.set(-2.0, 2.2, 5.45);
      carGrp.add(headL);
      const headR = headL.clone();
      headR.position.x = 2.0;
      carGrp.add(headR);

      const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d });
      const tailL = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.3), brakeLightMat);
      tailL.position.set(-2.0, 2.2, -5.45);
      carGrp.add(tailL);
      const tailR = tailL.clone();
      tailR.position.x = 2.0;
      carGrp.add(tailR);

      const wheels: any[] = [];
      [
        [-3.1, 1.25, 3.2],
        [3.1, 1.25, 3.2],
        [-3.1, 1.25, -3.2],
        [3.1, 1.25, -3.2]
      ].forEach(([wx, wy, wz]) => {
        const wh = new THREE.Mesh(wheelGeo, wheelMat);
        wh.position.set(wx, wy, wz);
        carGrp.add(wh);
        wheels.push(wh);
      });

      campusGroup.add(carGrp);
      vehiclesPhysics.push({
        mesh: carGrp,
        wheels,
        brakeLightMat,
        t: spec.t,
        speed: spec.maxSpeed,
        maxSpeed: spec.maxSpeed,
        worldPos: new THREE.Vector3()
      });
    });

    // 11. PEDESTRES ARTICULADOS NAS PASSARELAS
    const pedestriansPhysics: {
      mesh: any;
      x1: number;
      z1: number;
      x2: number;
      z2: number;
      progress: number;
      dir: number;
      speed: number;
      worldPos: any;
    }[] = [];

    const pedRoutes = [
      { x1: -38, z1: 74, x2: 64, z2: 28 },
      { x1: -44, z1: 18, x2: 58, z2: -30 },
      { x1: -52, z1: -34, x2: 4, z2: 72 },
      { x1: 62, z1: 52, x2: 132, z2: 38 },
      { x1: 18, z1: 136, x2: 52, z2: 132 }
    ];

    for (let pIdx = 0; pIdx < 24; pIdx++) {
      const route = pedRoutes[pIdx % pedRoutes.length];
      const pedGrp = new THREE.Group();
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, 3.0, 8),
        new THREE.MeshStandardMaterial({
          color: pIdx % 3 === 0 ? 0x38bdf8 : pIdx % 3 === 1 ? 0x00a859 : 0xf472b6
        })
      );
      torso.position.y = 1.8;
      pedGrp.add(torso);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfde68a })
      );
      head.position.y = 3.8;
      pedGrp.add(head);

      campusGroup.add(pedGrp);
      pedestriansPhysics.push({
        mesh: pedGrp,
        x1: route.x1,
        z1: route.z1,
        x2: route.x2,
        z2: route.z2,
        progress: (pIdx * 0.14) % 1,
        dir: pIdx % 2 === 0 ? 1 : -1,
        speed: 0.075 + (pIdx % 4) * 0.014,
        worldPos: new THREE.Vector3()
      });
    }

    // 12. CONTROLES ORBIT + PAN + ZOOM + RAYCASTING 3D
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
        camTargetStateRef.current.phi = Math.max(
          0.32,
          Math.min(1.36, camTargetStateRef.current.phi - dy * 0.0052)
        );
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      isPointerDown = false;
      if (movedDistance < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        if (placingModeRef.current) {
          const hits = raycaster.intersectObject(grassMesh);
          if (hits.length > 0) {
            const pt = hits[0].point;
            const newId = `post-${Date.now()}`;
            const newNode: SensorNode = {
              id: newId,
              code: `POSTE-0${nodesRef.current.length + 1}`,
              name: `Spot Acústico & LPR #${nodesRef.current.length + 1}`,
              nodeType: 'POSTE_SPLICE',
              sector: 'Novo Ponto Instalado na Malha 3D',
              x: Math.round(pt.x),
              z: Math.round(pt.z),
              h: 22,
              baseDb: 58,
              noiseDb: 63,
              peakDb: 70,
              noiseThreshold: 68,
              vehiclesCount: 54,
              pedestriansCount: 41,
              speedAvgKmh: 26,
              historyDb: [56, 58, 61, 63, 66, 68, 65, 63, 62, 63],
              sensorsInstalled: ['Sonômetro Acústico (dB)', 'Câmera LPR 5G'],
              aiPatternNote: 'Sensor posicionado em tempo real captando física acústica do entorno.'
            };

            const poleMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.9, 1.2, 20, 12),
              new THREE.MeshStandardMaterial({ color: 0x00a859 })
            );
            poleMesh.position.set(newNode.x, 11, newNode.z);
            poleMesh.castShadow = true;
            poleMesh.userData.nodeId = newId;
            campusGroup.add(poleMesh);
            pickableMeshesRef.current.push(poleMesh);

            registerSensorHeatmap(newId, newNode.x, newNode.z, 30);
            setNodes((prev) => [...prev, newNode]);
            setSelectedNodeId(newId);
            setPlacingSensorMode(false);
          }
          return;
        }

        const intersects = raycaster.intersectObjects(pickableMeshesRef.current, false);
        if (intersects.length > 0) {
          const hitNodeId = intersects[0].object.userData.nodeId;
          if (hitNodeId) {
            setSelectedNodeId(hitNodeId);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      camTargetStateRef.current.radius = Math.max(
        125,
        Math.min(540, camTargetStateRef.current.radius + e.deltaY * 0.16)
      );
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('wheel', onWheel);
    domElem.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

    // 13. LOOP DE FÍSICA E RENDERIZAÇÃO 60 FPS
    let animFrameId: number;
    let lastClock = performance.now();

    const animate = (now: number) => {
      try {
        const dt = Math.min(0.1, Math.max(0, (now - lastClock) / 1000));
      lastClock = now;

      if (droneCamRef.current) {
        camTargetStateRef.current.theta = now * 0.00032;
        camTargetStateRef.current.phi = 0.78;
        camTargetStateRef.current.radius = 320;
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

      treesGroup.visible = !pruneTreesRef.current;
      if (proceduralBuildingsGroupRef.current) {
        proceduralBuildingsGroupRef.current.visible = showProceduralRef.current;
      }
      if (fbxGroupRef.current) {
        fbxGroupRef.current.visible = showImportedFbxRef.current;
      }

      const style = renderStyleRef.current;
      grassMat.color.setHex(
        style === 'MAQUETE_PBR' ? 0x959c44 : style === 'CCO_CYBER' ? 0x0b192c : 0x090d16
      );
      centralGardenMat.color.setHex(
        style === 'MAQUETE_PBR' ? 0x76b83f : style === 'CCO_CYBER' ? 0x0f293a : 0x0d1522
      );
      pickableMeshesRef.current.forEach((mesh) => {
        if (mesh && mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m: any) => {
              if (m) m.wireframe = style === 'BIM_XRAY';
            });
          } else {
            mesh.material.wireframe = style === 'BIM_XRAY';
          }
        }
      });

      const speedMult = simSpeedRef.current;

      // Pedestres caminhando
      pedestriansPhysics.forEach((ped, idx) => {
        if (speedMult > 0) {
          ped.progress += ped.dir * ped.speed * speedMult * dt;
          if (ped.progress >= 1) {
            ped.progress = 1;
            ped.dir = -1;
          } else if (ped.progress <= 0) {
            ped.progress = 0;
            ped.dir = 1;
          }
        }
        const px = ped.x1 + (ped.x2 - ped.x1) * ped.progress;
        const pz = ped.z1 + (ped.z2 - ped.z1) * ped.progress;
        ped.worldPos.set(px, 1.5, pz);
        ped.mesh.position.set(
          px,
          1.4 + Math.abs(Math.sin(now * 0.008 + idx)) * 0.45,
          pz
        );
      });

      // Física IDM dos Veículos (Frenagem + Luz de Freio + Rotação de Rodas)
      vehiclesPhysics.forEach((v, idx) => {
        if (speedMult > 0) {
          let mustBrake = false;
          // Verifica pedestres próximos
          for (const ped of pedestriansPhysics) {
            if (ped.worldPos.distanceTo(v.worldPos) < 18) {
              mustBrake = true;
              break;
            }
          }
          // Verifica distância para o carro da frente (IDM headway)
          const nextCar = vehiclesPhysics[(idx + 1) % vehiclesPhysics.length];
          const gapT = ((nextCar.t - v.t) + 1) % 1;
          if (gapT > 0 && gapT < 0.08) {
            mustBrake = true;
          }

          const targetSpd = mustBrake ? v.maxSpeed * 0.18 : v.maxSpeed;
          v.speed += (targetSpd - v.speed) * Math.min(1, dt * 6);
          v.t = (((v.t + v.speed * speedMult * dt * 0.38) % 1) + 1) % 1;

          // Acende luz de freio vermelha viva quando desacelera
          v.brakeLightMat.color.setHex(mustBrake ? 0xff1111 : 0x661111);

          // Gira as 4 rodas proporcionalmente à velocidade linear
          v.wheels.forEach((wh) => {
            wh.rotation.x += v.speed * speedMult * dt * 45;
          });
        }

        const safeT = Math.max(0, Math.min(0.99999, ((v.t % 1) + 1) % 1));
        const pos = roadSpline.getPointAt(safeT);
        const tangent = roadSpline.getTangentAt(safeT);
        const nextT = Math.max(0, Math.min(0.99999, ((safeT + 0.02) % 1 + 1) % 1));
        const nextTangent = roadSpline.getTangentAt(nextT);
        const curvature = tangent.x * nextTangent.z - tangent.z * nextTangent.x;

        v.worldPos.copy(pos);
        v.mesh.position.set(pos.x, 1.45, pos.z);
        v.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
        v.mesh.rotation.z = curvature * 1.6;
      });

      droneGroup.position.y = 26 + Math.sin(now * 0.004) * 2.5;
      droneGroup.rotation.z = Math.sin(now * 0.002) * 0.06;
      droneRotors.forEach((r) => {
        r.rotation.y += 0.48;
      });

      ducksGroup.children.forEach((dk: any, idx: number) => {
        dk.position.x = -162 + idx * 14 + Math.sin(now * 0.0018 + idx) * 5;
      });

      // Física Acústica com Oclusão e Heatmaps Suaves de Solo
      const pulseScale = 0.85 + (((now % 1800) + 1800) % 1800) / 1800 * 0.55;
      const newPins: { id: string; x: number; y: number; visible: boolean }[] = [];

      nodesRef.current.forEach((n) => {
        let acousticEnergy = Math.pow(10, n.baseDb / 10);
        const nodeVec = new THREE.Vector3(n.x, 1.5, n.z);

        vehiclesPhysics.forEach((v) => {
          const dist = Math.max(10, nodeVec.distanceTo(v.worldPos));
          const carSourceDb = 79 + (v.speed / v.maxSpeed) * 6;
          // Atenuação de oclusão (-5 dB se o veículo estiver atrás de outro setor)
          const occlusionLoss = dist > 95 ? 5 : 0;
          const perceivedDb = carSourceDb - 20 * Math.log10(dist / 10) - occlusionLoss;
          if (perceivedDb > 40) {
            acousticEnergy += Math.pow(10, perceivedDb / 10);
          }
        });

        liveAcousticLevelsRef.current[n.id] = 10 * Math.log10(acousticEnergy);

        const disc = groundHeatDiscsMap[n.id];
        const ring = pulseRingsMap[n.id];
        const isAlert = n.noiseDb > n.noiseThreshold;
        const isSel = n.id === selectedNodeIdRef.current;

        if (disc && ring) {
          disc.visible = highlightAcousticsRef.current;
          ring.visible = highlightAcousticsRef.current;
          disc.material.map = isAlert ? texRedHeat : isSel ? texGreenHeat : texBlueHeat;
          disc.material.opacity = isSel ? 0.95 : isAlert ? 0.88 : 0.55;
          ring.material.color.setHex(isAlert ? 0xf43f5e : isSel ? 0x00a859 : 0x38bdf8);
          ring.scale.set(pulseScale, pulseScale, 1);
        }

        if (container && container.clientWidth > 0 && container.clientHeight > 0) {
          const worldPos = new THREE.Vector3(n.x, n.h + 18, n.z);
          worldPos.project(camera);
          const sx = (worldPos.x * 0.5 + 0.5) * container.clientWidth;
          const sy = (-(worldPos.y * 0.5) + 0.5) * container.clientHeight;
          newPins.push({
            id: n.id,
            x: sx,
            y: sy,
            visible: worldPos.z < 1
          });
        }
      });

        setScreenPins(newPins);
        renderer.render(scene, camera);
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

      {/* BARRA SUPERIOR SLIM + BOTÃO MODO CINEMA (TELA CHEIA) */}
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

      {/* BOTÃO DE REABRIR PAINEL ESQUERDO QUANDO RECOLHIDO */}
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

      {/* PAINEL ESQUERDO COMPACTO E RETRÁTIL (w-68) */}
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

          {/* FÍSICA DE TRÁFEGO & SOM */}
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

          {/* ADICIONAR SENSOR + RESETAR CÂMERA */}
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
                camTargetStateRef.current = {
                  theta: 0.0,
                  phi: 0.86,
                  radius: 390,
                  targetX: 0,
                  targetZ: 14
                };
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

      {/* BOTÃO DE REABRIR PAINEL DIREITO QUANDO RECOLHIDO */}
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

      {/* PAINEL DIREITO COMPACTO E RETRÁTIL (w-76) */}
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

          {/* SÉRIE HISTÓRICA COMPACTA */}
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

      {/* DOCK INFERIOR SLIM DE NAVEGAÇÃO RÁPIDA (NÃO TAMPA O CAMPUS!) */}
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
                  Motor PBR, Física IDM, Malha Contínua & Decisões do Plano
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
                  1. MALHA CONTÍNUA & ILUMINAÇÃO HDR (PMREM)
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Anel viário gerado por <code>BufferGeometry Ribbon</code> contínua (zero z-fighting) e mapa de ambiente HDR procedural (<code>PMREMGenerator</code>) para reflexos reais nos vidros e painéis solares.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  2. FÍSICA DE TRÁFEGO IDM & LUZES DE FREIO
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Veículos seguem o <em>Intelligent Driver Model</em> (IDM), mantendo distância segura do carro à frente, freando para pedestres com lanternas traseiras reativas e rotação física das 4 rodas.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  3. FÍSICA ACÚSTICA COM OCLUSÃO DE PRÉDIOS
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Soma logarítmica de decibéis (<code>dB</code>) em tempo real com perda por inserção de barreira (-5 dB) quando edifícios bloqueiam a linha de visada entre o veículo e o sonômetro.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0f1a2e] border border-[#1f345a] space-y-1">
                <span className="text-[#00A859] font-mono font-bold">
                  4. VIEWPORT AMPLO & MODO CINEMA
                </span>
                <p className="text-slate-200 leading-relaxed">
                  Painéis retráteis e dock inferior compacto liberando mais de 85% do espaço visual para inspeção do campus da Facens e do arquivo <code>Predios_Mesh.fbx</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
