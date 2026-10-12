// Asset loading: meshopt GLBs + webp backdrop; materials re-bound per slot name.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
export const SHIP_IDS = ['bF', 'bD', 'bL', 'bS', 'rF', 'rD', 'rL', 'rS'];
export async function loadAssets(base, M, { lod = '_lod1', hero = false, skyName = 'sky' } = {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const bind = root => { root.traverse(o => { if (o.isMesh) { const n = o.material.name; o.material = M[n] || M.ceramic; o.castShadow = !o.material.transparent && !/glow|neon|holo|energy|strip|divider/i.test(n); o.receiveShadow = true; } }); return root; };
  const get = async f => bind((await loader.loadAsync(base + 'models/' + f + '.glb')).scene);
  const ships = {}, heroShips = {};
  await Promise.all(SHIP_IDS.map(async id => { ships[id] = await get(id + lod); if (hero) heroShips[id] = await get(id); }));
  const board = await get('board' + (lod === '_lod1' ? '_lod1' : ''));
  const sky = await new THREE.TextureLoader().loadAsync(base + skyName + '.webp'); sky.colorSpace = THREE.SRGBColorSpace; sky.mapping = THREE.EquirectangularReflectionMapping;
  return { ships, heroShips, board, sky }; }
