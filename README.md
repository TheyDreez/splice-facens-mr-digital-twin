# Gêmeo Digital MR: Campus Facens & Splice Smart Solutions

Protótipo interativo em Realidade Mista (Browser WebXR) do sistema viário e câmeras inteligentes da Splice no Campus UniFacens, desenvolvido no âmbito da Residência em TIC 51 (UniFacens, Softex e MCTI).

## Funcionalidades Principais

* **Mapa 3D Isométrico Interativo (Canvas 60 FPS)**: Rotação orbital de 360 graus por arrasto de mouse, zoom com scroll e simulação de veículos e pedestres com física de tráfego.
* **Postes e Câmeras Splice Clicáveis (POSTE-01 a POSTE-04)**: Ao clicar nos postes na cena 3D ou nos painéis, abre instantaneamente o HUD 5G com telemetria e bounding boxes de IA (vestimenta, faixa etária estimada, gênero estimado, leitura LPR de placas e ruído em decibéis).
* **Adicionar Câmera / Poste**: Ferramenta interativa para instalar novos postes no viário ao vivo durante a apresentação.
* **Otimizações 3D em Tempo Real**:
  * Podar Árvores: Redução instantânea de polígonos (148.5k para 94.3k) e aumento de FPS para óculos de Realidade Mista.
  * Focar no Viário: Deixa os prédios translúcidos e destaca o sistema de tráfego e os sensores.
  * Sombras ON/OFF e Velocidade de Simulação (Pausa, 1x, 3x, 5x).

## Como Executar Localmente

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000` no seu navegador.

## Como Publicar na Vercel ou GitHub

```bash
git init
git add .
git commit -m "feat: prototipo interativo gemeo digital splice facens"
# Criar o repositorio no GitHub e subir:
git remote add origin https://github.com/SEU_USUARIO/splice-facens-mr-digital-twin.git
git push -u origin main
```
Na Vercel, basta importar o repositório do GitHub e clicar em Deploy (configuração Next.js automática).
